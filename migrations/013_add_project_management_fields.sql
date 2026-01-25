-- Add description field (encrypted like name)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;

-- Add sort_order for drag-and-drop reordering
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_projects_sort_order ON projects(sort_order);

-- Add comments
COMMENT ON COLUMN projects.description IS 'Project description (encrypted client-side)';
COMMENT ON COLUMN projects.sort_order IS 'Display order for projects';
