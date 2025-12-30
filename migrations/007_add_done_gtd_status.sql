-- Add 'done' to the gtd_status options
-- Note: PostgreSQL text columns don't enforce enum values,
-- the constraint is in the application layer

COMMENT ON COLUMN todos.gtd_status IS 'GTD workflow status: inbox (unprocessed), next_action (ready to do), waiting_for (delegated/blocked), someday_maybe (future possibilities), done (completed)';
