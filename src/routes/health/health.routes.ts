import { Router } from "express";
import { healthCheckController } from "../../controllers/health/health.controller.js";

export const healthRouter = Router();

healthRouter.get("/", healthCheckController);

