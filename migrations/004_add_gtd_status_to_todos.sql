-- Add GTD (Getting Things Done) status field to todos table
-- This enables GTD workflow with Inbox, Next Actions, Waiting For, and Someday/Maybe

-- Add gtd_status column with default 'inbox'
ALTER TABLE todos
ADD COLUMN IF NOT EXISTS gtd_status VARCHAR(20) DEFAULT 'inbox';

-- Add index for faster filtering by GTD status
CREATE INDEX IF NOT EXISTS idx_todos_gtd_status ON todos(gtd_status);

-- Add comment
COMMENT ON COLUMN todos.gtd_status IS 'GTD workflow status: inbox (unprocessed), next_action (ready to do), waiting_for (delegated/blocked), someday_maybe (future possibilities)';
