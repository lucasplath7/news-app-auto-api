import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { db } from '../../config/db.js';
import type { GetPipelineFeedStoriesQuery } from '../../schemas/news/pipelineFeedStories.schemas.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Controller ───────────────────────────────────────────────────────────────

export const getPipelineFeedStoriesController = asyncHandler(
  async (req: Request, res: Response) => {
    const { topic, page } = req.query as unknown as GetPipelineFeedStoriesQuery;

    const rows = await db
      .selectFrom('newsapi.pipeline_feed_stories')
      .selectAll()
      .where('topic', '=', topic)
      .orderBy('created_at', 'desc')
      .limit(PAGE_SIZE + 1)
      .offset(page * PAGE_SIZE)
      .execute();

    const hasMore = rows.length > PAGE_SIZE;
    const stories = rows.slice(0, PAGE_SIZE).map((row) => ({
      id: row.id,
      pipelineRunId: row.pipeline_run_id,
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

