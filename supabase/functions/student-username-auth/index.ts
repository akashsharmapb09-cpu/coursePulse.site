import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const secretKeys = readKeySet("SUPABASE_SECRET_KEYS");
const publishableKeys = readKeySet("SUPABASE_PUBLISHABLE_KEYS");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretKeys.default ?? "";
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? publishableKeys.default ?? "";

if (!supabaseUrl || !serviceKey || !publicKey) {
  throw new Error("Supabase Auth environment is not configured for student username access.");
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});
const authClient = createClient(supabaseUrl, publicKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

function readKeySet(name: string): Record<string, string> {
  const raw = Deno.env.get(name);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

const productionOrigin = "https://coursepulse.netlify.app";
const legacyProductionOrigin = "https://coursepulse-site.vercel.app";
const vercelPreviewOrigin = /^https:\/\/coursepulse-site-[a-z0-9-]+-akashsharmapb09-8177\.vercel\.app$/;
const netlifyPreviewOrigin = /^https:\/\/[a-z0-9-]+--coursepulse\.netlify\.app$/;
const allowedOrigins = new Set([productionOrigin, legacyProductionOrigin, "http://localhost:3000"]);

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
  if (origin && (allowedOrigins.has(origin) || vercelPreviewOrigin.test(origin) || netlifyPreviewOrigin.test(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function clientIp(request: Request): string {
  // Prefer the CDN-provided client IP over caller-supplied X-Forwarded-For.
  const trustedCloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwardedChain = request.headers.get("x-forwarded-for")?.split(",").map(value => value.trim()).filter(Boolean);
  return trustedCloudflareIp || realIp || forwardedChain?.at(-1) || "unknown";
}

async function checkRateLimit(bucket: string, maxAttempts: number, windowSeconds: number): Promise<boolean> {
  const bucketHash = await sha256(bucket);
  const { data, error } = await admin.rpc("consume_student_auth_attempt", {
    p_bucket_hash: bucketHash,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds
  });
  if (error) throw new Error("Student login rate limit is temporarily unavailable.");
  return data === true;
}

const usernamePattern = /^[a-z0-9_]{3,24}$/;
const internalEmail = (username: string) => `${username}@students.coursepulse.invalid`;

function normalizedUsername(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function registerStudent(body: Record<string, unknown>, request: Request, origin: string | null) {
  const username = normalizedUsername(body.username);
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const program = typeof body.program === "string" ? body.program.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!usernamePattern.test(username)) {
    return jsonResponse({ error: "Username must be 3–24 characters using lowercase letters, numbers or underscores." }, 400, origin);
  }
  if (fullName.length < 2 || fullName.length > 120) {
    return jsonResponse({ error: "Enter your full name (2–120 characters)." }, 400, origin);
  }
  if (program.length < 2 || program.length > 80) {
    return jsonResponse({ error: "Choose or enter a valid programme." }, 400, origin);
  }
  if (password.length < 10 || password.length > 72) {
    return jsonResponse({ error: "Password must be between 10 and 72 characters." }, 400, origin);
  }

  const ip = clientIp(request);
  if (!(await checkRateLimit(`register:ip:${ip}`, 5, 3600))) {
    return jsonResponse({ error: "Too many registration attempts from this connection. Try again later." }, 429, origin);
  }

  const { data: existing, error: lookupError } = await admin
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return jsonResponse({ error: "That username is already taken. Choose another one." }, 409, origin);

  const email = internalEmail(username);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, program, username }
  });

  if (createError || !created.user) {
    const message = createError?.message ?? "";
    if (/already|exists|duplicate|unique/i.test(message)) {
      return jsonResponse({ error: "That username is already taken. Choose another one." }, 409, origin);
    }
    throw createError ?? new Error("Could not create the student account.");
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id,username,full_name,program,role,is_active")
    .eq("id", created.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "STUDENT" || !profile.is_active) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw profileError ?? new Error("Student profile could not be created.");
  }

  const { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  if (signInError || !signedIn.session) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw signInError ?? new Error("Student account was created but a session could not be started.");
  }

  return jsonResponse({
    user: { id: profile.id, username: profile.username, full_name: profile.full_name, program: profile.program, role: profile.role },
    session: { access_token: signedIn.session.access_token, refresh_token: signedIn.session.refresh_token }
  }, 201, origin);
}

async function signInStudent(body: Record<string, unknown>, request: Request, origin: string | null) {
  const username = normalizedUsername(body.username);
  const password = typeof body.password === "string" ? body.password : "";

  if (!usernamePattern.test(username) || password.length < 1 || password.length > 72) {
    return jsonResponse({ error: "Username or password is incorrect." }, 401, origin);
  }

  const ip = clientIp(request);
  const [ipAllowed, usernameAllowed] = await Promise.all([
    checkRateLimit(`login:ip:${ip}`, 20, 900),
    checkRateLimit(`login:user:${username}`, 8, 900)
  ]);
  if (!ipAllowed || !usernameAllowed) {
    return jsonResponse({ error: "Too many sign-in attempts. Try again in 15 minutes." }, 429, origin);
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id,email,username,full_name,program,role,is_active")
    .eq("username", username)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || profile.role !== "STUDENT" || !profile.is_active) {
    return jsonResponse({ error: "Username or password is incorrect." }, 401, origin);
  }

  // Legacy students retain their existing private Auth email; new username-only
  // students use a non-deliverable .invalid identifier that is never shown to them.
  const email = profile.email || internalEmail(username);
  const { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  if (signInError || !signedIn.session || signedIn.user.id !== profile.id) {
    return jsonResponse({ error: "Username or password is incorrect." }, 401, origin);
  }

  return jsonResponse({
    user: { id: profile.id, username: profile.username, full_name: profile.full_name, program: profile.program, role: profile.role },
    session: { access_token: signedIn.session.access_token, refresh_token: signedIn.session.refresh_token }
  }, 200, origin);
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, origin);
  if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > 4096) {
    return jsonResponse({ error: "Request is too large." }, 413, origin);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "Invalid request." }, 400, origin);
    }
    if (body.action === "register") return await registerStudent(body, request, origin);
    if (body.action === "login") return await signInStudent(body, request, origin);
    return jsonResponse({ error: "Unsupported student account action." }, 400, origin);
  } catch (error) {
    console.error("Student username authentication failed:", error instanceof Error ? error.message : "unknown error");
    return jsonResponse({ error: "Student account service is temporarily unavailable. Please try again." }, 500, origin);
  }
});
