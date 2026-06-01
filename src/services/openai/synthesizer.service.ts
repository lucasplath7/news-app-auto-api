import { callStructuredOpenAI } from './openai.service.js';
import { synthesizedBriefBatchSchema } from '../../schemas/news/aiPipelineLoader.schemas.js';
import type { SynthesizedBriefBatch } from '../../schemas/news/aiPipelineLoader.schemas.js';
import type { CandidateCluster } from '../embedding/cluster.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoryBrief {
  title: string;
  summary: string;
  /** Real URLs sourced directly from cluster web-search results — never model-generated. */
  sources: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYNTHESIZER_MODEL = 'gpt-4.1-mini';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Synthesizes a 5-10 sentence news story brief for each qualifying cluster.
 * Sources are populated from real cluster URLs rather than from model output,
 * eliminating hallucinated source citations entirely.
 */
export async function synthesizeClusters(
  qualifyingClusters: CandidateCluster[],
  topicLabel: string,
  systemPrompt: string,
): Promise<StoryBrief[]> {
  if (qualifyingClusters.length === 0) return [];

  const clusterDescriptions = qualifyingClusters
    .map((cluster, clusterIndex) => {
      const sourceLines = cluster.candidates
        .map(
          (candidate, candidateIndex) =>
            `  ${candidateIndex + 1}. [${candidate.sourceDomain}] "${candidate.title}"\n` +
            `     Excerpt: "${candidate.snippet}"`,
        )
        .join('\n');
      return (
        `Cluster ${clusterIndex} (${cluster.candidates.length} sources: ` +
        `${cluster.candidates.map((candidate) => candidate.sourceDomain).join(', ')}):\n` +
        sourceLines
      );
    })
    .join('\n\n');

  const result = await callStructuredOpenAI<SynthesizedBriefBatch>({
    model: SYNTHESIZER_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'developer',
        content:
          'Respond ONLY in the specified JSON format.' +
          ' For each cluster, produce a comprehensive 5-10 sentence news story summary (the "summary" field)' +
          ' and a concise, descriptive title (the "title" field).' +
          ' Synthesize from the provided source titles and excerpts only — do not introduce external facts.' +
          ' Use the exact clusterIndex number shown for each cluster.' +
          ' Every cluster must produce exactly one story brief.',
      },
      {
        role: 'user',
        content:
          `Synthesize the following ${qualifyingClusters.length} ${topicLabel} story clusters into` +
          ` comprehensive news briefs:\n\n${clusterDescriptions}`,
      },
    ],
    batchSchema: synthesizedBriefBatchSchema,
    batchSchemaName: 'synthesized_brief_batch',
  });

  // Populate sources from real cluster URLs — never from model output.
  return result.briefs
    .filter(
      (brief) => brief.clusterIndex >= 0 && brief.clusterIndex < qualifyingClusters.length,
    )
    .map((brief) => {
      const cluster = qualifyingClusters[brief.clusterIndex]!;
      const uniqueSourceUrls = [
        ...new Set(cluster.candidates.map((candidate) => candidate.url)),
      ];
      return {
        title: brief.title,
        summary: brief.summary,
        sources: uniqueSourceUrls,
      };
    });
}

