import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { db } from '../../config/db.js';
import type { GetFeedStoriesQuery } from '../../schemas/news/feedStories.schemas.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Controller ───────────────────────────────────────────────────────────────

export const getFeedStoriesController = asyncHandler(
  async (req: Request, res: Response) => {
    // req.query is cast here because the validate middleware has already
    // coerced and validated the shape against getFeedStoriesQuerySchema
    const { topic, page } = req.query as unknown as GetFeedStoriesQuery;

    // Fetch one extra row to determine if a next page exists
    const rows = await db
      .selectFrom('newsapi.feed_stories')
      .selectAll()
      .where('topic', '=', topic)
      .orderBy('created_at', 'desc')
      .limit(PAGE_SIZE + 1)
      .offset(page * PAGE_SIZE)
      .execute();

    const hasMore = rows.length > PAGE_SIZE;
    const stories = rows.slice(0, PAGE_SIZE).map((row) => ({
      id: row.id,
      topic: row.topic,
      title: row.title,
      summary: row.summary,
      sources: row.sources,
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    }));

    res.status(200).json({ topic, page, stories, hasMore });
  },
);


