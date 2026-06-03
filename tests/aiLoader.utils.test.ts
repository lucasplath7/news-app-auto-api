import { describe, expect, it } from 'vitest';
import {
  filterStoriesForPersistence,
  getDeduplicationWindowStart,
} from '../src/controllers/news/aiLoader.utils.js';
import type { FeedStoryItem } from '../src/schemas/news/aiLoader.schemas.js';

function story(overrides: Partial<FeedStoryItem>): FeedStoryItem {
  return {
    title: 'Default title',
    summary: 'Default summary with enough words for matching behavior.',
    publishedAt: '2026-06-03',
    sources: ['https://reuters.com/a', 'https://apnews.com/b'],
    ...overrides,
  };
}

describe('aiLoader utilities', () => {
  it('returns start of UTC day two days back for dedupe window', () => {
    const now = new Date('2026-06-03T18:22:57.849Z');
    const start = getDeduplicationWindowStart(now);
    expect(start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('filters out stories that are not published today', () => {
    const stories = [
      story({ title: 'Today story', publishedAt: '2026-06-03' }),
      story({ title: 'Old story', publishedAt: '2026-05-31' }),
    ];

    const filtered = filterStoriesForPersistence(stories, [], '2026-06-03');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe('Today story');
  });

  it('filters duplicate stories against recent context and current batch', () => {
    const recentStories = [
      {
        title: 'Trump Signs Executive Order on AI Oversight and Cybersecurity',
        excerpt:
          'President Trump signed an executive order on AI cybersecurity standards and federal pre-release review.',
      },
    ];

    const stories = [
      story({
        title: 'President Trump Signs Executive Order for Voluntary AI Model Pre-Release Review',
        summary:
          'On June 2, President Trump issued an executive order requiring voluntary frontier model sharing for cybersecurity review and federal benchmarking standards.',
      }),
      story({
        title: 'Supreme Court Rules on Federal Environmental Permitting Limits',
        summary:
          'The Supreme Court narrowed federal environmental permitting authority in a major decision expected to affect energy infrastructure projects nationwide.',
      }),
      story({
        title: 'Supreme Court limits federal permitting authority in major energy case',
        summary:
          'A major Supreme Court decision limits federal environmental permitting powers and is expected to reshape approvals for nationwide energy projects.',
      }),
    ];

    const filtered = filterStoriesForPersistence(stories, recentStories, '2026-06-03');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe(
      'Supreme Court Rules on Federal Environmental Permitting Limits',
    );
  });
});
