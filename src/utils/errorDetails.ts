const ERROR_DETAIL_KEYS = [
  "status",
  "code",
  "type",
  "param",
  "request_id",
  "requestId",
] as const;

export type ErrorDetails = Record<string, unknown>;

export function getErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    const details: ErrorDetails = {
      name: error.name,
      message: error.message,
    };
    const errorRecord = error as unknown as ErrorDetails;

    for (const key of ERROR_DETAIL_KEYS) {
      const value = errorRecord[key];
      if (value !== undefined) details[key] = value;
    }

    const cause = errorRecord.cause;
    if (cause !== undefined) {
      details.cause = cause instanceof Error ? getErrorDetails(cause) : cause;
    }

    const providerError = errorRecord.error;
    if (providerError !== undefined) details.error = providerError;

    if (error.stack) details.stack = error.stack;
    return details;
  }

  if (typeof error === "object" && error !== null) {
    return { ...error } as ErrorDetails;
  }

  return { message: String(error) };
}


