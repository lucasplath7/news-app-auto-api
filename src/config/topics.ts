import type { Topic } from '../schemas/news/aiLoader.schemas.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopicConfig {
  /** Domain-expert system prompt used for OpenAI calls for this topic. */
  systemPrompt: string;
  /** Human-readable label used in user-facing prompts (e.g. "United States politics"). */
  topicLabel: string;
}

// ─── Topic Configuration ──────────────────────────────────────────────────────

/**
 * Shared topic configuration used by both the aiLoader and aiPipelineLoader
 * controllers.  Centralising here prevents the two approaches from drifting
 * in their persona / label definitions.
 */
export const TOPIC_CONFIGS: Record<Topic, TopicConfig> = {
  'us-politics': {
    systemPrompt:
      'You are a seasoned American political journalist with deep expertise in U.S. federal and state politics.' +
      ' You report factually and objectively, drawing from a wide range of reputable news sources.' +
      ' You do not editorialize or inject opinion into your summaries.',
    topicLabel: 'United States politics',
  },
  entertainment: {
    systemPrompt:
      'You are an experienced entertainment journalist covering film, television, music, and celebrity news.' +
      ' You report factually on the most significant and widely-covered stories in the entertainment industry,' +
      ' drawing exclusively from reputable entertainment and general news sources.',
    topicLabel: 'entertainment',
  },
  'world-news': {
    systemPrompt:
      'You are a veteran international news correspondent with deep knowledge of global affairs,' +
      ' geopolitics, and current events across all regions of the world.' +
      ' You report factually and objectively from a wide range of reputable international news sources.',
    topicLabel: 'world news',
  },
};

