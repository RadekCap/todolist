-- Add area_id column to projects table for associating projects with areas
-- When an area is deleted, projects become unassigned (area_id = NULL)

ALTER TABLE projects ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;

-- Create index for faster filtering by area
CREATE INDEX IF NOT EXISTS idx_projects_area_id ON projects(area_id);

-- Add comment
COMMENT ON COLUMN projects.area_id IS 'Reference to area of life/responsibility (nullable, unassigned if NULL)';
