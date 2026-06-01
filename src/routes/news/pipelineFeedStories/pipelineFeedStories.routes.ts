import { Router } from 'express';
import { validate } from '../../../middleware/validate.js';
import { getPipelineFeedStoriesQuerySchema } from '../../../schemas/news/pipelineFeedStories.schemas.js';
import { getPipelineFeedStoriesController } from '../../../controllers/news/pipelineFeedStories.controller.js';

export const pipelineFeedStoriesRouter = Router();

pipelineFeedStoriesRouter.get(
  '/',
  validate({ query: getPipelineFeedStoriesQuerySchema }),
  getPipelineFeedStoriesController,
);

