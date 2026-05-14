import { Router } from "express";
import { healthRouter } from "./health/health.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);


