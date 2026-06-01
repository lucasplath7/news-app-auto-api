-- Migration: Create newsapi.candidate_stories
-- Audit table for every candidate article examined by the aiPipelineLoader,
-- including classification scores and cluster assignments.

CREATE TABLE IF NOT EXISTS newsapi.candidate_stories (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id  UUID        NOT NULL,
  topic            TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  url              TEXT        NOT NULL,
  snippet          TEXT        NOT NULL,
  source_domain    TEXT        NOT NULL,
  legitimacy_score NUMERIC(4,3),
  is_duplicate     BOOLEAN,
  sub_topic        TEXT,
  cluster_id       UUID,
  status           TEXT        NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_stories_pipeline_run
  ON newsapi.candidate_stories (pipeline_run_id);

CREATE INDEX IF NOT EXISTS idx_candidate_stories_topic_status
  ON newsapi.candidate_stories (topic, status);

ALTER TABLE newsapi.candidate_stories
  ADD CONSTRAINT chk_candidate_stories_topic
  CHECK (topic IN ('us-politics', 'entertainment', 'world-news'));

ALTER TABLE newsapi.candidate_stories
  ADD CONSTRAINT chk_candidate_stories_status
  CHECK (status IN ('pending', 'rejected', 'classified', 'synthesized'));

