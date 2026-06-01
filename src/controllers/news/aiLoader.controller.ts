import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { callStructuredOpenAI } from '../../services/openai/openai.service.js';
import { db } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import type { ChatMessage } from '../../utils/streamStructuredResponse.js';
import { TOPIC_CONFIGS } from '../../config/topics.js';
import { feedStoryBatchSchema } from '../../schemas/news/aiLoader.schemas.js';
import type { AiLoaderBody, FeedStoryBatch, Topic } from '../../schemas/news/aiLoader.schemas.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const AILOADER_MODEL = 'gpt-4.1';
const AILOADER_PROMPT_VERSION = 'v1';
const EXCERPT_LENGTH = 200;
const DEDUPLICATION_CONTEXT_SIZE = 30;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecentStoryContext {
  title: string;
  excerpt: string;
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildLoaderMessages(topic: Topic, recentStories: RecentStoryContext[]): ChatMessage[] {
  const { systemPrompt, topicLabel } = TOPIC_CONFIGS[topic];
  const today = new Date().toISOString().split('T')[0];

  const deduplicationBlock =
    recentStories.length > 0
      ? '\n\nThe following stories have already been covered and stored. Do NOT generate a story for a topic unless there has been a MATERIAL NEW DEVELOPMENT — a significant new outcome, revelation, or event that meaningfully changes the nature of the story. A minor update, restatement, or additional reaction does NOT qualify as a material change:\n' +
        recentStories
          .map(
            (story, index) =>
              `${index + 1}. Title: "${story.title}"\n   Excerpt: "${story.excerpt}"`,
          )
          .join('\n')
      : '';

  return [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'developer',
      content:
        'When you answer, respond ONLY in the specified JSON format.' +
        ' Each story summary must be 5–10 sentences long and provide adequate factual detail.' +
        ' Each story must be corroborated by at least 3 reputable news sources — list the source URLs.' +
        ' Every source URL cited for a story must be unique — do not repeat the same domain, outlet, or URL more than once within a single story.' +
        ' Do not use Wikipedia as a source.' +
        ' Target 10 stories. If fewer than 10 qualify as genuinely new, return only those that do.' +
        ' Do not pad the response with rehashed, duplicate, or marginally updated stories.' +
        deduplicationBlock,
    },
    {
      role: 'user',
      content:
        `Find the 10 most significant and widely-covered ${topicLabel} stories of today (${today}).` +
        ' Use web search to find the latest breaking and developing news.' +
        ' Prioritise stories with the broadest impact and highest public interest.',
    },
  ];
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const aiLoaderController = asyncHandler(
  async (req: Request<{}, {}, AiLoaderBody>, res: Response) => {
    const { topic } = req.body;
    const requestedAt = new Date().toISOString();

    // 1. Fetch recent stories for deduplication context
    const recentRows = await db
      .selectFrom('newsapi.feed_stories')
      .select(['title', 'summary'])
      .where('topic', '=', topic)
      .orderBy('created_at', 'desc')
      .limit(DEDUPLICATION_CONTEXT_SIZE)
      .execute();

    const recentStories: RecentStoryContext[] = recentRows.map((row) => ({
      title: row.title,
      excerpt: row.summary.slice(0, EXCERPT_LENGTH),
    }));

    logger.info('aiLoader: fetched deduplication context', {
      topic,
      recentStoriesCount: recentStories.length,
    });

    // 2. Build messages with deduplication context embedded
    const messages = buildLoaderMessages(topic, recentStories);

    // 3. Call OpenAI and parse the structured batch
    const batch = await callStructuredOpenAI<FeedStoryBatch>({
      model: AILOADER_MODEL,
      messages,
      batchSchema: feedStoryBatchSchema,
      batchSchemaName: 'feed_story_batch',
      tools: [{ type: 'web_search' }],
    });

    // 4. Filter out Wikipedia sources from stories
    batch.stories = batch.stories
      .map((story) => ({
        ...story,
        sources: story.sources.filter((source) => !/wikipedia/i.test(source)),
      }))
      .filter((story) => story.sources.length >= 2);

    logger.info('aiLoader: OpenAI returned stories', {
      topic,
      returnedCount: batch.stories.length,
      promptVersion: AILOADER_PROMPT_VERSION,
    });

    // 4. Persist stories to the database
    let savedCount = 0;
    if (batch.stories.length > 0) {
      await db
        .insertInto('newsapi.feed_stories')
        .values(
          batch.stories.map((story) => ({
            topic,
            title: story.title,
            summary: story.summary,
            sources: story.sources,
          })),
        )
        .execute();

      savedCount = batch.stories.length;
    }

    if (savedCount === 0) {
      logger.warn('aiLoader: no new stories were saved — all results were duplicates or empty', {
        topic,
      });
    }

    res.status(200).json({ topic, savedCount, requestedAt });
  },
);
