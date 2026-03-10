-- Migration: 003_change_user_id_to_text
-- The application uses browser-generated IDs (localStorage) as user_id.
-- When crypto.randomUUID() is unavailable the fallback produces "user_<ts>_<rand>"
-- which is not a valid UUID and causes PostgreSQL error 22P02.
-- Changing the column type to TEXT accepts any string identifier.

DROP INDEX IF EXISTS idx_documents_user_id;

ALTER TABLE documents
  ALTER COLUMN user_id TYPE TEXT USING user_id::text;

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents (user_id);
