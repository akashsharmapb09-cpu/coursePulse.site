UPDATE private.admin_signup_settings
SET code_sha256 = decode('7124d968784f795106bd6e4324f37ace5acebbe6afb46c79dfea3b93538e924a', 'hex'),
    previous_code_sha256 = NULL,
    updated_at = now()
WHERE singleton = true;
