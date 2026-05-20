import { Router } from "express";
import {
  getCounterController,
  incrementCounterController,
  decrementCounterController
} from "../../controllers/counter/counter.controller.js";

export const counterRouter = Router();

counterRouter.get("/", getCounterController);
counterRouter.post("/increment", incrementCounterController);
counterRouter.post("/decrement", decrementCounterController);

