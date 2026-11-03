-- Add indexes for foreign-key columns used in reviewer/actor joins and FK checks.
CREATE INDEX IF NOT EXISTS data_deletion_requests_reviewed_by_idx
  ON private.data_deletion_requests (reviewed_by);

CREATE INDEX IF NOT EXISTS feedback_versions_changed_by_idx
  ON private.feedback_versions (changed_by);
