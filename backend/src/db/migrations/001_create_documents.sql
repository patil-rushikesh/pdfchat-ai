-- Migration: 001_create_documents
-- Creates the documents table for PDF metadata storage.
-- Chat message history is stored in MongoDB (see mongoService.ts).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id      VARCHAR(64)   NOT NULL,
    user_id      UUID,                          -- NULL until auth is wired up
    file_name    TEXT          NOT NULL,
    s3_url       TEXT          NOT NULL,
    file_size    INTEGER       NOT NULL,
    uploaded_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_chat_id  ON documents (chat_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id  ON documents (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded ON documents (uploaded_at DESC);

-- ---------------------------------------------------------------------------
-- migration tracking (simple, no extra dependency)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
    id         SERIAL      PRIMARY KEY,
    name       VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
