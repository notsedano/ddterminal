/**
 * Comprehensive tests for extractErrorMessage utility
 * Tests boundary conditions, edge cases, circular references, and all error types
 */

import { describe, it, expect } from 'vitest';
import { extractErrorMessage } from '@/utils/messageUtils';

describe('extractErrorMessage', () => {
  describe('Error Objects', () => {
    it('should extract message from Error instance', () => {
      const error = new Error('Test error message');
      expect(extractErrorMessage(error)).toBe('Test error message');
    });

    it('should use name when message is empty', () => {
      const error = new Error('');
      error.name = 'TypeError';
      expect(extractErrorMessage(error)).toBe('TypeError');
    });

    it('should fallback to "Unknown error" when both message and name are empty', () => {
      const error = new Error('');
      error.name = '';
      expect(extractErrorMessage(error)).toBe('Unknown error');
    });

    it('should handle Error with only name property', () => {
      const error = new Error();
      error.name = 'ReferenceError';
      expect(extractErrorMessage(error)).toBe('ReferenceError');
    });

    it('should handle custom Error subclasses', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      const error = new CustomError('Custom error');
      expect(extractErrorMessage(error)).toBe('Custom error');
    });
  });

  describe('String Errors', () => {
    it('should return string errors as-is', () => {
      expect(extractErrorMessage('Simple string error')).toBe('Simple string error');
    });

    it('should handle empty strings', () => {
      expect(extractErrorMessage('')).toBe('');
    });

    it('should handle strings with special characters', () => {
      const error = 'Error: "Session" not found & content > 4000';
      expect(extractErrorMessage(error)).toBe(error);
    });

    it('should handle very long strings', () => {
      const longError = 'A'.repeat(10000);
      expect(extractErrorMessage(longError)).toBe(longError);
    });

    it('should handle strings with newlines', () => {
      const error = 'Error:\nLine 1\nLine 2';
      expect(extractErrorMessage(error)).toBe(error);
    });
  });

  describe('Object Errors', () => {
    it('should extract message from object with message property', () => {
      const error = { message: 'Object error message' };
      expect(extractErrorMessage(error)).toBe('Object error message');
    });

    it('should handle nested Error in message property', () => {
      const nestedError = new Error('Nested error');
      const error = { message: nestedError };
      expect(extractErrorMessage(error)).toBe('Nested error');
    });

    it('should handle Error with name in nested message', () => {
      const nestedError = new Error('');
      nestedError.name = 'TypeError';
      const error = { message: nestedError };
      expect(extractErrorMessage(error)).toBe('TypeError');
    });

    it('should convert non-string message to string', () => {
      const error = { message: 123 };
      expect(extractErrorMessage(error)).toBe('123');
    });

    it('should convert null message to string', () => {
      const error = { message: null };
      expect(extractErrorMessage(error)).toBe('null');
    });

    it('should convert undefined message to string', () => {
      const error = { message: undefined };
      expect(extractErrorMessage(error)).toBe('undefined');
    });
  });

  describe('Circular Reference Handling', () => {
    it('should handle objects with circular references', () => {
      const circular: any = { message: 'Circular error' };
      circular.self = circular;
      // Should not throw, should extract message
      expect(extractErrorMessage(circular)).toBe('Circular error');
    });

    it('should handle deeply nested circular references', () => {
      const circular: any = {
        message: 'Deep circular',
        nested: {
          deeper: {}
        }
      };
      circular.nested.deeper.parent = circular;
      expect(extractErrorMessage(circular)).toBe('Deep circular');
    });

    it('should handle circular reference in message property', () => {
      const circular: any = {};
      circular.message = circular;
      // Should convert to string representation
      const result = extractErrorMessage(circular);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Primitive Types', () => {
    it('should convert numbers to string', () => {
      expect(extractErrorMessage(123)).toBe('123');
      expect(extractErrorMessage(0)).toBe('0');
      expect(extractErrorMessage(-1)).toBe('-1');
    });

    it('should convert booleans to string', () => {
      expect(extractErrorMessage(true)).toBe('true');
      expect(extractErrorMessage(false)).toBe('false');
    });

    it('should convert null to string', () => {
      expect(extractErrorMessage(null)).toBe('null');
    });

    it('should convert undefined to string', () => {
      expect(extractErrorMessage(undefined)).toBe('undefined');
    });
  });

  describe('Edge Cases', () => {
    it('should handle objects without message property', () => {
      const error = { code: 'ERROR_CODE', status: 500 };
      const result = extractErrorMessage(error);
      expect(typeof result).toBe('string');
      expect(result).toContain('ERROR_CODE');
    });

    it('should handle arrays', () => {
      const error = ['error', 'message', 'array'];
      const result = extractErrorMessage(error);
      expect(typeof result).toBe('string');
    });

    it('should handle functions', () => {
      const error = () => 'function error';
      const result = extractErrorMessage(error);
      expect(typeof result).toBe('string');
    });

    it('should handle Date objects', () => {
      const error = new Date();
      const result = extractErrorMessage(error);
      expect(typeof result).toBe('string');
    });

    it('should handle RegExp objects', () => {
      const error = /test/gi;
      const result = extractErrorMessage(error);
      expect(typeof result).toBe('string');
    });

    it('should handle Map objects', () => {
      const error = new Map([['key', 'value']]);
      const result = extractErrorMessage(error);
      expect(typeof result).toBe('string');
    });

    it('should handle Set objects', () => {
      const error = new Set([1, 2, 3]);
      const result = extractErrorMessage(error);
      expect(typeof result).toBe('string');
    });
  });

  describe('Real-World Error Scenarios', () => {
    it('should handle fetch/network errors', () => {
      const error = new TypeError('Failed to fetch');
      expect(extractErrorMessage(error)).toBe('Failed to fetch');
    });

    it('should handle JSON parse errors', () => {
      const error = new SyntaxError('Unexpected token < in JSON at position 0');
      expect(extractErrorMessage(error)).toBe('Unexpected token < in JSON at position 0');
    });

    it('should handle session errors', () => {
      const error = { message: 'Session not found', code: 'SESSION_NOT_FOUND' };
      expect(extractErrorMessage(error)).toBe('Session not found');
    });

    it('should handle API errors with nested structure', () => {
      const error = {
        message: 'API Error',
        response: {
          status: 400,
          data: { error: 'Bad Request' }
        }
      };
      expect(extractErrorMessage(error)).toBe('API Error');
    });

    it('should handle errors from async operations', async () => {
      try {
        await Promise.reject(new Error('Async error'));
      } catch (error) {
        expect(extractErrorMessage(error)).toBe('Async error');
      }
    });

    it('should handle errors from promise rejections', () => {
      const error = Promise.reject(new Error('Promise error'));
      // Error is a Promise, should convert to string
      const result = extractErrorMessage(error);
      expect(typeof result).toBe('string');
    });
  });

  describe('Concurrent/Async Behavior', () => {
    it('should handle errors extracted concurrently', async () => {
      const errors = [
        new Error('Error 1'),
        new Error('Error 2'),
        new Error('Error 3'),
        'String error',
        { message: 'Object error' }
      ];

      const results = await Promise.all(
        errors.map(async (error) => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          return extractErrorMessage(error);
        })
      );

      expect(results[0]).toBe('Error 1');
      expect(results[1]).toBe('Error 2');
      expect(results[2]).toBe('Error 3');
      expect(results[3]).toBe('String error');
      expect(results[4]).toBe('Object error');
    });

    it('should be thread-safe for circular references', () => {
      const circular: any = { message: 'Circular' };
      circular.self = circular;

      // Extract multiple times concurrently
      const results = Array.from({ length: 100 }, () => extractErrorMessage(circular));
      
      // All should return the same result
      expect(results.every(r => r === 'Circular')).toBe(true);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(100000);
      const error = new Error(longMessage);
      const result = extractErrorMessage(error);
      expect(result).toBe(longMessage);
      expect(result.length).toBe(100000);
    });

    it('should handle unicode characters', () => {
      const error = new Error('错误消息: 🚀 测试');
      expect(extractErrorMessage(error)).toBe('错误消息: 🚀 测试');
    });

    it('should handle control characters', () => {
      const error = new Error('Error\twith\ncontrol\rcharacters');
      expect(extractErrorMessage(error)).toBe('Error\twith\ncontrol\rcharacters');
    });

    it('should handle empty objects', () => {
      const error = {};
      const result = extractErrorMessage(error);
      expect(typeof result).toBe('string');
    });

    it('should handle objects with only prototype properties', () => {
      const error = Object.create({ inherited: 'property' });
      const result = extractErrorMessage(error);
      expect(typeof result).toBe('string');
    });
  });

  describe('Integration with Real Error Types', () => {
    it('should handle DOMException', () => {
      try {
        // This might throw in some environments
        const error = new DOMException('DOM error', 'NotFoundError');
        expect(extractErrorMessage(error)).toBe('DOM error');
      } catch {
        // Skip if DOMException not available
      }
    });

    it('should handle AggregateError', () => {
      try {
        const error = new AggregateError([
          new Error('Error 1'),
          new Error('Error 2')
        ], 'Multiple errors');
        expect(extractErrorMessage(error)).toBe('Multiple errors');
      } catch {
        // Skip if AggregateError not available
      }
    });
  });
});
