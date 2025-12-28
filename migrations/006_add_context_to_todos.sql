-- Add context_id column to todos table for GTD context association

ALTER TABLE todos
ADD COLUMN IF NOT EXISTS context_id UUID REFERENCES contexts(id) ON DELETE SET NULL;

-- Add index for faster filtering by context
CREATE INDEX IF NOT EXISTS idx_todos_context_id ON todos(context_id);

-- Add comment
COMMENT ON COLUMN todos.context_id IS 'Reference to GTD context (nullable)';
