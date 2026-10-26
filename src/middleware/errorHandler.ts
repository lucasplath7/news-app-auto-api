import type { NextFunction, Request, Response } from "express";
import type { ApiErrorShape } from "../types/api.js";
import { AppError } from "../utils/appError.js";
import { logger } from "../config/logger.js";
import { getErrorDetails } from "../utils/errorDetails.js";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response<ApiErrorShape>,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, err.details);
    }

    return res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      details: err.details
    });
  }

  const errorDetails = getErrorDetails(err);
  logger.error("Unhandled server error", errorDetails);

  return res.status(500).json({
    statusCode: 500,
    message: "Internal server error"
  });
};

