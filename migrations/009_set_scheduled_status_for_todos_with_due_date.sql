-- Update existing todos with due dates to have 'scheduled' GTD status
-- This ensures consistency with the new behavior where due date requires scheduled status

UPDATE todos
SET gtd_status = 'scheduled'
WHERE due_date IS NOT NULL
  AND gtd_status != 'done';

-- Note: We exclude 'done' status to preserve completed todos
