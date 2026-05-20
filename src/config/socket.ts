import type { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { redis, redisSub, COUNTER_KEY, COUNTER_CHANNEL } from "./redis.js";
import { logger } from "./logger.js";

export let io: SocketServer;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: "*" }
  });

  redisSub.subscribe(COUNTER_CHANNEL, (err: Error | null | undefined) => {
    if (err) logger.error("Failed to subscribe to counter channel", err);
  });

  redisSub.on("message", (channel: string, message: string) => {
    if (channel === COUNTER_CHANNEL) {
      io.emit("counter:value", { value: message });
    }
  });

  io.on("connection", async (socket) => {
    logger.info("Socket client connected", { id: socket.id });

    const value = await redis.get(COUNTER_KEY);
    socket.emit("counter:value", { value: value ?? "0" });

    socket.on("disconnect", () => {
      logger.info("Socket client disconnected", { id: socket.id });
    });
  });

  return io;
}


