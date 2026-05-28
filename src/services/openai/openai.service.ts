import OpenAI from 'openai';
import type { ResponseCreateParamsBase } from 'openai/resources/responses/responses';
import { zodTextFormat } from 'openai/helpers/zod';
import type { ZodType } from 'zod';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/appError.js';
import type { ChatMessage } from '../../utils/streamStructuredResponse.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = NonNullable<ResponseCreateParamsBase['tools']>[number];

export interface StructuredOpenAIConfig<TBatch> {
  model: string;
  messages: ChatMessage[];
  batchSchema: ZodType<TBatch>;
  batchSchemaName: string;
  tools?: Tool[];
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
      const isRetryable =
        err?.status === 429 ||
        err?.status === 500 ||
        err?.status === 503 ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT';
      if (!isRetryable || attempt === retries) break;
      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
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

  const response = await withRetry(() =>
    client.responses.create({
      model: config.model,
      input: config.messages as any,
      ...(config.tools?.length ? { tools: config.tools } : {}),
      text: {
        format: zodTextFormat(config.batchSchema as z.ZodTypeAny, config.batchSchemaName),
      },
    }),
  );

  logger.info('OpenAI structured response completed', { usage: (response as any).usage });

  const outputText = extractOutputText((response as any).output ?? []);

  if (!outputText) {
    throw new AppError(500, 'OpenAI response contained no parseable output text');
  }

  const rawJson: unknown = JSON.parse(outputText);
  return config.batchSchema.parse(rawJson);
}

