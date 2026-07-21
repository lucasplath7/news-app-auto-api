import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CandidateCluster } from '../src/services/embedding/cluster.service.js';

const { callStructuredOpenAIMock } = vi.hoisted(() => ({
  callStructuredOpenAIMock: vi.fn(),
}));

vi.mock('../src/services/openai/openai.service.js', () => ({
  callStructuredOpenAI: callStructuredOpenAIMock,
}));

import { synthesizeClusters } from '../src/services/openai/synthesizer.service.js';

function makeCluster(
  clusterId: string,
  entries: Array<{ title: string; url: string; sourceDomain: string; snippet: string }>,
): CandidateCluster {
  return {
    clusterId,
    candidates: entries.map((entry, index) => ({
      title: entry.title,
      url: entry.url,
      snippet: entry.snippet,
      sourceDomain: entry.sourceDomain,
      legitimacyScore: 0.9,
      isDuplicate: false,
      subTopic: `topic-${index}`,
      embedding: [1, 0, index],
    })),
  };
}

describe('synthesizeClusters', () => {
  beforeEach(() => {
    callStructuredOpenAIMock.mockReset();
  });

  it('keeps only one brief per cluster index and ignores out-of-range indices', async () => {
    const clusters: CandidateCluster[] = [
      makeCluster('cluster-1', [
        {
          title: 'Story A',
          url: 'https://example.com/a1',
          sourceDomain: 'example.com',
          snippet: 'Snippet A1.',
        },
      ]),
      makeCluster('cluster-2', [
        {
          title: 'Story B',
          url: 'https://example.com/b1',
          sourceDomain: 'example.com',
          snippet: 'Snippet B1.',
        },
      ]),
    ];

    callStructuredOpenAIMock.mockResolvedValue({
      briefs: [
        { clusterIndex: 0, title: 'Brief A', summary: 'Summary A.' },
        { clusterIndex: 0, title: 'Duplicate Brief A', summary: 'Duplicate summary.' },
        { clusterIndex: 1, title: 'Brief B', summary: 'Summary B.' },
        { clusterIndex: 99, title: 'Invalid', summary: 'Should be ignored.' },
      ],
    });

    const briefs = await synthesizeClusters(clusters, 'world news', 'system prompt');

    expect(briefs).toEqual([
      { title: 'Brief A', summary: 'Summary A.', sources: ['https://example.com/a1'] },
      { title: 'Brief B', summary: 'Summary B.', sources: ['https://example.com/b1'] },
    ]);
  });

  it('uses only deduplicated real cluster URLs as sources', async () => {
    const clusters: CandidateCluster[] = [
      makeCluster('cluster-1', [
        {
          title: 'Story A',
          url: 'https://source-a.com/story',
          sourceDomain: 'source-a.com',
          snippet: 'Snippet A.',
        },
        {
          title: 'Story A follow-up',
          url: 'https://source-a.com/story',
          sourceDomain: 'source-a.com',
          snippet: 'Snippet A follow-up.',
        },
        {
          title: 'Story A alt',
          url: 'https://source-b.com/story',
          sourceDomain: 'source-b.com',
          snippet: 'Snippet from source B.',
        },
      ]),
    ];

    callStructuredOpenAIMock.mockResolvedValue({
      briefs: [{ clusterIndex: 0, title: 'Brief A', summary: 'Summary A.' }],
    });

    const briefs = await synthesizeClusters(clusters, 'world news', 'system prompt');

    expect(briefs).toEqual([
      {
        title: 'Brief A',
        summary: 'Summary A.',
        sources: ['https://source-a.com/story', 'https://source-b.com/story'],
      },
    ]);
  });
});
