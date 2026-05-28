import { Router } from 'express';
import { validate } from '../../../middleware/validate.js';
import { getFeedStoriesQuerySchema } from '../../../schemas/news/feedStories.schemas.js';
import { getFeedStoriesController } from '../../../controllers/news/feedStories.controller.js';

export const feedStoriesRouter = Router();

feedStoriesRouter.get('/', validate({ query: getFeedStoriesQuerySchema }), getFeedStoriesController);

