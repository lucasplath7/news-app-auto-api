import type { Request, Response } from "express";

export const healthCheckController = (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "Service is healthy",
    timestamp: new Date().toISOString()
  });
};

