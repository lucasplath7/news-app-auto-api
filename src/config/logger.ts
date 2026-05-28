const formatMeta = (meta?: unknown) => (meta ? ` ${JSON.stringify(meta)}` : "");

export const logger = {
  info(message: string, meta?: unknown) {
    console.log(`[INFO] ${message}${formatMeta(meta)}`);
  },
  warn(message: string, meta?: unknown) {
    console.warn(`[WARN] ${message}${formatMeta(meta)}`);
  },
  error(message: string, meta?: unknown) {
    console.error(`[ERROR] ${message}${formatMeta(meta)}`);
  }
};

