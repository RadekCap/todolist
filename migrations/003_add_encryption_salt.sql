-- Add encryption_salt column to user_settings table
-- Stores the salt used for deriving user's encryption key from password
-- This enables client-side encryption of sensitive user data (todos, categories)

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS encryption_salt VARCHAR(32);

-- Add comment to column
COMMENT ON COLUMN user_settings.encryption_salt IS 'Base64-encoded salt for deriving encryption key from user password';
