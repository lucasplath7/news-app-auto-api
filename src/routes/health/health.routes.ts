import { Router } from "express";
import { healthCheckController } from "../../controllers/health/health.controller.js";
import { dbHealthCheckController } from "../../controllers/health/dbHealth.controller.js";

export const healthRouter = Router();

healthRouter.get("/", healthCheckController);
healthRouter.get("/db", dbHealthCheckController);

