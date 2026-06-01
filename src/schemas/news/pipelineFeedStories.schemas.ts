import { z } from 'zod';
import { topicSchema } from './aiLoader.schemas.js';

export const getPipelineFeedStoriesQuerySchema = z.object({
  topic: topicSchema,
  page: z.coerce.number().int().min(0).default(0),
});

export type GetPipelineFeedStoriesQuery = z.infer<typeof getPipelineFeedStoriesQuerySchema>;

