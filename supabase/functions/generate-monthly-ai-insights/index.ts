import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function extractOutputText(payload: Record<string, unknown>): string | null {
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type !== "message" || !Array.isArray(row.content)) continue;
    for (const part of row.content) {
      if (!part || typeof part !== "object") continue;
      const content = part as Record<string, unknown>;
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const accessToken = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return json({ error: "Authentication required." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL");

  if (!url || !serviceKey) return json({ error: "AI reporting service is not configured." }, 503);
  if (!apiKey || !model) {
    return json({
      code: "AI_PROVIDER_NOT_CONFIGURED",
      error: "Add OPENAI_API_KEY and OPENAI_MODEL as Supabase Edge Function secrets to enable generative insights.",
    }, 503);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: identity, error: identityError } = await admin.auth.getUser(accessToken);
  if (identityError || !identity.user || identity.user.is_anonymous) {
    return json({ error: "A valid signed-in College Head account is required." }, 401);
  }

  let claims: Record<string, unknown>;
  try {
    const payload = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
  } catch {
    return json({ error: "The session could not be verified." }, 401);
  }
  if (claims.sub !== identity.user.id || claims.aal !== "aal2") {
    return json({ error: "College Head MFA verification is required." }, 403);
  }

  const { data: profile, error: profileError } = await admin.from("users")
    .select("id,role,is_active,organization_id")
    .eq("id", identity.user.id).maybeSingle();
  if (profileError || !profile || !profile.is_active || profile.role !== "ADMIN" || !profile.organization_id) {
    return json({ error: "College Head access is required." }, 403);
  }

  const { data: organization, error: organizationError } = await admin.from("organizations")
    .select("id,status").eq("id", profile.organization_id).maybeSingle();
  if (organizationError || !organization || organization.status !== "ACTIVE") {
    return json({ error: "The college workspace is not active." }, 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "month") ||
    typeof (body as Record<string, unknown>).month !== "string" ||
    !monthPattern.test((body as Record<string, unknown>).month as string)) {
    return json({ error: "Provide a reporting month in YYYY-MM format." }, 400);
  }
  const month = (body as { month: string }).month;
  const reportMonth = month + "-01";

  const { data: reports, error: reportError } = await admin.from("monthly_academic_reports")
    .select("scope_type,scope_label,response_count,average_rating,previous_average,rating_change,recommendation")
    .eq("organization_id", profile.organization_id)
    .eq("report_month", reportMonth)
    .order("scope_type", { ascending: true })
    .order("scope_label", { ascending: true })
    .limit(2000);
  if (reportError) return json({ error: "Suppressed monthly aggregates could not be loaded." }, 500);
  if (!reports?.length) {
    return json({ error: "No reportable aggregates exist for this month. At least five responses are required for every included group." }, 409);
  }

  // Only group-level rating means, response counts, month-over-month deltas,
  // and authored recommendations leave Supabase. No names of students,
  // emails, phone numbers, raw answer values, or free-text feedback are sent.
  const aggregateInput = reports.map((row) => ({
    scope: row.scope_type,
    label: row.scope_label,
    reportable_rating_answers: Number(row.response_count),
    average_rating_out_of_5: Number(row.average_rating),
    previous_month_average: row.previous_average === null ? null : Number(row.previous_average),
    change_from_previous_month: row.rating_change === null ? null : Number(row.rating_change),
    existing_guidance: row.recommendation,
  }));

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      overall_summary: { type: "string" },
      priorities: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            scope: { type: "string" },
            title: { type: "string" },
            rationale: { type: "string" },
            recommended_action: { type: "string" },
            urgency: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["scope", "title", "rationale", "recommended_action", "urgency"],
        },
      },
    },
    required: ["overall_summary", "priorities"],
  };

  const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1400,
      instructions: [
        "You are a cautious academic quality analyst advising a College Head.",
        "Use only the supplied privacy-suppressed aggregates. Do not infer student identities, quote feedback, claim causation, or invent events.",
        "Treat small counts carefully, state that counts are reportable rating answers rather than unique students, and avoid ranking named teachers.",
        "Recommend practical, supportive, measurable actions. Do not make disciplinary or employment decisions.",
        "Mention limitations where data is sparse or month-over-month comparisons are missing.",
        "Return concise JSON matching the required schema."
      ].join(" "),
      input: JSON.stringify({ report_month: month, aggregates: aggregateInput }),
      text: {
        format: {
          type: "json_schema",
          name: "coursepulse_monthly_academic_insights",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!openAIResponse.ok) {
    return json({ error: "The AI provider could not generate insights. Check model availability and the configured provider key." }, 502);
  }

  const providerPayload = await openAIResponse.json().catch(() => null) as Record<string, unknown> | null;
  const outputText = providerPayload ? extractOutputText(providerPayload) : null;
  if (!outputText) return json({ error: "The AI provider returned no usable report." }, 502);

  let insights: { overall_summary: string; priorities: Array<Record<string, string>> };
  try {
    insights = JSON.parse(outputText);
  } catch {
    return json({ error: "The AI provider returned an invalid report format." }, 502);
  }

  if (typeof insights.overall_summary !== "string" ||
    insights.overall_summary.length < 20 || insights.overall_summary.length > 2400 ||
    !Array.isArray(insights.priorities) || insights.priorities.length > 8 ||
    insights.priorities.some((item) =>
      !item || typeof item.scope !== "string" || typeof item.title !== "string" ||
      typeof item.rationale !== "string" || typeof item.recommended_action !== "string" ||
      !["low", "medium", "high"].includes(item.urgency)
    )) {
    return json({ error: "The AI provider returned an invalid report structure." }, 502);
  }

  const { data: saved, error: saveError } = await admin.from("monthly_ai_insights")
    .upsert({
      organization_id: profile.organization_id,
      report_month: reportMonth,
      model,
      overall_summary: insights.overall_summary,
      priorities: insights.priorities,
      generated_by: identity.user.id,
      generated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,report_month" })
    .select("report_month,model,overall_summary,priorities,generated_at")
    .single();

  if (saveError || !saved) return json({ error: "The AI report could not be saved to the college workspace." }, 500);
  return json({ insight: saved, source_groups: reports.length, source: "privacy-suppressed-monthly-aggregates" });
});
