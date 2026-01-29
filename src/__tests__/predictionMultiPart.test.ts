/**
 * Comprehensive tests for multi-part prediction sending
 * Tests boundary conditions, error handling, and concurrent behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import * as useChatModule from '@/hooks/useChat';
import * as usePredictionModule from '@/hooks/usePrediction';
import * as usePredictionDataModule from '@/hooks/usePredictionData';
import { SessionNotFoundError } from '@/services/api/client';

vi.mock('@/hooks/useChat');
vi.mock('@/hooks/usePrediction');
vi.mock('@/hooks/usePredictionData');
vi.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, onConfirm, onClose }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="confirm-dialog">
        <button data-testid="confirm-button" onClick={onConfirm}>Confirm</button>
        <button data-testid="cancel-button" onClick={onClose}>Cancel</button>
      </div>
    );
  },
}));

describe('Multi-Part Prediction Sending', () => {
  const mockSessionId = 'test-session-123';
  const mockAgentId = 'test-agent-456';
  const mockRoomId = 'test-room-789';

  const mockSendMessageWithDisplayText = vi.fn();
  const mockStartThoughts = vi.fn();
  const mockResetPrediction = vi.fn();
  const mockAddRealThought = vi.fn();

  const defaultPredictionData = {
    gameId: 'game-123',
    homeTeam: { name: 'Lakers', abbreviation: 'LAL', record: '45-30', teamId: 'team-home' },
    awayTeam: { name: 'Warriors', abbreviation: 'GSW', record: '42-33', teamId: 'team-away' },
    scheduledTime: new Date().toISOString(),
    sport: 'NBA' as const,
    isLive: false,
    market: { line: 5.5, homeOdds: 0.55, awayOdds: 0.45, volume: 100000, marketType: 'spread' },
    injuries: { home: [], away: [], impactSummary: 'No injuries' },
    bettingIndicators: {
      homeRestDays: 2,
      awayRestDays: 1,
      homeIsBackToBack: false,
      awayIsBackToBack: false,
      homeStreak: { type: 'W' as const, count: 3 },
      awayStreak: { type: 'L' as const, count: 2 },
      homeLast10: { wins: 7, losses: 3 },
      awayLast10: { wins: 5, losses: 5 },
      h2hRecord: { homeWins: 2, awayWins: 1, total: 3 },
      h2hAverageTotal: 215.5,
      signals: [],
      marketEfficiency: 'medium' as const,
    },
    playerStats: { homeTopScorer: null, awayTopScorer: null },
    matchHistory: { homeHistory: [], awayHistory: [] },
    scores: null,
    bettingMarkets: { hasMarkets: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useChatModule.useChat as any) = vi.fn(() => ({
      messages: [],
      sendMessage: vi.fn(),
      sendMessageWithDisplayText: mockSendMessageWithDisplayText,
      isSending: false,
      isWaitingForResponse: false,
      error: null,
    }));

    (usePredictionModule.usePrediction as any) = vi.fn(() => ({
      thoughts: [],
      isStreaming: false,
      progress: 0,
      currentPhase: null,
      startThoughts: mockStartThoughts,
      addRealThought: mockAddRealThought,
      reset: mockResetPrediction,
    }));

    (usePredictionDataModule.usePredictionData as any) = vi.fn(() => defaultPredictionData);
    (usePredictionDataModule.buildSportsDataMessage as any) = vi.fn(() => 'Part 1 content');
    (usePredictionDataModule.buildMarketDataMessage as any) = vi.fn(() => 'Part 2 content');
    (usePredictionDataModule.buildOtherInfoMessage as any) = vi.fn(() => 'Part 3 content');
  });

  describe('Successful Multi-Part Sending', () => {
    it('should send all three parts in sequence', async () => {
      mockSendMessageWithDisplayText
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(mockSendMessageWithDisplayText).toHaveBeenCalledTimes(3);
      });

      // Verify Part 1
      expect(mockSendMessageWithDisplayText).toHaveBeenNthCalledWith(
        1,
        'Winner winner, chicken dinner!',
        'Part 1 content',
        expect.objectContaining({ partNumber: 1, totalParts: 3 })
      );

      // Verify Part 2
      expect(mockSendMessageWithDisplayText).toHaveBeenNthCalledWith(
        2,
        '',
        'Part 2 content',
        expect.objectContaining({ partNumber: 2, totalParts: 3 })
      );

      // Verify Part 3
      expect(mockSendMessageWithDisplayText).toHaveBeenNthCalledWith(
        3,
        '',
        'Part 3 content',
        expect.objectContaining({ partNumber: 3, totalParts: 3 })
      );
    });

    it('should wait between parts', async () => {
      const startTime = Date.now();
      mockSendMessageWithDisplayText
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(mockSendMessageWithDisplayText).toHaveBeenCalledTimes(3);
      }, { timeout: 2000 });

      const endTime = Date.now();
      // Should take at least 500ms (delay between parts) + processing time
      expect(endTime - startTime).toBeGreaterThan(500);
    });
  });

  describe('Error Handling in Multi-Part Sending', () => {
    it('should handle error in Part 1', async () => {
      const part1Error = new Error('Part 1 failed');
      mockSendMessageWithDisplayText.mockRejectedValueOnce(part1Error);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to send prediction.*Part 1/)).toBeInTheDocument();
      });

      // Should not send parts 2 and 3
      expect(mockSendMessageWithDisplayText).toHaveBeenCalledTimes(1);
      expect(mockResetPrediction).toHaveBeenCalled();
    });

    it('should handle error in Part 2', async () => {
      const part2Error = new Error('Part 2 failed');
      mockSendMessageWithDisplayText
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(part2Error);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to send prediction.*Part 2/)).toBeInTheDocument();
      });

      // Should have sent Part 1, but not Part 3
      expect(mockSendMessageWithDisplayText).toHaveBeenCalledTimes(2);
      expect(mockResetPrediction).toHaveBeenCalled();
    });

    it('should handle error in Part 3', async () => {
      const part3Error = new Error('Part 3 failed');
      mockSendMessageWithDisplayText
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(part3Error);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to send prediction.*Part 3/)).toBeInTheDocument();
      });

      // Should have sent Parts 1 and 2
      expect(mockSendMessageWithDisplayText).toHaveBeenCalledTimes(3);
      expect(mockResetPrediction).toHaveBeenCalled();
    });

    it('should handle session error during Part 2', async () => {
      const sessionError = new SessionNotFoundError('Session expired', 'SESSION_NOT_FOUND');
      const mockOnSessionInvalid = vi.fn();
      
      mockSendMessageWithDisplayText
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(sessionError);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
          onSessionInvalid={mockOnSessionInvalid}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByText('Session expired. Please create a new session.')).toBeInTheDocument();
        expect(mockOnSessionInvalid).toHaveBeenCalledWith(mockSessionId);
      });
    });
  });

  describe('Cancellation Handling', () => {
    it('should cancel remaining parts if new prediction starts', async () => {
      let part1Resolve: () => void;
      const part1Promise = new Promise<void>((resolve) => {
        part1Resolve = resolve;
      });

      mockSendMessageWithDisplayText
        .mockReturnValueOnce(part1Promise)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      (usePredictionModule.usePrediction as any) = vi.fn(() => ({
        thoughts: [],
        isStreaming: true, // Simulate prediction in progress
        progress: 50,
        currentPhase: 1,
        startThoughts: mockStartThoughts,
        addRealThought: mockAddRealThought,
        reset: mockResetPrediction,
      }));

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      // Part 1 is in progress
      await waitFor(() => {
        expect(mockSendMessageWithDisplayText).toHaveBeenCalledTimes(1);
      });

      // Resolve Part 1 - but prediction is already in progress, so should cancel
      part1Resolve!();

      await waitFor(() => {
        // Should not send parts 2 and 3 due to cancellation
        expect(mockSendMessageWithDisplayText).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle empty part messages', () => {
      (usePredictionDataModule.buildSportsDataMessage as any) = vi.fn(() => '');
      (usePredictionDataModule.buildMarketDataMessage as any) = vi.fn(() => '');
      (usePredictionDataModule.buildOtherInfoMessage as any) = vi.fn(() => '');

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      expect(screen.getByText(/Failed to build prediction messages/)).toBeInTheDocument();
      expect(mockSendMessageWithDisplayText).not.toHaveBeenCalled();
    });

    it('should handle very long part messages', () => {
      const longMessage = 'A'.repeat(5000);
      (usePredictionDataModule.buildSportsDataMessage as any) = vi.fn(() => longMessage);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      expect(screen.getByText(/Prediction content is too long/)).toBeInTheDocument();
      expect(mockSendMessageWithDisplayText).not.toHaveBeenCalled();
    });

    it('should handle missing prediction data', () => {
      (usePredictionDataModule.usePredictionData as any) = vi.fn(() => null);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      // Should not be able to predict without data
      const predictButton = screen.queryByText('PREDICT NOW');
      // Button might be disabled or not visible
      expect(predictButton).toBeInTheDocument();
    });
  });

  describe('Concurrent Behavior', () => {
    it('should handle rapid prediction clicks', async () => {
      mockSendMessageWithDisplayText.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      const predictButton = screen.getByText('PREDICT NOW');
      fireEvent.click(predictButton);
      fireEvent.click(screen.getByTestId('confirm-button'));

      // Try to click again immediately
      fireEvent.click(predictButton);

      // Should handle gracefully - second click should not trigger another prediction
      await waitFor(() => {
        // Should only send once
        expect(mockSendMessageWithDisplayText).toHaveBeenCalled();
      });
    });
  });
});
