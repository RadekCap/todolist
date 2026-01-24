-- Add recurrence columns to todos table for recurring todo support
-- Template todos (is_template=true) store the recurrence rule but are not shown in the list
-- Instance todos (template_id set) are linked to a template and shown in the list with recurring icon

-- Add recurrence columns
-- Note: template_id uses BIGINT to match todos.id column type
ALTER TABLE todos
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS template_id BIGINT REFERENCES todos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recurrence_rule JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurrence_end_type VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurrence_end_count INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurrence_count INTEGER DEFAULT 0;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_todos_template_id ON todos(template_id);
CREATE INDEX IF NOT EXISTS idx_todos_is_template ON todos(is_template) WHERE is_template = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN todos.is_template IS 'True if this is a recurring template (not shown in list, stores recurrence rule)';
COMMENT ON COLUMN todos.template_id IS 'Reference to parent template for recurring instances';
COMMENT ON COLUMN todos.recurrence_rule IS 'JSON object with recurrence configuration (type, interval, weekdays, etc.)';
COMMENT ON COLUMN todos.recurrence_end_type IS 'End condition: never, on_date, after_count';
COMMENT ON COLUMN todos.recurrence_end_date IS 'End date for recurrence (when end_type is on_date)';
COMMENT ON COLUMN todos.recurrence_end_count IS 'Max occurrences (when end_type is after_count)';
COMMENT ON COLUMN todos.recurrence_count IS 'Number of instances generated so far';
