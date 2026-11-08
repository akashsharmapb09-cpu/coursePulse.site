ALTER TABLE private.admin_signup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_signup_settings_service_role_read
ON private.admin_signup_settings
FOR SELECT
TO service_role
USING (true);
