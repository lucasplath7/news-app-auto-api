import { randomUUID } from 'node:crypto';
import type { CandidateStory, ClassificationItem } from '../../schemas/news/aiPipelineLoader.schemas.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClassifiedCandidate extends CandidateStory {
  legitimacyScore: number;
  isDuplicate: boolean;
  subTopic: string;
}

export interface CandidateWithEmbedding extends ClassifiedCandidate {
  embedding: number[];
}

export interface CandidateCluster {
  clusterId: string;
  candidates: CandidateWithEmbedding[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SIMILARITY_THRESHOLD = 0.82;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i]! * vectorB[i]!;
    magnitudeA += vectorA[i]! * vectorA[i]!;
    magnitudeB += vectorB[i]! * vectorB[i]!;
  }
  const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Merges classifier output back onto the original candidate list using
 * candidateIndex as the join key.  Candidates with no matching classification
 * receive a legitimacyScore of 0 so the threshold filter excludes them rather
 * than silently passing them through.
 */
export function mergeClassifications(
  candidates: CandidateStory[],
  classifications: ClassificationItem[],
): ClassifiedCandidate[] {
  const classificationByIndex = new Map(
    classifications.map((classification) => [classification.candidateIndex, classification]),
  );

  return candidates.map((candidate, index) => {
    const classification = classificationByIndex.get(index);
    return {
      ...candidate,
      legitimacyScore: classification?.legitimacyScore ?? 0,
      isDuplicate: classification?.isDuplicate ?? false,
      subTopic: classification?.subTopic ?? 'unknown',
    };
  });
}

/**
 * Groups candidates by cosine similarity of their embeddings using a greedy
 * O(n²) algorithm — appropriate for the expected batch size of ≤ 30 candidates.
 *
 * Candidates whose embeddings exceed `similarityThreshold` (default 0.85) are
 * considered to cover the same real-world story and are placed in the same cluster.
 */
export function clusterBySimilarity(
  candidates: CandidateWithEmbedding[],
  similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
): CandidateCluster[] {
  const assignedIndices = new Set<number>();
  const clusters: CandidateCluster[] = [];

  for (let primaryIndex = 0; primaryIndex < candidates.length; primaryIndex++) {
    if (assignedIndices.has(primaryIndex)) continue;

    const clusterMembers: CandidateWithEmbedding[] = [candidates[primaryIndex]!];
    assignedIndices.add(primaryIndex);

    for (
      let secondaryIndex = primaryIndex + 1;
      secondaryIndex < candidates.length;
      secondaryIndex++
    ) {
      if (assignedIndices.has(secondaryIndex)) continue;
      const similarity = cosineSimilarity(
        candidates[primaryIndex]!.embedding,
        candidates[secondaryIndex]!.embedding,
      );
      if (similarity >= similarityThreshold) {
        clusterMembers.push(candidates[secondaryIndex]!);
        assignedIndices.add(secondaryIndex);
      }
    }

    clusters.push({ clusterId: randomUUID(), candidates: clusterMembers });
  }

  return clusters;
}
