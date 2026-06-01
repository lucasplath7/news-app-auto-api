import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = 'text-embedding-3-small';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates embeddings for a list of text strings using OpenAI's embeddings
 * API.  Returns embeddings in the same order as the input texts.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  logger.info('Embeddings generated', { count: texts.length, model: EMBEDDING_MODEL });

  return response.data
    .sort((embeddingA, embeddingB) => embeddingA.index - embeddingB.index)
    .map((embeddingData) => embeddingData.embedding);
}

