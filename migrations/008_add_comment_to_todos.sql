-- Add comment column to todos table for additional notes/details
-- The comment field is encrypted client-side like the todo text

ALTER TABLE todos
ADD COLUMN IF NOT EXISTS comment TEXT;

-- Add comment
COMMENT ON COLUMN todos.comment IS 'Encrypted comment/notes for the todo item (nullable, max 1024 chars client-side)';
