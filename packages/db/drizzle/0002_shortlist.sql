-- Add shortlisted_at column to applications + supporting index.
-- Recruiters can mark applications as shortlisted; null = not shortlisted.

ALTER TABLE applications
  ADD COLUMN shortlisted_at timestamptz;

CREATE INDEX IF NOT EXISTS applications_shortlisted_idx
  ON applications (shortlisted_at)
  WHERE shortlisted_at IS NOT NULL;
