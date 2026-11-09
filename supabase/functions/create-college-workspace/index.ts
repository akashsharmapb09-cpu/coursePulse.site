import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const origins = (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "https://coursepulse-site.vercel.app")
  .split(",").map((value) => value.trim()).filter(Boolean);
const cors = (origin: string | null) => origin && origins.includes(origin)
  ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-app-base-url",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      Vary: "Origin",
    }
  : { Vary: "Origin" };
const reply = (body: unknown, status: number, headers: Record<string,string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;

function safeBaseUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (
      url.hostname === "coursepulse-site.vercel.app" ||
      (url.hostname.startsWith("coursepulse-site-") && url.hostname.endsWith(".vercel.app"))
    ) ? url.origin : null;
  } catch { return null; }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  const headers = cors(origin);
  if (request.method === "OPTIONS") {
    if (origin && !headers["Access-Control-Allow-Origin"]) return reply({ error: "Origin not allowed." }, 403, headers);
    return new Response("ok", { headers });
  }
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405, headers);
  if (origin && !headers["Access-Control-Allow-Origin"]) return reply({ error: "Origin not allowed." }, 403, headers);

  const accessToken = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return reply({ error: "Authentication required." }, 401, headers);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply({ error: "Platform invitation service is not configured." }, 503, headers);

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: "Bearer " + accessToken } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: identity, error: identityError } = await admin.auth.getUser(accessToken);
  if (identityError || !identity.user || identity.user.is_anonymous) {
    return reply({ error: "A valid signed-in account is required." }, 401, headers);
  }

  let claims: Record<string, unknown>;
  try {
    const payload = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
  } catch {
    return reply({ error: "The session could not be verified." }, 401, headers);
  }
  if (claims.sub !== identity.user.id || claims.aal !== "aal2") {
    return reply({ error: "Platform owner MFA is required." }, 403, headers);
  }

  const { data: isPlatformAdmin, error: permissionError } = await caller.rpc("platform_is_admin");
  if (permissionError || isPlatformAdmin !== true) {
    return reply({ error: "CoursePulse platform administration access is required." }, 403, headers);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Object.keys(body).some((key) => !["name","slug","head_name","head_email"].includes(key))) {
    return reply({ error: "Invalid college setup request." }, 400, headers);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const headName = typeof body.head_name === "string" ? body.head_name.trim() : "";
  const headEmail = typeof body.head_email === "string" ? body.head_email.trim().toLowerCase() : "";
  if (name.length < 2 || name.length > 160 || !slugPattern.test(slug) ||
    headName.length < 2 || headName.length > 120 ||
    headEmail.length > 254 || !emailPattern.test(headEmail)) {
    return reply({ error: "Enter a valid college name, workspace slug and first Head email." }, 400, headers);
  }

  const baseUrl = safeBaseUrl(Deno.env.get("APP_BASE_URL")) ??
    safeBaseUrl(request.headers.get("x-app-base-url")) ??
    "https://coursepulse-site.vercel.app";

  const { data: organization, error: organizationError } = await admin.from("organizations")
    .insert({ name, slug, status: "SETUP_REQUIRED", subscription_status: "UNCONFIGURED" })
    .select("id,name,slug,status")
    .single();
  if (organizationError || !organization) {
    return reply({ error: organizationError?.code === "23505" ? "That college workspace slug is already in use." : "The college workspace could not be created." }, 409, headers);
  }

  const { data: invitation, error: invitationError } = await admin.from("organization_invitations")
    .insert({
      organization_id: organization.id,
      email: headEmail,
      full_name: headName,
      invited_role: "ADMIN",
      course_ids: [],
      invited_by: identity.user.id,
    })
    .select("id")
    .single();

  if (invitationError || !invitation) {
    await admin.from("organizations").delete().eq("id", organization.id).eq("status", "SETUP_REQUIRED");
    return reply({ error: "The first College Head invitation could not be prepared." }, 500, headers);
  }

  const { data: existing, error: lookupError } = await admin.rpc("resolve_roster_email", { p_email: headEmail });
  if (lookupError) {
    await admin.from("organization_invitations").delete().eq("id", invitation.id);
    await admin.from("organizations").delete().eq("id", organization.id);
    return reply({ error: "The Head account could not be checked safely." }, 500, headers);
  }

  const existingAccount = Array.isArray(existing) ? existing[0] : null;
  if (existingAccount) {
    if (!existingAccount.email_confirmed) {
      await admin.from("organization_invitations").delete().eq("id", invitation.id);
      await admin.from("organizations").delete().eq("id", organization.id);
      return reply({ error: "This email already has an account. Its owner must verify the email or mobile before it can become the first Head." }, 409, headers);
    }
    const { error: linkError } = await admin.rpc("accept_existing_college_head_invitation", {
      p_invitation_id: invitation.id,
    });
    if (linkError) {
      await admin.from("organization_invitations").delete().eq("id", invitation.id);
      await admin.from("organizations").delete().eq("id", organization.id);
      const isAssignedElsewhere = linkError.message.toLowerCase().includes("different college");
      const hasRoleConflict = linkError.message.toLowerCase().includes("role");
      const message = isAssignedElsewhere
        ? "This verified email already belongs to another college workspace. Use a different email for the first College Head; existing memberships will not be moved."
        : hasRoleConflict
          ? "This verified account has a role that cannot be used for the first College Head invitation. Use a different email address."
          : "The existing verified account could not be linked as this college’s first Head.";
      return reply({ error: message }, 409, headers);
    }
    return reply({
      organization: { ...organization, status: "ACTIVE" },
      head_email: headEmail,
      head_status: "LINKED_EXISTING",
    }, 201, headers);
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(headEmail, {
    data: { full_name: headName },
    redirectTo: baseUrl + "/auth/confirm?next=/dashboard",
  });
  if (inviteError || !invited.user) {
    await admin.from("organization_invitations").delete().eq("id", invitation.id);
    await admin.from("organizations").delete().eq("id", organization.id);
    return reply({ error: "The first Head email could not be sent. Check the Supabase Auth email provider and invitation delivery limits." }, 502, headers);
  }

  await admin.from("organization_invitations")
    .update({ status: "INVITED", auth_user_id: invited.user.id, updated_at: new Date().toISOString() })
    .eq("id", invitation.id)
    .eq("status", "PENDING");

  await admin.from("platform_admin_audit").insert({
    actor_id: identity.user.id,
    organization_id: organization.id,
    action: "organization.created_and_head_invited",
    new_status: "SETUP_REQUIRED",
    new_subscription_status: "UNCONFIGURED",
  });

  return reply({
    organization,
    head_email: headEmail,
    head_status: "INVITED",
    activation: "The college workspace becomes active after the first Head verifies the email invitation.",
  }, 201, headers);
});
