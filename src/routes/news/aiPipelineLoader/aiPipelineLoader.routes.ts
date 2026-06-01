import { Router } from 'express';
import { validate } from '../../../middleware/validate.js';
import { aiLoaderBodySchema } from '../../../schemas/news/aiLoader.schemas.js';
import { aiPipelineLoaderController } from '../../../controllers/news/aiPipelineLoader.controller.js';

export const aiPipelineLoaderRouter = Router();

aiPipelineLoaderRouter.post(
  '/',
  validate({ body: aiLoaderBodySchema }),
  aiPipelineLoaderController,
);

