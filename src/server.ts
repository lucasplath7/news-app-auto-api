import { createServer } from "http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { app } from "./app.js";
import { initSocket } from "./config/socket.js";

const httpServer = createServer(app);

initSocket(httpServer);

httpServer.listen(env.PORT, "0.0.0.0", () => {
  logger.info(`Server running on port ${env.PORT}`, { env: env.NODE_ENV });
});
