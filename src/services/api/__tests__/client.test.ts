import { describe, it, expect, vi } from 'vitest';

vi.mock('axios', () => {
  const inst: {
    _errHandler?: (err: any) => Promise<never>;
    interceptors: { response: { use: ReturnType<typeof vi.fn> } };
  } = {
    _errHandler: undefined,
    interceptors: {
      response: {
        use: vi.fn((onFulfilled: any, onRejected: any) => {
          inst._errHandler = onRejected;
        }),
      },
    },
  };
  (globalThis as any).__axiosMockInstance = inst;
  return {
    default: {
      create: vi.fn(() => inst),
    },
  };
});

vi.mock('@/utils/config', () => ({
  getApiBase: vi.fn(() => 'https://api.example.com'),
  getAuthToken: vi.fn(() => 'test-token-123'),
}));

import axios from 'axios';
import '../client';

const mockedCreate = vi.mocked(axios.create);
const mockInstance = (globalThis as any).__axiosMockInstance as {
  _errHandler?: (err: any) => Promise<never>;
  interceptors: { response: { use: ReturnType<typeof vi.fn> } };
};

describe('API Client', () => {
  function errHandler() {
    const h = mockInstance._errHandler;
    if (!h) throw new Error('Error interceptor not captured');
    return h;
  }

  it('should create axios instance with correct base URL', () => {
    expect(mockedCreate).toHaveBeenCalled();
    const config = mockedCreate.mock.calls[0][0];
    expect(config.baseURL).toBe('https://api.example.com/api');
  });

  it('should include Content-Type and Authorization headers', () => {
    const config = mockedCreate.mock.calls[0][0];
    expect(config.headers['Content-Type']).toBe('application/json');
    expect(config.headers.Authorization).toBe('Bearer test-token-123');
  });

  it('should have 30 second timeout', () => {
    const config = mockedCreate.mock.calls[0][0];
    expect(config.timeout).toBe(30000);
  });

  describe('Error interceptor (real logic)', () => {
    const runInterceptor = (err: any) =>
      Promise.resolve().then(() => errHandler()(err));

    it('should throw API error message for 4xx/5xx', async () => {
      await expect(
        runInterceptor({
          response: { status: 401, data: { error: { message: 'Unauthorized' } } },
          message: 'Request failed',
        })
      ).rejects.toThrow('Unauthorized');
    });

    it('should throw Session not found for 404 with Session message', async () => {
      await expect(
        runInterceptor({
          response: {
            status: 404,
            data: { error: { message: 'Session not found' } },
          },
          message: 'Request failed',
        })
      ).rejects.toThrow('Session not found');
    });

    it('should throw custom message from response data', async () => {
      await expect(
        runInterceptor({
          response: {
            status: 400,
            data: { error: { message: 'Custom error message', code: 'CUSTOM' } },
          },
          message: 'Generic',
        })
      ).rejects.toThrow('Custom error message');
    });

    it('should fall back to error.message when no response data message', async () => {
      await expect(
        runInterceptor({
          response: { status: 400, data: {} },
          message: 'Fallback message',
        })
      ).rejects.toThrow('Fallback message');
    });

    it('should throw network error when no response', async () => {
      await expect(
        runInterceptor({ request: {}, message: 'Network Error' })
      ).rejects.toThrow('Network error - unable to reach server');
    });

    it('should throw generic message when no message at all', async () => {
      await expect(runInterceptor({})).rejects.toThrow(
        'An unexpected error occurred'
      );
    });
  });
});
