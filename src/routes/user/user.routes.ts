import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { createUserSchema } from "../../schemas/user/user.schemas.js";
import { createUserController } from "../../controllers/user/user.controller.js";

export const userRouter = Router();

userRouter.post("/", validate({ body: createUserSchema }), createUserController);


