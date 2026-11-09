-- Allow the public invoker wrapper to call the non-exposed private token registrar.
-- The private schema is not in the PostgREST exposed-schema list; only the public
-- wrapper is callable from the authenticated client.
grant execute on function private.register_student_card_token(text) to authenticated;

-- The Head's aggregate-only reads and tenant-safe month close keep their own
-- org-specific filters in the SECURITY DEFINER functions.
