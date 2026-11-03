# Code Style and Engineering Standards

- TypeScript strict mode; avoid any; define explicit API request/response types.
- Keep route handlers thin: authenticate, validate, authorize, call a domain service, return a typed response.
- Validate untrusted input with Zod at server boundaries; enforce size and count limits.
- Never trust client-provided role, owner, course assignment, identity or aggregate scope.
- Use request-scoped Supabase server clients. Never expose service-role secrets.
- Keep migrations additive and reversible where practical. Never reset production data.
- Review RLS, grants, views and RPC privileges for every schema change.
- Use semantic HTML, visible focus states, keyboard support, labels and accessible errors.
- Test mobile, tablet and desktop layouts.
- Separate data fetching, domain logic and presentation.
- Never log passwords, tokens, free-text feedback, raw answer payloads or personal identifiers.
- Add tests for each bug fix and permission-sensitive behavior.
- Run npm run typecheck, npm test, npm run build and npm audit before merge.
- Do not claim completion without automated and manual evidence.
