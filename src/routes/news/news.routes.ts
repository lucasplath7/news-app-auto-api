import { Router } from 'express';
import { politicsRouter } from './politics/politics.routes.js';
import { aiLoaderRouter } from './aiLoader/aiLoader.routes.js';
import { feedStoriesRouter } from './feedStories/feedStories.routes.js';

export const newsRouter = Router();

newsRouter.use('/politics', politicsRouter);
newsRouter.use('/ailoader', aiLoaderRouter);
newsRouter.use('/feed', feedStoriesRouter);

