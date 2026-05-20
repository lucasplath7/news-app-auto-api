import type { Request, Response } from "express";
import { redis, COUNTER_KEY, COUNTER_CHANNEL } from "../../config/redis.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const getCounterController = asyncHandler(async (_req: Request, res: Response) => {
  const value = await redis.get(COUNTER_KEY);
  res.status(200).json({ counter: value ?? "0" });
});

export const incrementCounterController = asyncHandler(async (_req: Request, res: Response) => {
  const value = await redis.incr(COUNTER_KEY);
  await redis.publish(COUNTER_CHANNEL, String(value));
  res.status(200).json({ counter: String(value) });
});

export const decrementCounterController = asyncHandler(async (_req: Request, res: Response) => {
  const value = await redis.decr(COUNTER_KEY);
  await redis.publish(COUNTER_CHANNEL, String(value));
  res.status(200).json({ counter: String(value) });
});

