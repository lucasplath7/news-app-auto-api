-- Migration: Create newsapi.pipeline_feed_stories
-- Separate target table for stories produced by the aiPipelineLoader.
-- Kept distinct from newsapi.feed_stories to allow side-by-side quality comparison.

CREATE TABLE IF NOT EXISTS newsapi.pipeline_feed_stories (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id  UUID        NOT NULL,
  topic            TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  summary          TEXT        NOT NULL,
  sources          TEXT[]      NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_feed_stories_topic_created_at
  ON newsapi.pipeline_feed_stories (topic, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_feed_stories_pipeline_run
  ON newsapi.pipeline_feed_stories (pipeline_run_id);

ALTER TABLE newsapi.pipeline_feed_stories
  ADD CONSTRAINT chk_pipeline_feed_stories_topic
  CHECK (topic IN ('us-politics', 'entertainment', 'world-news'));

