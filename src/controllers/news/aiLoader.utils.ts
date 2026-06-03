import type { FeedStoryItem } from '../../schemas/news/aiLoader.schemas.js';

export interface RecentStoryContext {
  title: string;
  excerpt: string;
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'were',
  'with',
]);

function keywordSet(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function overlapScore(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  const intersectionCount = [...left].filter((token) => right.has(token)).length;
  return intersectionCount / Math.min(left.size, right.size);
}

function isDuplicateStory(
  candidate: Pick<FeedStoryItem, 'title' | 'summary'>,
  existing: Pick<FeedStoryItem, 'title' | 'summary'>,
): boolean {
  const candidateTitle = candidate.title.trim().toLowerCase();
  const existingTitle = existing.title.trim().toLowerCase();
  if (candidateTitle === existingTitle) return true;

  const titleOverlap = overlapScore(keywordSet(candidate.title), keywordSet(existing.title));
  const summaryOverlap = overlapScore(keywordSet(candidate.summary), keywordSet(existing.summary));
  const combinedOverlap = overlapScore(
    keywordSet(`${candidate.title} ${candidate.summary}`),
    keywordSet(`${existing.title} ${existing.summary}`),
  );

  return combinedOverlap >= 0.72 || (titleOverlap >= 0.75 && summaryOverlap >= 0.55);
}

export function getDeduplicationWindowStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 2);
  return start;
}

export function filterStoriesForPersistence(
  stories: FeedStoryItem[],
  recentStories: RecentStoryContext[],
  today: string,
): FeedStoryItem[] {
  const seenStories: Array<Pick<FeedStoryItem, 'title' | 'summary'>> = recentStories.map(
    (story) => ({
      title: story.title,
      summary: story.excerpt,
    }),
  );

  const uniqueStories: FeedStoryItem[] = [];

  for (const story of stories) {
    const filteredSources = story.sources.filter((source) => !/wikipedia/i.test(source));
    if (filteredSources.length < 2) continue;
    if (story.publishedAt !== today) continue;

    const candidate = { ...story, sources: filteredSources };
    const isDuplicate = seenStories.some((existing) => isDuplicateStory(candidate, existing));
    if (isDuplicate) continue;

    uniqueStories.push(candidate);
    seenStories.push({ title: candidate.title, summary: candidate.summary });
  }

  return uniqueStories;
}
