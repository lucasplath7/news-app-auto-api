import { getErrorDetails } from "../utils/errorDetails.js";

const formatMeta = (meta?: unknown) => {
  if (!meta) return "";

  try {
    const serializableMeta = meta instanceof Error ? getErrorDetails(meta) : meta;
    return ` ${JSON.stringify(serializableMeta)}`;
  } catch {
    return " {\"message\":\"Unable to serialize log metadata\"}";
  }
};

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

