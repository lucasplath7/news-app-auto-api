import type { Request, Response } from 'express';
import OpenAI from 'openai';
import type { ResponseCreateParamsBase } from 'openai/resources/responses/responses';
import { zodTextFormat } from 'openai/helpers/zod';
import type { ZodType } from 'zod';
import { z } from 'zod';
import { StreamingSchemaExtractor } from './StreamingSchemaExtractor.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single message in the OpenAI `input` array. */
export interface ChatMessage {
  role: 'system' | 'developer' | 'user';
  content: string;
}

/** Re-export the SDK's own Tool union so callers don't need to import it. */
type Tool = NonNullable<ResponseCreateParamsBase['tools']>[number];

/**
 * Feature-specific configuration that a controller passes to the streaming
 * pipeline.  Everything else (SSE wiring, retries, extraction) is handled
 * by the utility.
 */
export interface StreamingRequestConfig<TItem, TBatch> {
  /** OpenAI model id, e.g. `"gpt-4.1-mini"`. */
  model: string;

  /** Ordered chat messages (system → developer → user). */
  messages: ChatMessage[];

  /** Zod schema for the *complete* response object (used for `zodTextFormat`). */
  batchSchema: ZodType<TBatch>;

  /**
   * The name that is passed to `zodTextFormat` as the format name
   * (e.g. `"news_batch"`).
   */
  batchSchemaName: string;

  /** Zod schema for a *single item* inside the array. */
  itemSchema: ZodType<TItem>;

  /**
   * The property name on the batch object that contains the array of items
   * (e.g. `"usNews"`).
   */
  arrayProperty: string;

  /** Tools to attach to the request (e.g. `[{ type: 'web_search' }]`). */
  tools?: Tool[];

  /** Optional prompt-cache key. */
  cacheKey?: string;

  /** OpenAI client options (timeout, api key overrides, etc.). */
  clientOptions?: ConstructorParameters<typeof OpenAI>[0];
}

// ─── Retry helper ────────────────────────────────────────────────────────────

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
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ─── SSE helpers ─────────────────────────────────────────────────────────────

function initSSE(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  (res as any).flushHeaders?.();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Execute an OpenAI streaming request, extract validated items from the
 * response as they arrive, and forward them to the client as SSE events.
 *
 * @example
 * ```ts
 * export async function getWidgets(req: Request, res: Response) {
 *   await streamStructuredResponse(req, res, {
 *     model: 'gpt-4.1-mini',
 *     messages: [ … ],
 *     batchSchema: WidgetBatchSchema,
 *     batchSchemaName: 'widget_batch',
 *     itemSchema: WidgetSchema,
 *     arrayProperty: 'widgets',
 *     tools: [{ type: 'web_search' }],
 *   });
 * }
 * ```
 */
export async function streamStructuredResponse<TItem, TBatch>(
  req: Request,
  res: Response,
  config: StreamingRequestConfig<TItem, TBatch>,
): Promise<void> {
  initSSE(res);

  let closed = false;
  req.on('close', () => { closed = true; });

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    ...(config.clientOptions ?? { timeout: undefined }),
  });
  const extractor = new StreamingSchemaExtractor(config.itemSchema, config.arrayProperty);

  const emitItem = (item: TItem) => {
    res.write(`event: item\ndata: ${JSON.stringify(item)}\n\n`);
  };

  try {
    const stream = await withRetry(() =>
      Promise.resolve(
        client.responses.stream({
          model: config.model,
          ...(config.cacheKey ? { prompt_cache_key: config.cacheKey } : {}),
          input: config.messages,
          ...(config.tools?.length ? { tools: config.tools } : {}),
          text: {
            format: zodTextFormat(config.batchSchema as z.ZodTypeAny, config.batchSchemaName),
          },
          stream: true,
        }),
      ),
    );

    for await (const event of stream) {
      if (closed) break;

      switch (event.type) {
        case 'response.output_text.delta':
          extractor.append(event.delta ?? '');
          for (const item of extractor) {
            emitItem(item);
          }
          continue;

        case 'response.completed':
          logger.info('OpenAI response completed', { usage: event.response.usage });
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          break;

        case 'response.failed':
          res.write(`data: ${JSON.stringify({ error: 'response_failed' })}\n\n`);
          break;
      }
    }
  } catch (error: any) {
    logger.error('OpenAI streaming error', { error });
    if (!closed) res.write(`data: ${JSON.stringify({ error: String(error) })}\n\n`);
  } finally {
    if (!closed) res.end();
  }
}



