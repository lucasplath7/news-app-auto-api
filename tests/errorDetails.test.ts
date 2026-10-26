import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../src/config/logger.js';
import { getErrorDetails } from '../src/utils/errorDetails.js';

describe('getErrorDetails', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves standard and OpenAI SDK error fields', () => {
    const error = Object.assign(new Error('Model is overloaded'), {
      status: 503,
      code: 'model_overloaded',
      request_id: 'request-123',
    });

    expect(getErrorDetails(error)).toMatchObject({
      name: 'Error',
      message: 'Model is overloaded',
      status: 503,
      code: 'model_overloaded',
      request_id: 'request-123',
    });
  });

  it('normalizes nested causes and non-Error values', () => {
    const rootCause = new Error('socket closed');
    const error = new Error('request failed', { cause: rootCause });

    expect(getErrorDetails(error).cause).toMatchObject({
      name: 'Error',
      message: 'socket closed',
    });
    expect(getErrorDetails('unexpected failure')).toEqual({
      message: 'unexpected failure',
    });
  });

  it('logs native errors with useful details instead of an empty object', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(new Error('Upstream model overloaded'), {
      code: 'model_overloaded',
      request_id: 'request-456',
    });

    logger.error('Unhandled server error', error);

    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0]?.[0]).toContain('"message":"Upstream model overloaded"');
    expect(consoleError.mock.calls[0]?.[0]).toContain('"code":"model_overloaded"');
    expect(consoleError.mock.calls[0]?.[0]).not.toContain('{}');
  });
});


