import type { Request, Response } from "express";
import { db } from "../../config/db.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/appError.js";

export const dbHealthCheckController = asyncHandler(async (_req: Request, res: Response) => {
  const row = await db
    .selectFrom("newsapi.test_table")
    .select("test_strings")
    .limit(1)
    .executeTakeFirst();

  if (!row) {
    throw new AppError(404, "No records found in newsapi.test_table");
  }

  res.status(200).json({
    status: "ok",
    message: "Database is healthy",
    data: row.test_strings,
    timestamp: new Date().toISOString()
  });
});
