import { callStructuredOpenAI } from './openai.service.js';
import { classificationBatchSchema } from '../../schemas/news/aiPipelineLoader.schemas.js';
import type { CandidateStory, ClassificationItem } from '../../schemas/news/aiPipelineLoader.schemas.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CLASSIFIER_MODEL = 'gpt-4.1-nano';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Classifies a batch of raw candidate stories for legitimacy, duplication,
 * and sub-topic tagging using a low-cost nano model.
 * Returns one ClassificationItem per candidate, keyed by candidateIndex.
 */
export async function classifyCandidates(
  candidates: CandidateStory[],
  topicLabel: string,
): Promise<ClassificationItem[]> {
  const candidateList = candidates
    .map(
      (candidate, index) =>
        `${index}. [${candidate.sourceDomain}] "${candidate.title}"\n   Excerpt: "${candidate.snippet}"`,
    )
    .join('\n');

  const result = await callStructuredOpenAI({
    model: CLASSIFIER_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a news quality classifier. You evaluate news article candidates for source credibility' +
          ' and determine whether articles in a batch are substantively duplicating each other.',
      },
      {
        role: 'developer',
        content:
          'Respond ONLY in the specified JSON format.' +
          ' For every candidate (identified by its numeric index), provide:' +
          ' - candidateIndex: the index number as shown.' +
          ' - legitimacyScore: 0.0–1.0 rating of how credible and factually reliable this source and story appears.' +
          ' - isDuplicate: true ONLY if this article is substantively identical to a lower-indexed article already in the list.' +
          ' - subTopic: a concise tag for the specific sub-topic (e.g. "supreme court ruling", "box office results").' +
          ' You must return exactly one classification per candidate index — no omissions.',
      },
      {
        role: 'user',
        content: `Classify the following ${topicLabel} news article candidates:\n\n${candidateList}`,
      },
    ],
    batchSchema: classificationBatchSchema,
    batchSchemaName: 'classification_batch',
  });

  return result.classifications;
}

