Deno.serve((_request: Request) => {
  return new Response(
    JSON.stringify({
      error: "Multi-college workspace provisioning is no longer supported on this CoursePulse deployment."
    }),
    {
      status: 410,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Deprecation": "true"
      }
    }
  );
});
