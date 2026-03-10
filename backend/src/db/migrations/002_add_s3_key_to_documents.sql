-- Migration: 002_add_s3_key_to_documents
-- Adds the s3_key column so we can generate presigned download URLs
-- without reconstructing the key from the public URL.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS s3_key TEXT;

-- Back-fill: derive the key from the existing s3_url for old rows.
-- Format: https://<bucket>.s3.<region>.amazonaws.com/<key>
-- We extract everything after the third '/' segment.
UPDATE documents
SET s3_key = SUBSTRING(s3_url FROM 'https?://[^/]+/(.*)')
WHERE s3_key IS NULL;

-- Make s3_key NOT NULL going forward (safe because we just back-filled).
ALTER TABLE documents
  ALTER COLUMN s3_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_s3_key ON documents (s3_key);
