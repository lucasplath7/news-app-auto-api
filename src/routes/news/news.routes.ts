import { Router } from 'express';
import { politicsRouter } from './politics/politics.routes.js';
import { aiLoaderRouter } from './aiLoader/aiLoader.routes.js';
import { aiPipelineLoaderRouter } from './aiPipelineLoader/aiPipelineLoader.routes.js';
import { feedStoriesRouter } from './feedStories/feedStories.routes.js';
import { pipelineFeedStoriesRouter } from './pipelineFeedStories/pipelineFeedStories.routes.js';

export const newsRouter = Router();

newsRouter.use('/politics', politicsRouter);
newsRouter.use('/ailoader', aiLoaderRouter);
newsRouter.use('/aipipelineloader', aiPipelineLoaderRouter);
newsRouter.use('/feed', feedStoriesRouter);
newsRouter.use('/pipelinefeed', pipelineFeedStoriesRouter);
