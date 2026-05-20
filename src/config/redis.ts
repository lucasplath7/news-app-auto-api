import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

export const COUNTER_KEY = "counter";
export const COUNTER_CHANNEL = "counter:updated";

const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  lazyConnect: true
};

export const redis = new Redis(redisConfig);
export const redisSub = new Redis(redisConfig);

redis.on("connect", () => logger.info("Redis client connected"));
redis.on("error", (err) => logger.error("Redis client error", err));

redisSub.on("connect", () => logger.info("Redis subscriber connected"));
redisSub.on("error", (err) => logger.error("Redis subscriber error", err));


