import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { getPoliticsNewsQuerySchema } from "../../../schemas/news/politics.schemas.js";
import { getPoliticsNewsController } from "../../../controllers/news/politics.controller.js";

export const politicsRouter = Router();

politicsRouter.get("/", validate({ query: getPoliticsNewsQuerySchema }), getPoliticsNewsController);
