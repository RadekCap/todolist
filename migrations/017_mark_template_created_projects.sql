-- Track projects created from project templates so the sidebar can offer a direct delete control.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS created_from_template BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN projects.created_from_template IS 'Whether this project was created from a project template';
