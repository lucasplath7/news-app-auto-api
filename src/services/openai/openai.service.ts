import OpenAI from 'openai';
import type { ResponseCreateParamsBase } from 'openai/resources/responses/responses';
import { zodTextFormat } from 'openai/helpers/zod';
import type { ZodType } from 'zod';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/appError.js';
import { getErrorDetails } from '../../utils/errorDetails.js';
import type { ChatMessage } from '../../utils/streamStructuredResponse.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = NonNullable<ResponseCreateParamsBase['tools']>[number];

export interface StructuredOpenAIConfig<TBatch> {
  model: string;
  messages: ChatMessage[];
  batchSchema: ZodType<TBatch>;
  batchSchemaName: string;
  tools?: Tool[];
  reasoningEffort?: 'low' | 'medium' | 'high';
}

// ─── Retry Helper ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const errorDetails = getErrorDetails(err);
      const nestedProviderError =
        typeof errorDetails.error === 'object' && errorDetails.error !== null
          ? errorDetails.error as Record<string, unknown>
          : undefined;
      const status = errorDetails.status ?? nestedProviderError?.status;
      const code = errorDetails.code ?? nestedProviderError?.code;
      const isRetryable =
        status === 408 ||
        status === 409 ||
        status === 429 ||
        (typeof status === 'number' && status >= 500) ||
        code === 'model_overloaded' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'ECONNREFUSED';
      if (!isRetryable || attempt === retries) break;
      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
      logger.warn('Retrying OpenAI request after transient failure', {
        attempt: attempt + 1,
        maxRetries: retries,
        status,
        code,
        delayMs: delay,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// ─── Output Extraction ────────────────────────────────────────────────────────

/**
 * Walks the OpenAI Responses API output array and concatenates all
 * `output_text` content from message items into a single string.
 * Handles tool-augmented responses where the output array may include
 * web_search tool call items before the final message.
 */
function extractOutputText(output: unknown[]): string {
  let text = '';
  for (const item of output) {
    const outputItem = item as { type: string; content?: unknown[] };
    if (outputItem.type !== 'message') continue;
    for (const part of outputItem.content ?? []) {
      const contentPart = part as { type: string; text?: string };
      if (contentPart.type === 'output_text' && contentPart.text) {
        text += contentPart.text;
      }
    }
  }
  return text;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calls the OpenAI Responses API with structured (non-streaming) output,
 * validates the result against the provided Zod schema, and returns the
 * fully typed batch.
 *
 * This is separate from `streamStructuredResponse` which is purpose-built
 * for SSE/streaming to an HTTP client.
 */
export async function callStructuredOpenAI<TBatch>(
  config: StructuredOpenAIConfig<TBatch>,
): Promise<TBatch> {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: undefined });

  let response;
  try {
    response = await withRetry(() =>
      client.responses.create({
        model: config.model,
        input: config.messages as any,
        ...(config.tools?.length ? { tools: config.tools } : {}),
        ...(config.reasoningEffort
          ? { reasoning: { effort: config.reasoningEffort } }
          : {}),
        max_output_tokens: 4096,
        text: {
          format: zodTextFormat(config.batchSchema as z.ZodTypeAny, config.batchSchemaName),
        },
      }),
    );
  } catch (error) {
    const errorDetails = getErrorDetails(error);
    const nestedProviderError =
      typeof errorDetails.error === 'object' && errorDetails.error !== null
        ? errorDetails.error as Record<string, unknown>
        : undefined;
    const providerMessage =
      typeof nestedProviderError?.message === 'string'
        ? nestedProviderError.message
        : typeof errorDetails.message === 'string'
          ? errorDetails.message
          : 'The OpenAI request failed without a message';
    const statusValue = errorDetails.status ?? nestedProviderError?.status;
    const codeValue = errorDetails.code ?? nestedProviderError?.code;
    const typeValue = errorDetails.type ?? nestedProviderError?.type;
    const providerStatus = typeof statusValue === 'number' ? statusValue : undefined;
    const providerCode = typeof codeValue === 'string' ? codeValue : undefined;
    const providerType = typeof typeValue === 'string' ? typeValue : undefined;
    const requestId = errorDetails.request_id ?? errorDetails.requestId;

    logger.error('OpenAI structured request failed', {
      model: config.model,
      message: providerMessage,
      status: providerStatus,
      code: providerCode,
      type: providerType,
      requestId,
      cause: errorDetails.cause,
    });

    const statusCode = providerStatus && providerStatus >= 400 && providerStatus < 500
      ? 502
      : 503;
    throw new AppError(statusCode, `OpenAI request failed: ${providerMessage}`, {
      provider: 'openai',
      model: config.model,
      status: providerStatus,
      code: providerCode,
      type: providerType,
      requestId,
    });
  }

  logger.info('OpenAI structured response completed', { usage: (response as any).usage });

  const outputText = extractOutputText((response as any).output ?? []);

  if (!outputText) {
    throw new AppError(500, 'OpenAI response contained no parseable output text');
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(outputText);
  } catch (parseError) {
    logger.error('Failed to parse OpenAI output as JSON', { outputText });
    throw new AppError(500, 'OpenAI response was not valid JSON');
  }


  try {
    return config.batchSchema.parse(rawJson);
  } catch (err: any) {
    throw new AppError(500, err.message);
  }

}

