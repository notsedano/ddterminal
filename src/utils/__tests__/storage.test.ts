import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getUserId, getTheme, setTheme } from '../storage';
import { generateUUID } from '../uuid';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe('Storage utilities', () => {
  let classListToggleSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    classListToggleSpy = vi.fn();
    document.documentElement.classList.toggle = classListToggleSpy;
  });

  describe('getUserId', () => {
    it('should generate and store a new user ID if none exists', () => {
      const userId = getUserId();
      expect(userId).toBeTruthy();
      expect(typeof userId).toBe('string');
      expect(localStorageMock.getItem('eliza_user_id')).toBe(userId);
    });

    it('should return existing user ID if one exists', () => {
      const existingId = 'test-user-id-123';
      localStorageMock.setItem('eliza_user_id', existingId);
      const userId = getUserId();
      expect(userId).toBe(existingId);
    });

    it('should generate valid UUID format', () => {
      const userId = getUserId();
      // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(userId)).toBe(true);
    });

    it('should persist user ID across multiple calls', () => {
      const firstCall = getUserId();
      const secondCall = getUserId();
      expect(firstCall).toBe(secondCall);
    });

    it('should call setItem when storing new user id', () => {
      const setItemSpy = vi.spyOn(localStorageMock, 'setItem');
      getUserId();
      expect(setItemSpy).toHaveBeenCalledWith('eliza_user_id', expect.any(String));
      setItemSpy.mockRestore();
    });
  });

  describe('getTheme', () => {
    it('should return "dark" as default when no theme is set', () => {
      const theme = getTheme();
      expect(theme).toBe('dark');
    });

    it('should return stored theme if valid', () => {
      localStorageMock.setItem('eliza_theme', 'light');
      expect(getTheme()).toBe('light');

      localStorageMock.setItem('eliza_theme', 'dark');
      expect(getTheme()).toBe('dark');
    });

    it('should return "dark" for invalid theme values', () => {
      localStorageMock.setItem('eliza_theme', 'invalid');
      expect(getTheme()).toBe('dark');

      localStorageMock.setItem('eliza_theme', '');
      expect(getTheme()).toBe('dark');

      localStorageMock.setItem('eliza_theme', 'auto');
      expect(getTheme()).toBe('dark');
    });

    it('should handle case sensitivity', () => {
      localStorageMock.setItem('eliza_theme', 'LIGHT');
      expect(getTheme()).toBe('dark'); // Should be case-sensitive

      localStorageMock.setItem('eliza_theme', 'Light');
      expect(getTheme()).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('should store theme in localStorage', () => {
      setTheme('light');
      expect(localStorageMock.getItem('eliza_theme')).toBe('light');

      setTheme('dark');
      expect(localStorageMock.getItem('eliza_theme')).toBe('dark');
    });

    it('should toggle dark class on document element', () => {
      setTheme('dark');
      expect(classListToggleSpy).toHaveBeenCalledWith('dark', true);

      classListToggleSpy.mockClear();
      setTheme('light');
      expect(classListToggleSpy).toHaveBeenCalledWith('dark', false);
    });

    it('should handle theme changes correctly', () => {
      setTheme('light');
      expect(localStorageMock.getItem('eliza_theme')).toBe('light');
      expect(classListToggleSpy).toHaveBeenLastCalledWith('dark', false);

      setTheme('dark');
      expect(localStorageMock.getItem('eliza_theme')).toBe('dark');
      expect(classListToggleSpy).toHaveBeenLastCalledWith('dark', true);
    });

    it('should handle multiple rapid theme changes', () => {
      setTheme('light');
      setTheme('dark');
      setTheme('light');
      setTheme('dark');

      expect(localStorageMock.getItem('eliza_theme')).toBe('dark');
      expect(classListToggleSpy).toHaveBeenCalledTimes(4);
    });
  });
});
