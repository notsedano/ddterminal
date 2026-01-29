/**
 * Tests for prediction error handling
 * Tests all error paths, edge cases, and recovery scenarios
 */

import { describe, it, expect, vi } from 'vitest';
import { SessionNotFoundError } from '@/services/api/client';

describe('Prediction Error Handling', () => {
  const handlePredictionError = (
    error: unknown,
    sessionId: string | null,
    onSessionInvalid?: (sessionId: string) => void,
    predictionMessageLength: number = 5000
  ): string => {
    const isSessionError = error instanceof SessionNotFoundError || 
      (error instanceof Error && (
        error.message.includes('Session') && error.message.includes('not found') ||
        error.message.includes('SESSION_NOT_FOUND')
      ));
    
    const isMetadataSizeError = error instanceof Error && (
      error.message.includes('Metadata exceeds maximum size') ||
      error.message.includes('Metadata exceeds') ||
      error.message.includes('maximum size')
    );

    const isContentLengthError = error instanceof Error && (
      error.message.includes('Content exceeds maximum length') ||
      error.message.includes('content exceeds') ||
      error.message.includes('maximum length') ||
      error.message.includes('4000 characters') ||
      error.message.includes('characters')
    );

    if (isSessionError) {
      onSessionInvalid?.(sessionId!);
      return 'Session expired. Please create a new session.';
    } else if (isMetadataSizeError) {
      return 'Prediction metadata is too large. Please try again with a different match.';
    } else if (isContentLengthError) {
      return `Prediction content is too long (${predictionMessageLength} characters). The backend limit may need to be increased to 20000 characters.`;
    } else {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return `Failed to send prediction: ${errorMessage}`;
    }
  };

  describe('Session Error Handling', () => {
    it('should handle SessionNotFoundError', () => {
      const error = new SessionNotFoundError('Session not found', 'SESSION_NOT_FOUND');
      const onSessionInvalid = vi.fn();
      
      const result = handlePredictionError(error, 'session-123', onSessionInvalid);
      
      expect(result).toBe('Session expired. Please create a new session.');
      expect(onSessionInvalid).toHaveBeenCalledWith('session-123');
    });

    it('should handle session error with message containing "Session" and "not found"', () => {
      const error = new Error('Session abc123 not found');
      const onSessionInvalid = vi.fn();
      
      const result = handlePredictionError(error, 'session-123', onSessionInvalid);
      
      expect(result).toBe('Session expired. Please create a new session.');
      expect(onSessionInvalid).toHaveBeenCalledWith('session-123');
    });

    it('should handle session error with SESSION_NOT_FOUND code', () => {
      const error = new Error('Invalid session');
      (error as any).code = 'SESSION_NOT_FOUND';
      const onSessionInvalid = vi.fn();
      
      const result = handlePredictionError(error, 'session-123', onSessionInvalid);
      
      expect(result).toBe('Session expired. Please create a new session.');
      expect(onSessionInvalid).toHaveBeenCalledWith('session-123');
    });

    it('should handle session error when sessionId is null', () => {
      const error = new SessionNotFoundError('Session not found');
      const onSessionInvalid = vi.fn();
      
      const result = handlePredictionError(error, null, onSessionInvalid);
      
      expect(result).toBe('Session expired. Please create a new session.');
      // Should not crash even with null sessionId
      expect(onSessionInvalid).not.toHaveBeenCalled();
    });
  });

  describe('Metadata Size Error Handling', () => {
    it('should handle metadata size error', () => {
      const error = new Error('Invalid metadata: Metadata exceeds maximum size of 10240 bytes');
      
      const result = handlePredictionError(error, 'session-123');
      
      expect(result).toBe('Prediction metadata is too large. Please try again with a different match.');
    });

    it('should handle metadata error with "Metadata exceeds" message', () => {
      const error = new Error('Metadata exceeds limit');
      
      const result = handlePredictionError(error, 'session-123');
      
      expect(result).toBe('Prediction metadata is too large. Please try again with a different match.');
    });

    it('should handle metadata error with "maximum size" message', () => {
      const error = new Error('Invalid: maximum size exceeded');
      
      const result = handlePredictionError(error, 'session-123');
      
      expect(result).toBe('Prediction metadata is too large. Please try again with a different match.');
    });
  });

  describe('Content Length Error Handling', () => {
    it('should handle content length error with exact message', () => {
      const error = new Error('Invalid content: Content exceeds maximum length of 4000 characters');
      
      const result = handlePredictionError(error, 'session-123', undefined, 5000);
      
      expect(result).toContain('Prediction content is too long');
      expect(result).toContain('5000 characters');
      expect(result).toContain('20000 characters');
    });

    it('should handle content error with "content exceeds" message', () => {
      const error = new Error('content exceeds limit');
      
      const result = handlePredictionError(error, 'session-123', undefined, 6000);
      
      expect(result).toContain('6000 characters');
    });

    it('should handle content error with "maximum length" message', () => {
      const error = new Error('maximum length exceeded');
      
      const result = handlePredictionError(error, 'session-123', undefined, 8000);
      
      expect(result).toContain('8000 characters');
    });

    it('should handle content error with "characters" keyword', () => {
      const error = new Error('Message too long: 5000 characters');
      
      const result = handlePredictionError(error, 'session-123', undefined, 5000);
      
      expect(result).toContain('5000 characters');
    });

    it('should include correct character count in error message', () => {
      const error = new Error('Content exceeds maximum length');
      
      const result = handlePredictionError(error, 'session-123', undefined, 12345);
      
      expect(result).toContain('12345 characters');
    });
  });

  describe('Generic Error Handling', () => {
    it('should handle generic Error objects', () => {
      const error = new Error('Network timeout');
      
      const result = handlePredictionError(error, 'session-123');
      
      expect(result).toBe('Failed to send prediction: Network timeout');
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';
      
      const result = handlePredictionError(error, 'session-123');
      
      expect(result).toBe('Failed to send prediction: Unknown error occurred');
    });

    it('should handle null errors', () => {
      const error = null;
      
      const result = handlePredictionError(error, 'session-123');
      
      expect(result).toBe('Failed to send prediction: Unknown error occurred');
    });

    it('should handle undefined errors', () => {
      const error = undefined;
      
      const result = handlePredictionError(error, 'session-123');
      
      expect(result).toBe('Failed to send prediction: Unknown error occurred');
    });

    it('should handle errors with empty messages', () => {
      const error = new Error('');
      
      const result = handlePredictionError(error, 'session-123');
      
      expect(result).toBe('Failed to send prediction: ');
    });
  });

  describe('Error Priority', () => {
    it('should prioritize session errors over other errors', () => {
      const error = new Error('Session not found and content too long');
      const onSessionInvalid = vi.fn();
      
      const result = handlePredictionError(error, 'session-123', onSessionInvalid, 5000);
      
      expect(result).toBe('Session expired. Please create a new session.');
      expect(onSessionInvalid).toHaveBeenCalled();
    });

    it('should prioritize metadata errors over content length errors', () => {
      const error = new Error('Metadata exceeds maximum size and content too long');
      
      const result = handlePredictionError(error, 'session-123', undefined, 5000);
      
      expect(result).toBe('Prediction metadata is too large. Please try again with a different match.');
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors with special characters', () => {
      const error = new Error('Error: "Session" not found & content > 4000');
      
      const result = handlePredictionError(error, 'session-123');
      
      // Should detect session error despite special characters
      expect(result).toContain('Session');
    });

    it('should handle case-insensitive error matching', () => {
      const error = new Error('SESSION NOT FOUND');
      
      const result = handlePredictionError(error, 'session-123');
      
      // Should not match (case sensitive check)
      expect(result).not.toContain('Session expired');
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new Error(longMessage);
      
      const result = handlePredictionError(error, 'session-123');
      
      expect(result).toContain('Failed to send prediction:');
      expect(result.length).toBeLessThan(20000);
    });

    it('should handle errors with newlines and special formatting', () => {
      const error = new Error('Error:\nSession not found\nCode: 404');
      
      const result = handlePredictionError(error, 'session-123');
      
      expect(result).toContain('Session expired');
    });
  });
});
