-- Migration 015: Add project hierarchy support
-- Adds parent_id column to projects table for parent-child relationships (max 3 levels)

-- Add parent_id column for project hierarchy
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Index for efficient child lookups
CREATE INDEX IF NOT EXISTS idx_projects_parent_id ON projects(parent_id);
