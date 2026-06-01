import { callStructuredOpenAI } from '../openai/openai.service.js';
import { TOPIC_CONFIGS } from '../../config/topics.js';
import { candidateBatchSchema } from '../../schemas/news/aiPipelineLoader.schemas.js';
import type { CandidateStory } from '../../schemas/news/aiPipelineLoader.schemas.js';
import type { Topic } from '../../schemas/news/aiLoader.schemas.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEB_SEARCH_MODEL = 'gpt-4.1-mini';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Uses OpenAI with the web_search tool to find 20–30 real news article
 * candidates for the given topic and date.  Returns raw candidates for
 * downstream classification and clustering — no summarisation at this stage.
 */
export async function fetchWebSearchCandidates(
  topic: Topic,
  today: string,
): Promise<CandidateStory[]> {
  const { topicLabel } = TOPIC_CONFIGS[topic];

  const result = await callStructuredOpenAI({
    model: WEB_SEARCH_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a news research assistant. Your job is to find real news articles published today.' +
          ' You must use web search to find actual articles — do not fabricate URLs or headlines.',
      },
      {
        role: 'developer',
        content:
          'Respond ONLY in the specified JSON format.' +
          ' For each article found, provide the exact URL, exact headline, a 1-2 sentence snippet,' +
          ' and the source domain (e.g. "reuters.com").' +
          ' Only include articles published today.' +
          ' Deliberately include multiple articles from different outlets covering the same major stories —' +
          ' this is intentional, as downstream processing will cluster them.' +
          ' Do not fabricate or guess URLs — only return URLs confirmed via web search.',
      },
      {
        role: 'user',
        content:
          `Search for 20–30 of the most significant ${topicLabel} news articles published today (${today}).` +
          ' Use web search. Include multiple sources covering the same major stories.',
      },
    ],
    batchSchema: candidateBatchSchema,
    batchSchemaName: 'candidate_batch',
    tools: [{ type: 'web_search' }],
  });

  return result.candidates;
}

