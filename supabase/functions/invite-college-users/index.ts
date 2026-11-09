import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const configuredOrigins = () => (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "https://coursepulse-site.vercel.app")
  .split(",").map((value) => value.trim()).filter(Boolean);

const corsHeaders = (origin: string | null) => {
  const allowed = configuredOrigins();
  if (!origin || !allowed.includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-app-base-url",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Invite = {
  email: string; full_name: string; role: "STUDENT" | "INSTRUCTOR";
  department_id?: string | null; course_ids: string[];
  student_number?: string; section?: string; mobile?: string;
};

function parseInvite(raw: unknown): Invite | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some((key) => ![
    "email", "full_name", "role", "department_id", "course_ids",
    "student_number", "section", "mobile",
  ].includes(key))) return null;
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const full_name = typeof value.full_name === "string" ? value.full_name.trim() : "";
  const role = value.role;
  const department_id = value.department_id === undefined || value.department_id === null
    ? null : typeof value.department_id === "string" ? value.department_id : "invalid";
  const course_ids = Array.isArray(value.course_ids) && value.course_ids.length <= 25
    ? [...new Set(value.course_ids.filter((id): id is string => typeof id === "string"))] : [];
  const student_number = typeof value.student_number === "string" ? value.student_number.trim() : "";
  const section = typeof value.section === "string" ? value.section.trim() : "";
  const mobile = typeof value.mobile === "string" ? value.mobile.trim() : "";
  if (!EMAIL.test(email) || email.length > 254 || full_name.length < 2 || full_name.length > 120) return null;
  if (role !== "STUDENT" && role !== "INSTRUCTOR") return null;
  if (department_id !== null && !UUID.test(department_id)) return null;
  if (course_ids.length < 1 || course_ids.some((id) => !UUID.test(id))) return null;
  if (role === "STUDENT" && (student_number.length < 1 || student_number.length > 40)) return null;
  if (section.length > 30 || mobile.length > 24) return null;
  if (mobile && !/^\+?[0-9 ()-]{8,24}$/.test(mobile)) return null;
  return { email, full_name, role, department_id, course_ids, student_number, section, mobile };
}

function allowedBaseUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const allowed = parsed.protocol === "https:" && (
      parsed.hostname === "coursepulse-site.vercel.app" ||
      (parsed.hostname.startsWith("coursepulse-site-") && parsed.hostname.endsWith(".vercel.app"))
    );
    return allowed ? parsed.origin : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);
  if (request.method === "OPTIONS") {
    if (origin && !cors["Access-Control-Allow-Origin"]) return new Response("Forbidden", { status: 403, headers: cors });
    return new Response("ok", { headers: cors });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);
  if (origin && !cors["Access-Control-Allow-Origin"]) return json({ error: "Origin not allowed." }, 403, cors);

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return json({ error: "Authentication required." }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Invitation service is not configured." }, 503, cors);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: identity, error: identityError } = await admin.auth.getUser(accessToken);
  if (identityError || !identity.user || identity.user.is_anonymous) {
    return json({ error: "A valid signed-in account is required." }, 401, cors);
  }

  // The gateway verifies the JWT before this function runs; getUser verifies its
  // signature again before the claims are used for the College Head AAL2 gate.
  let claims: Record<string, unknown>;
  try {
    const payload = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
  } catch {
    return json({ error: "The session could not be verified." }, 401, cors);
  }
  if (claims.sub !== identity.user.id) {
    return json({ error: "The session could not be verified." }, 401, cors);
  }

  const { data: profile, error: profileError } = await admin.from("users")
    .select("id,role,is_active,organization_id,department_id")
    .eq("id", identity.user.id).maybeSingle();
  if (profileError || !profile || !profile.is_active || !profile.organization_id) {
    return json({ error: "An active college staff account is required." }, 403, cors);
  }
  const isHead = profile.role === "ADMIN" && claims.aal === "aal2";
  const isTeacher = profile.role === "INSTRUCTOR";
  if (!isHead && !isTeacher) {
    return json({ error: "College Head or assigned teacher access is required." }, 403, cors);
  }
  const { data: organization, error: orgError } = await admin.from("organizations")
    .select("id,status,name").eq("id", profile.organization_id).maybeSingle();
  if (orgError || !organization || organization.status !== "ACTIVE") {
    return json({ error: "The college workspace is not active." }, 403, cors);
  }

  const baseUrl = allowedBaseUrl(Deno.env.get("APP_BASE_URL")) ??
    allowedBaseUrl(request.headers.get("x-app-base-url")) ??
    "https://coursepulse-site.vercel.app";

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Object.keys(body).some((key) => key !== "invitations") ||
    !Array.isArray(body.invitations) || body.invitations.length < 1 || body.invitations.length > 100) {
    return json({ error: "Provide between 1 and 100 valid invitations." }, 400, cors);
  }
  const parsed = body.invitations.map(parseInvite);
  if (parsed.some((item) => item === null)) {
    return json({ error: "One or more invitations contain invalid details." }, 400, cors);
  }
  const invites = parsed as Invite[];
  if (isTeacher && invites.some((invite) => invite.role !== "STUDENT")) {
    return json({ error: "Teachers can invite students only." }, 403, cors);
  }

  const duplicateEmails = new Set<string>();
  for (const invite of invites) {
    if (duplicateEmails.has(invite.email)) return json({ error: "Duplicate email addresses are not allowed in one roster import." }, 400, cors);
    duplicateEmails.add(invite.email);
  }

  const allCourses = [...new Set(invites.flatMap((invite) => invite.course_ids))];
  const allDepartments = [...new Set(invites.map((invite) => invite.department_id).filter((id): id is string => Boolean(id)))];
  const [courseCheck, departmentCheck, assignmentCheck] = await Promise.all([
    admin.from("courses").select("id,instructor_id,department_id").eq("organization_id", profile.organization_id).in("id", allCourses),
    allDepartments.length
      ? admin.from("departments").select("id").eq("organization_id", profile.organization_id).in("id", allDepartments)
      : Promise.resolve({ data: [], error: null }),
    isTeacher
      ? admin.from("instructor_course_assignments").select("course_id")
          .eq("organization_id", profile.organization_id)
          .eq("instructor_id", identity.user.id)
          .in("course_id", allCourses)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (courseCheck.error || departmentCheck.error || assignmentCheck.error ||
    (courseCheck.data?.length ?? 0) !== allCourses.length ||
    (departmentCheck.data?.length ?? 0) !== allDepartments.length) {
    return json({ error: "Every selected course and department must belong to your college." }, 400, cors);
  }
  if (isTeacher) {
    const assignedCourseIds = new Set([
      ...(courseCheck.data ?? []).filter((course) => course.instructor_id === identity.user.id).map((course) => course.id),
      ...(assignmentCheck.data ?? []).map((assignment) => assignment.course_id),
    ]);
    if (allCourses.some((courseId) => !assignedCourseIds.has(courseId))) {
      return json({ error: "You can invite students only to courses assigned to your teacher account." }, 403, cors);
    }
    const courseDepartments = new Set((courseCheck.data ?? [])
      .map((course) => course.department_id)
      .filter((id): id is string => Boolean(id)));
    if (invites.some((invite) => invite.department_id && !courseDepartments.has(invite.department_id))) {
      return json({ error: "A teacher can use only the department linked to an assigned course." }, 403, cors);
    }
    for (const invite of invites) {
      if (!invite.department_id && courseDepartments.size === 1) {
        invite.department_id = [...courseDepartments][0];
      }
    }
  }

  const results: Array<{ email: string; role: string; status: string; error?: string; user_id?: string }> = [];
  for (const invite of invites) {
    const { data: invitation, error: insertError } = await admin.from("organization_invitations")
      .insert({
        organization_id: profile.organization_id,
        email: invite.email,
        full_name: invite.full_name,
        invited_role: invite.role,
        department_id: invite.department_id,
        course_ids: invite.course_ids,
        student_number: invite.role === "STUDENT" ? invite.student_number : null,
        section: invite.section || null,
        mobile: invite.role === "STUDENT" ? invite.mobile || null : null,
        invited_by: identity.user.id,
      }).select("id").single();

    if (insertError || !invitation) {
      results.push({ email: invite.email, role: invite.role, status: "FAILED", error: insertError?.code === "23505" ? "An invitation is already pending for this email." : "Invitation could not be prepared." });
      continue;
    }

    // Existing accounts are linked only when their email/phone identity is
    // already confirmed and their account is not attached to another college.
    const { data: existing, error: lookupError } = await admin.rpc("resolve_roster_email", {
      p_email: invite.email,
    });
    if (lookupError) {
      await admin.from("organization_invitations").update({ status: "FAILED" }).eq("id", invitation.id);
      results.push({ email: invite.email, role: invite.role, status: "FAILED", error: "Existing account lookup was unavailable." });
      continue;
    }
    const existingAccount = Array.isArray(existing) ? existing[0] : null;
    if (existingAccount) {
      if (!existingAccount.email_confirmed) {
        await admin.from("organization_invitations").update({ status: "FAILED" }).eq("id", invitation.id);
        results.push({ email: invite.email, role: invite.role, status: "FAILED", error: "This email already has an account; its owner must verify the email or mobile before it can be linked." });
        continue;
      }
      const { data: linked, error: linkError } = await admin.rpc("accept_existing_organization_invitation", {
        p_invitation_id: invitation.id,
      });
      if (linkError) {
        await admin.from("organization_invitations").update({ status: "FAILED" }).eq("id", invitation.id);
        const message = linkError.message.includes("another college") ? "This account already belongs to another college." :
          linkError.message.includes("role does not match") ? "The existing account role does not match this invitation." :
          "The existing account could not be safely linked.";
        results.push({ email: invite.email, role: invite.role, status: "FAILED", error: message });
      } else {
        results.push({ email: invite.email, role: invite.role, status: "LINKED_EXISTING", user_id: Array.isArray(linked) ? linked[0]?.auth_user_id : undefined });
      }
      continue;
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(invite.email, {
      data: { full_name: invite.full_name },
      redirectTo: baseUrl + "/auth/confirm?next=/dashboard",
    });

    if (inviteError || !invited.user) {
      await admin.from("organization_invitations")
        .update({ status: "FAILED", updated_at: new Date().toISOString() })
        .eq("id", invitation.id).eq("status", "PENDING");
      results.push({ email: invite.email, role: invite.role, status: "FAILED", error: "Auth invitation could not be sent. Check the Supabase email provider and invitation delivery limits." });
      continue;
    }

    // The Auth insert trigger may already have consumed this row and provisioned
    // the account. Never overwrite ACCEPTED with INVITED.
    await admin.from("organization_invitations")
      .update({ status: "INVITED", auth_user_id: invited.user.id, updated_at: new Date().toISOString() })
      .eq("id", invitation.id).eq("status", "PENDING");
    results.push({ email: invite.email, role: invite.role, status: "INVITED", user_id: invited.user.id });
  }

  const invitedCount = results.filter((row) => row.status === "INVITED" || row.status === "LINKED_EXISTING").length;
  return json({
    organization: organization.name,
    total: results.length,
    invited: invitedCount,
    failed: results.length - invitedCount,
    results,
  }, 200, cors);
});
