
import type { Request, Response } from "express";
import { pool } from "../../config/db.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/appError.js";

export const dbHealthCheckController = asyncHandler(async (_req: Request, res: Response) => {
  const result = await pool.query<{ test_strings: string }>(
    "SELECT test_strings FROM newsapi.test_table LIMIT 1"
  );

  if (result.rows.length === 0) {
    throw new AppError(404, "No records found in newsapi.test_table");
  }

  res.status(200).json({
    status: "ok",
    message: "Database is healthy",
    data: result.rows[0].test_strings,
    timestamp: new Date().toISOString()
  });
});

