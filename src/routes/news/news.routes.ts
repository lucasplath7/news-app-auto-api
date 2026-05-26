import { Router } from 'express';
import { politicsRouter } from './politics/politics.routes.js';

export const newsRouter = Router();

newsRouter.use('/politics', politicsRouter);

