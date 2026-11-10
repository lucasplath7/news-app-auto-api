import request from 'supertest';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { candidates, classifications, stories } from '../fixtures/pipeline.js';
import { migrate } from '../../scripts/migrate.mjs';

const mocks = vi.hoisted(() => ({ search: vi.fn(), classify: vi.fn(), embed: vi.fn(), synthesize: vi.fn() }));
vi.mock('../../src/services/search/webSearch.service.js', () => ({ fetchWebSearchCandidates: mocks.search }));
vi.mock('../../src/services/openai/classifier.service.js', () => ({ classifyCandidates: mocks.classify }));
vi.mock('../../src/services/embedding/embedding.service.js', () => ({ generateEmbeddings: mocks.embed }));
vi.mock('../../src/services/openai/synthesizer.service.js', () => ({ synthesizeClusters: mocks.synthesize }));
vi.mock('../../src/config/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { app } from '../../src/app.js';
import { db } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { logger } from '../../src/config/logger.js';

const previousRunId = '11111111-1111-4111-8111-111111111111';

async function expectPreviousFeedOnly() {
  const response = await request(app).get('/api/news/pipelinefeed?topic=world-news');
  expect(response.status).toBe(200);
  expect(response.body.stories).toEqual([
    expect.objectContaining({ title: 'Previous published story', pipelineRunId: previousRunId }),
  ]);
  expect(await db.selectFrom('newsapi.candidate_stories').selectAll().execute()).toEqual([
    expect.objectContaining({ pipeline_run_id: previousRunId, title: 'Previous candidate audit' }),
  ]);
}

describe('complex loader with real PostgreSQL', () => {
  beforeAll(async () => {
    await migrate(env.DB_URL);
    // Re-running migrations must be a no-op, including named constraints.
    expect(await migrate(env.DB_URL)).toEqual([]);
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    mocks.search.mockResolvedValue(candidates);
    mocks.classify.mockResolvedValue(classifications);
    mocks.embed.mockResolvedValue([[1, 0], [1, 0]]);
    mocks.synthesize.mockResolvedValue(stories);
    await sql`DROP TRIGGER IF EXISTS fail_candidate_audit ON newsapi.candidate_stories`.execute(db);
    await sql`DROP TRIGGER IF EXISTS fail_feed_write ON newsapi.pipeline_feed_stories`.execute(db);
    await db.deleteFrom('newsapi.candidate_stories').execute();
    await db.deleteFrom('newsapi.pipeline_feed_stories').execute();
    await db.insertInto('newsapi.pipeline_feed_stories').values({
      pipeline_run_id: previousRunId, topic: 'world-news', title: 'Previous published story',
      summary: 'The feed before this refresh.', sources: ['https://previous.example/story'],
    }).execute();
    await db.insertInto('newsapi.candidate_stories').values({
      pipeline_run_id: previousRunId, topic: 'world-news', title: 'Previous candidate audit',
      url: 'https://previous.example/story', snippet: 'Previous source.', source_domain: 'previous.example',
      legitimacy_score: 0.9, is_duplicate: false, sub_topic: 'test-event', cluster_id: null, status: 'synthesized',
    }).execute();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('commits stories and audits together using generated IDs, defaults, arrays and constraints', async () => {
    const response = await request(app).post('/api/news/aipipelineloader').send({ topic: 'world-news' });
    expect(response.status).toBe(200);
    expect(response.body.savedCount).toBe(1);
    const savedStories = await db.selectFrom('newsapi.pipeline_feed_stories')
      .selectAll().where('pipeline_run_id', '=', response.body.pipelineRunId).execute();
    expect(savedStories).toEqual([expect.objectContaining({
      id: expect.any(String), created_at: expect.any(Date), sources: stories[0].sources,
    })]);
    const audits = await db.selectFrom('newsapi.candidate_stories')
      .selectAll().where('pipeline_run_id', '=', response.body.pipelineRunId).orderBy('url').execute();
    expect(audits).toHaveLength(4);
    expect(audits.map((audit) => audit.status)).toEqual(['synthesized', 'synthesized', 'rejected', 'rejected']);
    expect(audits[0].cluster_id).toEqual(audits[1].cluster_id);
    expect(audits[0].cluster_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rolls back the new feed when the audit insert fails after the story insert', async () => {
    // The trigger checks that the feed write really happened before forcing a
    // PostgreSQL error. It sees uncommitted writes in the loader transaction.
    await sql`CREATE OR REPLACE FUNCTION newsapi.reject_candidate_audit() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM newsapi.pipeline_feed_stories WHERE pipeline_run_id = NEW.pipeline_run_id) THEN
          RAISE EXCEPTION 'Audit attempted before feed insert';
        END IF;
        RAISE EXCEPTION 'Injected audit failure after feed insert' USING ERRCODE = '23514';
      END $$`.execute(db);
    await sql`CREATE TRIGGER fail_candidate_audit BEFORE INSERT ON newsapi.candidate_stories
      FOR EACH ROW EXECUTE FUNCTION newsapi.reject_candidate_audit()`.execute(db);
    const response = await request(app).post('/api/news/aipipelineloader').send({ topic: 'world-news' });
    expect(response.status).toBe(500);
    expect(mocks.synthesize).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith('Unhandled server error', expect.objectContaining({
      code: '23514', message: 'Injected audit failure after feed insert',
    }));
    await expectPreviousFeedOnly();
  });

  it('leaves the previous feed and audits intact when the story insert fails', async () => {
    await sql`CREATE OR REPLACE FUNCTION newsapi.reject_feed_write() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected feed failure' USING ERRCODE = '23514'; END $$`.execute(db);
    await sql`CREATE TRIGGER fail_feed_write BEFORE INSERT ON newsapi.pipeline_feed_stories
      FOR EACH ROW EXECUTE FUNCTION newsapi.reject_feed_write()`.execute(db);
    const response = await request(app).post('/api/news/aipipelineloader').send({ topic: 'world-news' });
    expect(response.status).toBe(500);
    await expectPreviousFeedOnly();
  });

  it('can commit an audit-only run when synthesis returns no stories', async () => {
    mocks.synthesize.mockResolvedValue([]);
    const response = await request(app).post('/api/news/aipipelineloader').send({ topic: 'world-news' });
    expect(response.status).toBe(200);
    expect(response.body.savedCount).toBe(0);
    const audits = await db.selectFrom('newsapi.candidate_stories').selectAll()
      .where('pipeline_run_id', '=', response.body.pipelineRunId).execute();
    expect(audits).toHaveLength(4);
    const feed = await request(app).get('/api/news/pipelinefeed?topic=world-news');
    expect(feed.body.stories).toHaveLength(1);
  });
});
