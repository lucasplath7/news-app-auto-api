import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { app } from "./app.js";

app.listen(env.PORT, "0.0.0.0", () => {
  logger.info(`Server running on port ${env.PORT}`, { env: env.NODE_ENV });
});

