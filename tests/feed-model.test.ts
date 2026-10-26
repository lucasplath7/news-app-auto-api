import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { callStructuredOpenAIMock, dbSelectFromMock } = vi.hoisted(() => ({
  callStructuredOpenAIMock: vi.fn(),
  dbSelectFromMock: vi.fn(),
}));

vi.mock('../src/services/openai/openai.service.js', () => ({
  callStructuredOpenAI: callStructuredOpenAIMock,
}));

vi.mock('../src/config/db.js', () => ({
  db: { selectFrom: dbSelectFromMock },
}));

vi.mock('../src/config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import { aiLoaderController } from '../src/controllers/news/aiLoader.controller.js';
import { classifyCandidates } from '../src/services/openai/classifier.service.js';
import { fetchWebSearchCandidates } from '../src/services/search/webSearch.service.js';

describe('feed OpenAI models', () => {
  beforeEach(() => {
    callStructuredOpenAIMock.mockReset();
    dbSelectFromMock.mockReset();
  });

  it('uses gpt-6-luna with low reasoning effort for the standard feed', async () => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    };
    dbSelectFromMock.mockReturnValue(queryBuilder);
    callStructuredOpenAIMock.mockResolvedValue({ stories: [] });

    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    aiLoaderController(
      { body: { topic: 'us-politics' } } as Request,
      response as unknown as Response,
      vi.fn(),
    );

    await vi.waitFor(() => expect(response.json).toHaveBeenCalled());
    expect(callStructuredOpenAIMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-6-luna', reasoningEffort: 'low' }),
    );
  });

  it('uses gpt-6-luna with low reasoning effort for pipeline candidate search and classification', async () => {
    callStructuredOpenAIMock.mockResolvedValueOnce({ candidates: [] });
    await fetchWebSearchCandidates('us-politics', '2026-10-25');
    expect(callStructuredOpenAIMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: 'gpt-6-luna', reasoningEffort: 'low' }),
    );

    callStructuredOpenAIMock.mockResolvedValueOnce({ classifications: [] });
    await classifyCandidates([], 'United States politics');
    expect(callStructuredOpenAIMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: 'gpt-6-luna', reasoningEffort: 'low' }),
    );
  });
});
