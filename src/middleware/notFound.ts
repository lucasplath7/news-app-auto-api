import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError.js";

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, "Route not found"));
};

