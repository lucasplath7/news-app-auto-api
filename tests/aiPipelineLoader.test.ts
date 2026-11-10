import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { candidates, classifications, stories } from './fixtures/pipeline.js';

const mocks = vi.hoisted(() => ({
  search: vi.fn(), classify: vi.fn(), embed: vi.fn(), synthesize: vi.fn(),
  transaction: vi.fn(), insert: vi.fn(), feedWrite: vi.fn(), auditWrite: vi.fn(),
}));

vi.mock('../src/services/search/webSearch.service.js', () => ({ fetchWebSearchCandidates: mocks.search }));
vi.mock('../src/services/openai/classifier.service.js', () => ({ classifyCandidates: mocks.classify }));
vi.mock('../src/services/embedding/embedding.service.js', () => ({ generateEmbeddings: mocks.embed }));
vi.mock('../src/services/openai/synthesizer.service.js', () => ({ synthesizeClusters: mocks.synthesize }));
vi.mock('../src/config/db.js', () => ({ db: { transaction: mocks.transaction } }));
vi.mock('../src/config/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { aiPipelineLoaderRouter } from '../src/routes/news/aiPipelineLoader/aiPipelineLoader.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/loader', aiPipelineLoaderRouter);
app.use(errorHandler);

describe('complex loader publication', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.search.mockResolvedValue(candidates);
    mocks.classify.mockResolvedValue(classifications);
    mocks.embed.mockResolvedValue([[1, 0], [1, 0]]);
    mocks.synthesize.mockResolvedValue(stories);
    mocks.insert.mockImplementation((table) => ({
      values: (values: unknown) => ({
        execute: () => table === 'newsapi.pipeline_feed_stories'
          ? mocks.feedWrite(values) : mocks.auditWrite(values),
      }),
    }));
    mocks.transaction.mockReturnValue({
      execute: async (callback: (transaction: unknown) => Promise<void>) => {
        // External work must finish before opening a database transaction.
        expect(mocks.synthesize).toHaveBeenCalledOnce();
        return callback({ insertInto: mocks.insert });
      },
    });
  });

  it('publishes stories and all candidate audit rows with one run ID', async () => {
    const response = await request(app).post('/loader').send({ topic: 'world-news' });
    expect(response.status).toBe(200);
    expect(response.body.savedCount).toBe(1);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.feedWrite).toHaveBeenCalledWith([
      expect.objectContaining({ pipeline_run_id: response.body.pipelineRunId, title: stories[0].title }),
    ]);
    expect(mocks.auditWrite).toHaveBeenCalledWith([
      expect.objectContaining({ pipeline_run_id: response.body.pipelineRunId, status: 'synthesized' }),
      expect.objectContaining({ status: 'synthesized' }),
      expect.objectContaining({ status: 'rejected' }),
      expect.objectContaining({ status: 'rejected' }),
    ]);
  });

  it.each(['search', 'classify', 'embed', 'synthesize'] as const)(
    'returns an error without opening a transaction when %s fails', async (stage) => {
      mocks[stage].mockRejectedValue(new Error(`Injected ${stage} failure`));
      const response = await request(app).post('/loader').send({ topic: 'world-news' });
      expect(response.status).toBe(500);
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.insert).not.toHaveBeenCalled();
    },
  );

  it('stops before the audit write if the feed write fails', async () => {
    mocks.feedWrite.mockRejectedValue(new Error('Injected feed failure'));
    const response = await request(app).post('/loader').send({ topic: 'world-news' });
    expect(response.status).toBe(500);
    expect(mocks.auditWrite).not.toHaveBeenCalled();
  });

  it('returns an error when the audit write fails after the feed write', async () => {
    mocks.auditWrite.mockRejectedValue(new Error('Injected audit failure'));
    const response = await request(app).post('/loader').send({ topic: 'world-news' });
    expect(response.status).toBe(500);
    expect(mocks.feedWrite).toHaveBeenCalledOnce();
    expect(mocks.auditWrite).toHaveBeenCalledOnce();
  });

  it('keeps candidate audits when no stories are synthesized', async () => {
    mocks.synthesize.mockResolvedValue([]);
    const response = await request(app).post('/loader').send({ topic: 'world-news' });
    expect(response.status).toBe(200);
    expect(response.body.savedCount).toBe(0);
    expect(mocks.feedWrite).not.toHaveBeenCalled();
    expect(mocks.auditWrite).toHaveBeenCalledOnce();
  });
});
