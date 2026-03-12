-- Migration 016: Project Templates
-- Allows users to create reusable project templates with pre-defined todo items.
-- When applied, a template creates a new project with copies of all template items.

CREATE TABLE project_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Row Level Security
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_templates" ON project_templates
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_templates" ON project_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_templates" ON project_templates
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_templates" ON project_templates
    FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE project_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_template_items" ON project_template_items
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_template_items" ON project_template_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_template_items" ON project_template_items
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_template_items" ON project_template_items
    FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_template_items_template_id ON project_template_items(template_id);
CREATE INDEX idx_project_templates_user_id ON project_templates(user_id);
