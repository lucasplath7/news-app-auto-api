const formatMeta = (meta?: unknown) => (meta ? ` ${JSON.stringify(meta)}` : "");

export const logger = {
  info(message: string, meta?: unknown) {
    console.log(`[INFO] ${message}${formatMeta(meta)}`);
  },
  error(message: string, meta?: unknown) {
    console.error(`[ERROR] ${message}${formatMeta(meta)}`);
  }
};

