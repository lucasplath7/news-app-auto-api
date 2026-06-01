import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { db } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import { TOPIC_CONFIGS } from '../../config/topics.js';
import { fetchWebSearchCandidates } from '../../services/search/webSearch.service.js';
import { classifyCandidates } from '../../services/openai/classifier.service.js';
import { generateEmbeddings } from '../../services/embedding/embedding.service.js';
import {
  mergeClassifications,
  clusterBySimilarity,
} from '../../services/embedding/cluster.service.js';
import type { CandidateCluster, CandidateWithEmbedding } from '../../services/embedding/cluster.service.js';
import { synthesizeClusters } from '../../services/openai/synthesizer.service.js';
import type { AiLoaderBody } from '../../schemas/news/aiLoader.schemas.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEGITIMACY_THRESHOLD = 0.6;
const IDEAL_CLUSTER_SOURCE_DOMAINS = 3;
const FALLBACK_CLUSTER_SOURCE_DOMAINS = 2;
const MAX_FALLBACK_CLUSTERS = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ScoredCluster {
  cluster: CandidateCluster;
  uniqueSourceDomains: number;
  averageLegitimacyScore: number;
  candidateCount: number;
}

function scoreClusters(clusters: CandidateCluster[]): ScoredCluster[] {
  return clusters.map((cluster) => {
    const uniqueSourceDomains = new Set(
      cluster.candidates.map((candidate) => candidate.sourceDomain),
    ).size;
    const averageLegitimacyScore =
      cluster.candidates.reduce((sum, candidate) => sum + candidate.legitimacyScore, 0) /
      cluster.candidates.length;

    return {
      cluster,
      uniqueSourceDomains,
      averageLegitimacyScore,
      candidateCount: cluster.candidates.length,
    };
  });
}

function selectClustersForSynthesis(clusters: CandidateCluster[]): {
  selectedClusters: CandidateCluster[];
  selectionTier: 'ideal' | 'fallback' | 'best-effort' | 'none';
} {
  const scoredClusters = scoreClusters(clusters);

  const idealClusters = scoredClusters
    .filter((scoredCluster) => scoredCluster.uniqueSourceDomains >= IDEAL_CLUSTER_SOURCE_DOMAINS)
    .sort((left, right) => right.averageLegitimacyScore - left.averageLegitimacyScore)
    .map((scoredCluster) => scoredCluster.cluster);

  if (idealClusters.length > 0) {
    return { selectedClusters: idealClusters, selectionTier: 'ideal' };
  }

  const fallbackClusters = scoredClusters
    .filter((scoredCluster) => scoredCluster.uniqueSourceDomains >= FALLBACK_CLUSTER_SOURCE_DOMAINS)
    .sort(
      (left, right) =>
        right.uniqueSourceDomains - left.uniqueSourceDomains ||
        right.averageLegitimacyScore - left.averageLegitimacyScore ||
        right.candidateCount - left.candidateCount,
    )
    .slice(0, MAX_FALLBACK_CLUSTERS)
    .map((scoredCluster) => scoredCluster.cluster);

  if (fallbackClusters.length > 0) {
    return { selectedClusters: fallbackClusters, selectionTier: 'fallback' };
  }

  const bestEffortClusters = scoredClusters
    .sort(
      (left, right) =>
        right.averageLegitimacyScore - left.averageLegitimacyScore ||
        right.candidateCount - left.candidateCount,
    )
    .slice(0, MAX_FALLBACK_CLUSTERS)
    .map((scoredCluster) => scoredCluster.cluster);

  if (bestEffortClusters.length > 0) {
    return { selectedClusters: bestEffortClusters, selectionTier: 'best-effort' };
  }

  return { selectedClusters: [], selectionTier: 'none' };
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const aiPipelineLoaderController = asyncHandler(
  async (req: Request<{}, {}, AiLoaderBody>, res: Response) => {
    const { topic } = req.body;
    const requestedAt = new Date().toISOString();
    const pipelineRunId = randomUUID();
    const today = new Date().toISOString().split('T')[0]!;
    const topicConfig = TOPIC_CONFIGS[topic];

    logger.info('aiPipelineLoader: pipeline run started', { topic, pipelineRunId });

    // ── Stage 1: Web search → raw candidates ────────────────────────────────
    const rawCandidates = await fetchWebSearchCandidates(topic, today);
    logger.info('aiPipelineLoader: fetched candidates', {
      count: rawCandidates.length,
      pipelineRunId,
    });

    // ── Stage 2: Classify, score, and dedupe candidates ─────────────────────
    const classifications = await classifyCandidates(rawCandidates, topicConfig.topicLabel);
    const classifiedCandidates = mergeClassifications(rawCandidates, classifications);
    const survivingCandidates = classifiedCandidates.filter(
      (candidate) =>
        !candidate.isDuplicate && candidate.legitimacyScore >= LEGITIMACY_THRESHOLD,
    );
    logger.info('aiPipelineLoader: classified candidates', {
      total: classifiedCandidates.length,
      surviving: survivingCandidates.length,
      rejected: classifiedCandidates.length - survivingCandidates.length,
      pipelineRunId,
    });

    // ── Stage 3: Generate embeddings and cluster by semantic similarity ──────
    const embeddingTexts = survivingCandidates.map(
      (candidate) => `${candidate.title} ${candidate.snippet}`,
    );
    const embeddings = await generateEmbeddings(embeddingTexts);
    const candidatesWithEmbeddings: CandidateWithEmbedding[] = survivingCandidates.map(
      (candidate, index) => ({ ...candidate, embedding: embeddings[index]! }),
    );
    const clusters = clusterBySimilarity(candidatesWithEmbeddings);
    logger.info('aiPipelineLoader: clustered candidates', {
      clusterCount: clusters.length,
      pipelineRunId,
    });

    // ── Stage 4: Select clusters using ideal → fallback → best-effort tiers ──
    const { selectedClusters, selectionTier } = selectClustersForSynthesis(clusters);
    logger.info('aiPipelineLoader: clusters selected for synthesis', {
      selected: selectedClusters.length,
      total: clusters.length,
      selectionTier,
      pipelineRunId,
    });

    const synthesizedStories = await synthesizeClusters(
      selectedClusters,
      topicConfig.topicLabel,
      topicConfig.systemPrompt,
    );

    // ── Stage 5: Persist synthesized stories to pipeline_feed_stories ────────
    let savedCount = 0;
    if (synthesizedStories.length > 0) {
      await db
        .insertInto('newsapi.pipeline_feed_stories')
        .values(
          synthesizedStories.map((story) => ({
            pipeline_run_id: pipelineRunId,
            topic,
            title: story.title,
            summary: story.summary,
            sources: story.sources,
          })),
        )
        .execute();
      savedCount = synthesizedStories.length;
    }

    // ── Audit: persist all candidates with their pipeline metadata ────────────
    const synthesizedClusterIds = new Set(selectedClusters.map((cluster) => cluster.clusterId));
    const clusterIdByUrl = new Map(
      clusters.flatMap((cluster) =>
        cluster.candidates.map((candidate) => [candidate.url, cluster.clusterId]),
      ),
    );

    if (classifiedCandidates.length > 0) {
      await db
        .insertInto('newsapi.candidate_stories')
        .values(
          classifiedCandidates.map((candidate) => {
            const clusterId = clusterIdByUrl.get(candidate.url) ?? null;
            const isRejected =
              candidate.isDuplicate || candidate.legitimacyScore < LEGITIMACY_THRESHOLD;
            const status = isRejected
              ? 'rejected'
              : clusterId !== null && synthesizedClusterIds.has(clusterId)
                ? 'synthesized'
                : 'classified';
            return {
              pipeline_run_id: pipelineRunId,
              topic,
              title: candidate.title,
              url: candidate.url,
              snippet: candidate.snippet,
              source_domain: candidate.sourceDomain,
              legitimacy_score: candidate.legitimacyScore,
              is_duplicate: candidate.isDuplicate,
              sub_topic: candidate.subTopic,
              cluster_id: clusterId,
              status,
            };
          }),
        )
        .execute();
    }

    if (savedCount === 0) {
      logger.warn('aiPipelineLoader: no stories synthesized — check cluster quality', {
        topic,
        pipelineRunId,
        selectionTier,
      });
    }

    logger.info('aiPipelineLoader: pipeline run completed', {
      topic,
      pipelineRunId,
      savedCount,
      selectionTier,
    });

    res.status(200).json({ topic, savedCount, pipelineRunId, requestedAt });
  },
);
