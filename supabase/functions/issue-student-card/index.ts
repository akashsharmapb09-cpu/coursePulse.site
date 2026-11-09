import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import QRCode from "npm:qrcode@1.5.4";

function safeBaseUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const allowed = url.protocol === "https:" && (
      url.hostname === "coursepulse-site.vercel.app" ||
      (url.hostname.startsWith("coursepulse-site-") && url.hostname.endsWith(".vercel.app"))
    );
    return allowed ? url.origin : null;
  } catch {
    return null;
  }
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return response({ error: "Sign in to create your student card." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) return response({ error: "Student card service is not configured." }, 503);

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: "Bearer " + accessToken } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: identity, error: identityError } = await supabase.auth.getUser(accessToken);
  if (identityError || !identity.user || identity.user.is_anonymous) {
    return response({ error: "Your session is invalid. Sign in again." }, 401);
  }
  const [{ data: profile, error: profileError }, { data: directory, error: directoryError }, { data: organization, error: organizationError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    supabase.from("users").select("id,full_name,email,role,organization_id,is_active").eq("id", identity.user.id).maybeSingle(),
    supabase.from("student_directory").select("student_number").eq("student_id", identity.user.id).maybeSingle(),
    supabase.from("organizations").select("name,status").maybeSingle(),
    supabase.from("course_enrollments").select("section").eq("student_id", identity.user.id),
  ]);
  if (profileError || !profile || !profile.is_active || profile.role !== "STUDENT" || !profile.organization_id) {
    return response({ error: "A provisioned student account is required for a college ID." }, 403);
  }
  if (directoryError || !directory || organizationError || !organization || organization.status !== "ACTIVE") {
    return response({ error: "Your college has not completed your student ID record yet." }, 404);
  }
  if (enrollmentError) return response({ error: "Your course sections could not be loaded." }, 500);

  const baseUrl = safeBaseUrl(request.headers.get("x-app-base-url")) ??
    safeBaseUrl(Deno.env.get("APP_BASE_URL"));
  if (!baseUrl) return response({ error: "The student card verification URL is not configured for this deployment." }, 503);

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");

  const { data: expiry, error: registerError } = await supabase.rpc("register_student_card_token", {
    p_token_hash: tokenHash,
  });
  if (registerError || !expiry) return response({ error: "A verification token could not be issued for this student account." }, 500);

  const verificationUrl = baseUrl + "/verify/student#" + token;
  let qrSvg: string;
  try {
    qrSvg = await QRCode.toString(verificationUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 260,
      color: { dark: "#14392f", light: "#ffffff" },
    });
  } catch {
    return response({ error: "The QR code could not be generated. Refresh the card to try again." }, 500);
  }

  const sections = [...new Set((enrollments ?? []).map((row) => row.section).filter((value): value is string => typeof value === "string" && value.trim().length > 0))].sort();
  return response({
    card: {
      full_name: profile.full_name,
      email: profile.email,
      student_number: directory.student_number,
      college_name: organization.name,
      sections,
      verification_url: verificationUrl,
      qr_svg_base64: btoa(unescape(encodeURIComponent(qrSvg))),
      valid_until: expiry,
    },
  });
});
