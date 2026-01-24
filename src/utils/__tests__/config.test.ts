import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getApiBase, getAgentId, getAuthToken, getWebSocketUrl } from '../config';

describe('Config utilities', () => {
  const originalEnv = import.meta.env;
  const originalWindow = global.window;

  beforeEach(() => {
    // Reset window object
    delete (global as any).window;
    global.window = {
      ...originalWindow,
      ELIZA_CONFIG: undefined,
      ELIZA_AUTH_TOKEN: undefined,
    } as any;

    // Reset import.meta.env
    vi.stubEnv('VITE_API_BASE', '');
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_AGENT_ID', '');
    vi.stubEnv('VITE_AUTH_TOKEN', '');
  });

  describe('getApiBase', () => {
    it('should return window.ELIZA_CONFIG.apiBase if available', () => {
      global.window = {
        ELIZA_CONFIG: { apiBase: 'https://custom-api.example.com' },
      } as any;

      expect(getApiBase()).toBe('https://custom-api.example.com');
    });

    it('should fall back to VITE_API_BASE environment variable', () => {
      vi.stubEnv('VITE_API_BASE', 'https://env-api.example.com');
      expect(getApiBase()).toBe('https://env-api.example.com');
    });

    it('should fall back to VITE_API_BASE_URL if VITE_API_BASE is not set', () => {
      vi.stubEnv('VITE_API_BASE_URL', 'https://alt-api.example.com');
      expect(getApiBase()).toBe('https://alt-api.example.com');
    });

    it('should prioritize window config over environment variables', () => {
      global.window = {
        ELIZA_CONFIG: { apiBase: 'https://window-api.example.com' },
      } as any;
      vi.stubEnv('VITE_API_BASE', 'https://env-api.example.com');

      expect(getApiBase()).toBe('https://window-api.example.com');
    });

    it('should return empty string if no config is available', () => {
      expect(getApiBase()).toBe('');
    });

    it('should handle undefined window gracefully', () => {
      delete (global as any).window;
      vi.stubEnv('VITE_API_BASE', 'https://env-api.example.com');
      // Should not throw and should use env var
      expect(() => getApiBase()).not.toThrow();
    });
  });

  describe('getAgentId', () => {
    it('should return window.ELIZA_CONFIG.agentId if available', () => {
      global.window = {
        ELIZA_CONFIG: { agentId: 'custom-agent-id' },
      } as any;

      expect(getAgentId()).toBe('custom-agent-id');
    });

    it('should fall back to VITE_AGENT_ID environment variable', () => {
      vi.stubEnv('VITE_AGENT_ID', 'env-agent-id');
      expect(getAgentId()).toBe('env-agent-id');
    });

    it('should prioritize window config over environment variables', () => {
      global.window = {
        ELIZA_CONFIG: { agentId: 'window-agent-id' },
      } as any;
      vi.stubEnv('VITE_AGENT_ID', 'env-agent-id');

      expect(getAgentId()).toBe('window-agent-id');
    });

    it('should return empty string if no config is available', () => {
      expect(getAgentId()).toBe('');
    });
  });

  describe('getAuthToken', () => {
    it('should return window.ELIZA_AUTH_TOKEN if available', () => {
      global.window = {
        ELIZA_AUTH_TOKEN: 'window-token-123',
      } as any;

      expect(getAuthToken()).toBe('window-token-123');
    });

    it('should return window.ELIZA_CONFIG.authToken if available', () => {
      global.window = {
        ELIZA_CONFIG: { authToken: 'config-token-456' },
      } as any;

      expect(getAuthToken()).toBe('config-token-456');
    });

    it('should prioritize ELIZA_AUTH_TOKEN over ELIZA_CONFIG.authToken', () => {
      global.window = {
        ELIZA_AUTH_TOKEN: 'window-token',
        ELIZA_CONFIG: { authToken: 'config-token' },
      } as any;

      expect(getAuthToken()).toBe('window-token');
    });

    it('should fall back to VITE_AUTH_TOKEN environment variable', () => {
      vi.stubEnv('VITE_AUTH_TOKEN', 'env-token-789');
      expect(getAuthToken()).toBe('env-token-789');
    });

    it('should return undefined or empty when no token is available', () => {
      const result = getAuthToken();
      expect(result === undefined || result === '').toBe(true);
    });
  });

  describe('getWebSocketUrl', () => {
    it('should return the same URL as getApiBase', () => {
      global.window = {
        ELIZA_CONFIG: { apiBase: 'https://ws-api.example.com' },
      } as any;

      expect(getWebSocketUrl()).toBe('https://ws-api.example.com');
      expect(getWebSocketUrl()).toBe(getApiBase());
    });

    it('should use environment variable if window config is not available', () => {
      vi.stubEnv('VITE_API_BASE', 'https://env-ws.example.com');
      expect(getWebSocketUrl()).toBe('https://env-ws.example.com');
    });

    it('should return empty string if no config is available', () => {
      expect(getWebSocketUrl()).toBe('');
    });
  });
});
