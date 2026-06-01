import { z } from 'zod';

// ─── Topic ───────────────────────────────────────────────────────────────────

export const topicSchema = z.enum(['us-politics', 'entertainment', 'world-news']);

export type Topic = z.infer<typeof topicSchema>;

// ─── Request Body ─────────────────────────────────────────────────────────────

export const aiLoaderBodySchema = z.object({
  topic: topicSchema,
});

export type AiLoaderBody = z.infer<typeof aiLoaderBodySchema>;

// ─── OpenAI Response Shapes ───────────────────────────────────────────────────

export const feedStoryItemSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1),
    sources: z
      .array(z.string().min(1))
      .min(2),
  })
  .strict();

export type FeedStoryItem = z.infer<typeof feedStoryItemSchema>;

export const feedStoryBatchSchema = z
  .object({
    stories: z.array(feedStoryItemSchema).min(0).max(10),
  })
  .strict();

export type FeedStoryBatch = z.infer<typeof feedStoryBatchSchema>;

