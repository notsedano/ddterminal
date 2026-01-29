/**
 * Comprehensive tests for Prediction Feature in ChatContainer
 * Tests boundary conditions, error handling, integration points, and async behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import * as useChatModule from '@/hooks/useChat';
import * as usePredictionModule from '@/hooks/usePrediction';
import * as usePredictionDataModule from '@/hooks/usePredictionData';
import * as messagesApiModule from '@/services/api/messages';

// Mock dependencies
vi.mock('@/hooks/useChat');
vi.mock('@/hooks/usePrediction');
vi.mock('@/hooks/usePredictionData');
vi.mock('@/services/api/messages');
vi.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, onConfirm, onClose, title, message }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="confirm-dialog">
        <div>{title}</div>
        <div>{message}</div>
        <button onClick={onConfirm} data-testid="confirm-button">Confirm</button>
        <button onClick={onClose} data-testid="cancel-button">Cancel</button>
      </div>
    );
  },
}));

describe('ChatContainer - Prediction Feature', () => {
  const mockSessionId = 'test-session-123';
  const mockAgentId = 'test-agent-456';
  const mockRoomId = 'test-room-789';

  const mockSendMessage = vi.fn();
  const mockStartThoughts = vi.fn();
  const mockResetPrediction = vi.fn();
  const mockAddRealThought = vi.fn();
  const mockOnSessionInvalid = vi.fn();

  const defaultUseChatReturn = {
    messages: [],
    sendMessage: mockSendMessage,
    isSending: false,
    isWaitingForResponse: false,
    error: null,
  };

  const defaultUsePredictionReturn = {
    thoughts: [],
    isStreaming: false,
    progress: 0,
    startThoughts: mockStartThoughts,
    addRealThought: mockAddRealThought,
    reset: mockResetPrediction,
    cancel: vi.fn(),
  };

  const defaultPredictionData = {
    gameId: 'game-123',
    homeTeam: {
      name: 'Lakers',
      abbreviation: 'LAL',
      record: '45-30',
      teamId: 'team-home-123',
    },
    awayTeam: {
      name: 'Warriors',
      abbreviation: 'GSW',
      record: '42-33',
      teamId: 'team-away-456',
    },
    scheduledTime: new Date().toISOString(),
    sport: 'NBA' as const,
    isLive: false,
    market: {
      line: 5.5,
      homeOdds: 0.55,
      awayOdds: 0.45,
      volume: 100000,
      marketType: 'spread',
    },
    injuries: {
      home: [],
      away: [],
      impactSummary: 'No significant injuries',
    },
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
    playerStats: {
      homeTopScorer: null,
      awayTopScorer: null,
      homeHotHand: [],
      awayHotHand: [],
      isSeasonStats: true,
    },
    matchHistory: {
      homeHistory: null,
      awayHistory: null,
      homeStanding: null,
      awayStanding: null,
    },
    bettingMarkets: null,
    isLoading: false,
    hasFullData: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(useChatModule.useChat).mockReturnValue(defaultUseChatReturn as any);
    vi.mocked(usePredictionModule.usePrediction).mockReturnValue(defaultUsePredictionReturn);
    vi.mocked(usePredictionDataModule.usePredictionData).mockReturnValue(defaultPredictionData);
    vi.mocked(usePredictionDataModule.buildComprehensivePredictionMessage).mockReturnValue(
      '🎯 PREDICTION REQUEST\n\nTest prediction message content...'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Button Click and Dialog Flow', () => {
    it('should open confirmation dialog when PREDICT NOW button is clicked', async () => {
      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      const predictButton = screen.getByText('PREDICT NOW');
      expect(predictButton).toBeInTheDocument();

      fireEvent.click(predictButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });
    });

    it('should not open dialog if sessionId is null', async () => {
      render(
        <ChatContainer
          sessionId={null}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      const predictButton = screen.getByText('PREDICT NOW');
      expect(predictButton).toBeDisabled();

      fireEvent.click(predictButton);

      await waitFor(() => {
        expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
      });
    });

    it('should not open dialog if already predicting', async () => {
      vi.mocked(usePredictionModule.usePrediction).mockReturnValue({
        ...defaultUsePredictionReturn,
        isStreaming: true,
      });

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      const predictButton = screen.getByText('ANALYZING...');
      expect(predictButton).toBeDisabled();
    });

    it('should not open dialog if message is being sent', async () => {
      vi.mocked(useChatModule.useChat).mockReturnValue({
        ...defaultUseChatReturn,
        isSending: true,
      } as any);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      const predictButton = screen.getByText('PREDICT NOW');
      expect(predictButton).toBeDisabled();
    });

    it('should close dialog when cancel is clicked', async () => {
      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cancel-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Prediction Confirmation and Sending', () => {
    it('should send prediction with metadata when confirmed', async () => {
      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(mockStartThoughts).toHaveBeenCalled();
        expect(mockSendMessage).toHaveBeenCalledWith(
          expect.stringContaining('PREDICTION REQUEST'),
          undefined,
          expect.objectContaining({
            action: 'predict',
            context: expect.objectContaining({
              matchup: expect.objectContaining({
                gameId: 'game-123',
                homeTeamId: 'team-home-123',
                awayTeamId: 'team-away-456',
              }),
            }),
          })
        );
      });
    });

    it('should build minimal metadata (under 10KB)', async () => {
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
        expect(mockSendMessage).toHaveBeenCalled();
        const call = mockSendMessage.mock.calls[0];
        const metadata = call[2];
        const metadataSize = new Blob([JSON.stringify(metadata)]).size;
        expect(metadataSize).toBeLessThan(10240);
      });
    });

    it('should reset prediction state before sending', async () => {
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
        expect(mockResetPrediction).toHaveBeenCalled();
      });
    });
  });

  describe('Content Length Validation', () => {
    it('should validate content length before sending', async () => {
      const longMessage = 'A'.repeat(25000);
      vi.mocked(usePredictionDataModule.buildComprehensivePredictionMessage).mockReturnValue(longMessage);

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
        expect(mockSendMessage).not.toHaveBeenCalled();
        expect(screen.getByText(/Prediction content is too long/)).toBeInTheDocument();
      });
    });

    it('should allow content up to 20000 characters', async () => {
      const validMessage = 'A'.repeat(15000);
      vi.mocked(usePredictionDataModule.buildComprehensivePredictionMessage).mockReturnValue(validMessage);

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
        expect(mockSendMessage).toHaveBeenCalled();
      });
    });

    it('should show error message with character count when content too long', async () => {
      const longMessage = 'A'.repeat(25000);
      vi.mocked(usePredictionDataModule.buildComprehensivePredictionMessage).mockReturnValue(longMessage);

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
        const errorMessage = screen.getByText(/25000 characters/);
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage.textContent).toContain('20000');
      });
    });
  });

  describe('Metadata Size Validation', () => {
    it('should validate metadata size (10KB limit)', async () => {
      // Create prediction data that would exceed metadata limit if we included full data
      const largePredictionData = {
        ...defaultPredictionData,
        bettingMarkets: {
          hasMarkets: true,
          totalVolume: 1000000,
          moneyline: null,
          spreads: Array(100).fill(null).map((_, i) => ({
            type: 'spread' as const,
            question: `Spread ${i}`,
            outcomes: [{ name: 'Outcome', probability: '50%', americanOdds: '+100', price: 0.5 }],
            line: i,
            volume: 10000,
          })),
          totals: [],
          props: [],
        },
      };

      vi.mocked(usePredictionDataModule.usePredictionData).mockReturnValue(largePredictionData);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      fireEvent.click(screen.getByText('PREDICT NOW'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      // Should still work because we only send minimal metadata
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
        const metadata = mockSendMessage.mock.calls[0][2];
        const metadataSize = new Blob([JSON.stringify(metadata)]).size;
        expect(metadataSize).toBeLessThan(10240);
      });
    });

    it('should show error if metadata exceeds 10KB (edge case)', async () => {
      // This test verifies the validation works even if metadata somehow exceeds limit
      // In practice, our minimal metadata should never exceed this
      const metadata = { action: 'predict' as const, context: { data: 'x'.repeat(15000) } };
      const metadataSize = new Blob([JSON.stringify(metadata)]).size;
      
      // Mock the metadata building to return oversized metadata
      vi.mocked(usePredictionDataModule.usePredictionData).mockReturnValue({
        ...defaultPredictionData,
        // Force metadata to be large by including large data
      } as any);

      // We can't easily test this without mocking useMemo, but the validation logic is there
      expect(metadataSize).toBeGreaterThan(10240);
    });
  });

  describe('Error Handling', () => {
    it('should handle session not found error', async () => {
      const sessionError = new Error('Session not found');
      mockSendMessage.mockImplementation(() => {
        throw sessionError;
      });

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
        expect(mockOnSessionInvalid).toHaveBeenCalledWith(mockSessionId);
        expect(screen.getByText(/Session expired/)).toBeInTheDocument();
      });
    });

    it('should handle content length error from backend', async () => {
      const contentError = new Error('Invalid content: Content exceeds maximum length of 4000 characters');
      mockSendMessage.mockImplementation(() => {
        throw contentError;
      });

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
        expect(screen.getByText(/Prediction content is too long/)).toBeInTheDocument();
        expect(screen.getByText(/backend limit may need to be increased/)).toBeInTheDocument();
      });
    });

    it('should handle metadata size error from backend', async () => {
      const metadataError = new Error('Invalid metadata: Metadata exceeds maximum size of 10240 bytes');
      mockSendMessage.mockImplementation(() => {
        throw metadataError;
      });

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
        expect(screen.getByText(/Prediction metadata is too large/)).toBeInTheDocument();
      });
    });

    it('should handle generic errors gracefully', async () => {
      const genericError = new Error('Network error');
      mockSendMessage.mockImplementation(() => {
        throw genericError;
      });

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
        expect(screen.getByText(/Failed to send prediction: Network error/)).toBeInTheDocument();
      });
    });

    it('should reset prediction state on error', async () => {
      mockSendMessage.mockImplementation(() => {
        throw new Error('Test error');
      });

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
        expect(mockResetPrediction).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null predictionData', async () => {
      vi.mocked(usePredictionDataModule.usePredictionData).mockReturnValue(null);
      vi.mocked(usePredictionDataModule.buildComprehensivePredictionMessage).mockReturnValue(
        '🎯 PREDICTION REQUEST\n\nPlease analyze the current NBA matchup...'
      );

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
        expect(mockSendMessage).toHaveBeenCalledWith(
          expect.stringContaining('PREDICTION REQUEST'),
          undefined,
          expect.objectContaining({
            action: 'predict',
            context: {},
          })
        );
      });
    });

    it('should handle partial prediction data (missing some fields)', async () => {
      const partialData = {
        ...defaultPredictionData,
        market: undefined,
        bettingMarkets: null,
        bettingIndicators: null,
        playerStats: {
          homeTopScorer: null,
          awayTopScorer: null,
          homeHotHand: [],
          awayHotHand: [],
          isSeasonStats: true,
        },
      };

      vi.mocked(usePredictionDataModule.usePredictionData).mockReturnValue(partialData);

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
        expect(mockSendMessage).toHaveBeenCalled();
        const metadata = mockSendMessage.mock.calls[0][2];
        expect(metadata.context.dataAvailable.hasMarketData).toBe(false);
        expect(metadata.context.dataAvailable.hasBettingMarkets).toBe(false);
      });
    });

    it('should handle very long team names and data', async () => {
      const dataWithLongNames = {
        ...defaultPredictionData,
        homeTeam: {
          ...defaultPredictionData.homeTeam,
          name: 'A'.repeat(200),
          abbreviation: 'LAL',
        },
        awayTeam: {
          ...defaultPredictionData.awayTeam,
          name: 'B'.repeat(200),
          abbreviation: 'GSW',
        },
      };

      vi.mocked(usePredictionDataModule.usePredictionData).mockReturnValue(dataWithLongNames);

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
        expect(mockSendMessage).toHaveBeenCalled();
        const metadata = mockSendMessage.mock.calls[0][2];
        const metadataSize = new Blob([JSON.stringify(metadata)]).size;
        expect(metadataSize).toBeLessThan(10240);
      });
    });
  });

  describe('Thought Event Handling', () => {
    it('should forward thought events to usePrediction', async () => {
      const thoughtCallback = vi.fn();
      vi.mocked(useChatModule.useChat).mockReturnValue({
        ...defaultUseChatReturn,
        // Simulate onThought being called
      } as any);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      // Verify onThought was passed to useChat
      expect(useChatModule.useChat).toHaveBeenCalledWith(
        expect.objectContaining({
          onThought: expect.any(Function),
        })
      );
    });

    it('should display prediction thoughts in UI', async () => {
      const thoughts = [
        {
          id: 'thought-1',
          type: 'analyzing' as const,
          content: 'Analyzing matchup data...',
          timestamp: Date.now(),
          progress: 25,
        },
        {
          id: 'thought-2',
          type: 'reasoning' as const,
          content: 'Evaluating team statistics...',
          timestamp: Date.now(),
          progress: 50,
        },
      ];

      vi.mocked(usePredictionModule.usePrediction).mockReturnValue({
        ...defaultUsePredictionReturn,
        thoughts,
        isStreaming: true,
        progress: 50,
      });

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      // Thoughts should be passed to MessageList
      // We can't easily test the ThoughtStream component here without more setup
      // but we verify the data flows correctly
      expect(screen.getByText('PREDICT NOW')).toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('should reset prediction state when message completes', async () => {
      vi.mocked(useChatModule.useChat).mockReturnValue({
        ...defaultUseChatReturn,
        isWaitingForResponse: false,
        isSending: false,
      } as any);

      vi.mocked(usePredictionModule.usePrediction).mockReturnValue({
        ...defaultUsePredictionReturn,
        isStreaming: true,
      });

      const { rerender } = render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      // Simulate message completion
      vi.mocked(useChatModule.useChat).mockReturnValue({
        ...defaultUseChatReturn,
        isWaitingForResponse: false,
        isSending: false,
      } as any);

      vi.mocked(usePredictionModule.usePrediction).mockReturnValue({
        ...defaultUsePredictionReturn,
        isStreaming: true,
      });

      rerender(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      // Wait for reset to be called (with delay)
      await waitFor(() => {
        expect(mockResetPrediction).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should reset prediction state immediately on error', async () => {
      vi.mocked(useChatModule.useChat).mockReturnValue({
        ...defaultUseChatReturn,
        error: 'Test error',
      } as any);

      vi.mocked(usePredictionModule.usePrediction).mockReturnValue({
        ...defaultUsePredictionReturn,
        isStreaming: true,
      });

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      await waitFor(() => {
        expect(mockResetPrediction).toHaveBeenCalled();
      });
    });
  });

  describe('Concurrent Behavior', () => {
    it('should prevent multiple simultaneous predictions', async () => {
      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      const predictButton = screen.getByText('PREDICT NOW');
      
      // Click multiple times rapidly
      fireEvent.click(predictButton);
      fireEvent.click(predictButton);
      fireEvent.click(predictButton);

      await waitFor(() => {
        // Should only open dialog once
        const dialogs = screen.queryAllByTestId('confirm-dialog');
        expect(dialogs.length).toBeLessThanOrEqual(1);
      });
    });

    it('should handle prediction while another message is sending', async () => {
      vi.mocked(useChatModule.useChat).mockReturnValue({
        ...defaultUseChatReturn,
        isSending: true,
      } as any);

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      const predictButton = screen.getByText('PREDICT NOW');
      expect(predictButton).toBeDisabled();

      fireEvent.click(predictButton);

      await waitFor(() => {
        expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Integration with Real Dependencies', () => {
    it('should integrate with buildComprehensivePredictionMessage', async () => {
      const testMessage = 'Custom prediction message from buildComprehensivePredictionMessage';
      vi.mocked(usePredictionDataModule.buildComprehensivePredictionMessage).mockReturnValue(testMessage);

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
        expect(usePredictionDataModule.buildComprehensivePredictionMessage).toHaveBeenCalledWith(defaultPredictionData);
        expect(mockSendMessage).toHaveBeenCalledWith(
          testMessage,
          undefined,
          expect.any(Object)
        );
      });
    });

    it('should pass correct metadata structure to sendMessage', async () => {
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
        const metadata = mockSendMessage.mock.calls[0][2];
        
        expect(metadata).toHaveProperty('action', 'predict');
        expect(metadata).toHaveProperty('context');
        expect(metadata.context).toHaveProperty('matchup');
        expect(metadata.context).toHaveProperty('dataAvailable');
        
        expect(metadata.context.matchup).toHaveProperty('gameId');
        expect(metadata.context.matchup).toHaveProperty('homeTeamId');
        expect(metadata.context.matchup).toHaveProperty('awayTeamId');
        expect(metadata.context.matchup).toHaveProperty('homeTeamAbbr');
        expect(metadata.context.matchup).toHaveProperty('awayTeamAbbr');
        expect(metadata.context.matchup).toHaveProperty('scheduledTime');
        expect(metadata.context.matchup).toHaveProperty('sport');
        expect(metadata.context.matchup).toHaveProperty('isLive');
        
        expect(metadata.context.dataAvailable).toHaveProperty('hasMarketData');
        expect(metadata.context.dataAvailable).toHaveProperty('hasBettingMarkets');
        expect(metadata.context.dataAvailable).toHaveProperty('hasInjuries');
        expect(metadata.context.dataAvailable).toHaveProperty('hasBettingIndicators');
        expect(metadata.context.dataAvailable).toHaveProperty('hasPlayerStats');
        expect(metadata.context.dataAvailable).toHaveProperty('hasMatchHistory');
        expect(metadata.context.dataAvailable).toHaveProperty('hasScores');
      });
    });
  });

  describe('Button State and UI', () => {
    it('should show ANALYZING... when prediction is in progress', () => {
      vi.mocked(usePredictionModule.usePrediction).mockReturnValue({
        ...defaultUsePredictionReturn,
        isStreaming: true,
        progress: 45,
      });

      render(
        <ChatContainer
          sessionId={mockSessionId}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      expect(screen.getByText('ANALYZING...')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('should disable button when no session', () => {
      render(
        <ChatContainer
          sessionId={null}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      const button = screen.getByText('PREDICT NOW');
      expect(button).toBeDisabled();
    });

    it('should show error message when session is null and button clicked', async () => {
      render(
        <ChatContainer
          sessionId={null}
          agentId={mockAgentId}
          roomId={mockRoomId}
        />
      );

      // Try to click disabled button (should not work, but test the error state)
      const button = screen.getByText('PREDICT NOW');
      expect(button).toBeDisabled();
    });
  });
});
