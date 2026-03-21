-- Add notification columns to user_settings (originally added outside of migrations).
-- Runs after 001_create_user_settings.sql which creates the table.

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS email_notification_time TIME DEFAULT '08:00:00';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone TEXT;
CREATE INDEX IF NOT EXISTS idx_user_settings_notifications ON user_settings(user_id) WHERE email_notifications_enabled = TRUE;
