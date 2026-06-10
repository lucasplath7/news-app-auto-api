import { Router } from "express";
import { healthRouter } from "./health/health.routes.js";
import { newsRouter } from "./news/news.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/news", newsRouter);
