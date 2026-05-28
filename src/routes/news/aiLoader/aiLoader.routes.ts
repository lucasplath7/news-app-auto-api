import { Router } from 'express';
import { validate } from '../../../middleware/validate.js';
import { aiLoaderBodySchema } from '../../../schemas/news/aiLoader.schemas.js';
import { aiLoaderController } from '../../../controllers/news/aiLoader.controller.js';

export const aiLoaderRouter = Router();

aiLoaderRouter.post('/', validate({ body: aiLoaderBodySchema }), aiLoaderController);

