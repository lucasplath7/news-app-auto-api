import { Router } from "express";
import { healthRouter } from "./health/health.routes.js";
import { userRouter } from "./user/user.routes.js";
import { counterRouter } from "./counter/counter.routes.js";
import { newsRouter } from "./news/news.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/user", userRouter);
apiRouter.use("/counter", counterRouter);
apiRouter.use("/news", newsRouter);
