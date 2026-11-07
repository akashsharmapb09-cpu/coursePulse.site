# Code Style

- TypeScript strict mode; avoid `any`, unsafe casts, and implicit trust in browser payloads.
- Use App Router server components by default; mark client components only when state or browser interaction is required.
- Use request-scoped Supabase SSR clients. Do not use service-role keys for normal user routes.
- Validate route params, search params, and JSON bodies with Zod on the server; reject unknown keys on sensitive operations.
- Keep authorization in route handlers and/or database functions; hiding UI controls is not authorization.
- Use parameterized Supabase query builders/RPCs; do not concatenate SQL.
- Return generic public errors; log only minimal security-relevant metadata.
- Reuse design tokens and accessible controls, labels, focus states, loading states and responsive behavior.
- Keep user-generated content as text; do not render unsafe HTML.
- Add unit/integration/E2E tests for validation, permissions, data boundaries, and error paths.
- Before handoff run `npm run typecheck`, `npm test`, `npm run build`, and dependency/security checks. Document tests that require live user fixtures.
