import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGameStats } from '../useGameStats';
import * as sportradarAPI from '@/services/api/sportradar';
import type { MatchPanelGame } from '@/types';

// Mock API
vi.mock('@/services/api/sportradar', () => ({
  getNBAGameBoxscore: vi.fn(),
  getNBATeamStats: vi.fn(),
}));

const mockedAPI = vi.mocked(sportradarAPI);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useGameStats', () => {
  const mockGame: MatchPanelGame = {
    id: 'game-123',
    home: {
      team: { id: 'home-id', name: 'Lakers', alias: 'LAL' },
      score: 100,
      record: { wins: 25, losses: 15 },
    },
    away: {
      team: { id: 'away-id', name: 'Celtics', alias: 'BOS' },
      score: 95,
      record: { wins: 30, losses: 10 },
    },
    scheduledTime: new Date('2024-01-15T20:00:00Z'),
    status: 'scheduled',
    isLive: false,
    clock: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scheduled games (season stats)', () => {
    it('should fetch season stats for scheduled games', async () => {
      const mockSeasonStats = {
        alias: 'LAL',
        statistics: { average: { points: 110 } },
        players: [
          {
            id: 'player-1',
            full_name: 'LeBron James',
            first_name: 'LeBron',
            last_name: 'James',
            average: {
              points: 25,
              rebounds: 8,
              assists: 7,
              field_goals_pct: 0.52,
              three_points_pct: 0.35,
            },
          },
        ],
      };

      mockedAPI.getNBATeamStats.mockResolvedValue(mockSeasonStats as any);

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: mockGame }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockedAPI.getNBATeamStats).toHaveBeenCalledWith('home-id');
      expect(mockedAPI.getNBATeamStats).toHaveBeenCalledWith('away-id');
      expect(result.current.isSeasonStats).toBe(true);
    });

    it('should return empty arrays when season stats not loaded', () => {
      mockedAPI.getNBATeamStats.mockResolvedValue(null as any);

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: mockGame }),
        { wrapper: createWrapper() }
      );

      expect(result.current.homePlayers).toEqual([]);
      expect(result.current.awayPlayers).toEqual([]);
    });
  });

  describe('live games (boxscore)', () => {
    const liveGame: MatchPanelGame = {
      ...mockGame,
      status: 'inprogress',
      isLive: true,
      clock: { quarter: 3, time: '5:30' },
    };

    it('should fetch boxscore for live games', async () => {
      const mockBoxscore = {
        status: 'inprogress',
        home: {
          alias: 'LAL',
          points: 85,
          players: [
            {
              id: 'player-1',
              full_name: 'LeBron James',
              played: true,
              on_court: true,
              statistics: {
                points: 20,
                rebounds: 8,
                assists: 6,
                field_goals_pct: 0.55,
                three_points_pct: 0.40,
                field_goals_made: 8,
                field_goals_att: 15,
                three_points_made: 2,
                three_points_att: 5,
                steals: 2,
                blocks: 1,
                turnovers: 3,
                personal_fouls: 2,
                plus_minus: 10,
                minutes: '32:15',
              },
            },
          ],
        },
        away: {
          alias: 'BOS',
          points: 80,
          players: [
            {
              id: 'player-2',
              full_name: 'Jayson Tatum',
              played: true,
              on_court: true,
              statistics: {
                points: 25,
                rebounds: 7,
                assists: 5,
                field_goals_pct: 0.50,
                three_points_pct: 0.38,
                field_goals_made: 10,
                field_goals_att: 20,
                three_points_made: 3,
                three_points_att: 8,
                steals: 1,
                blocks: 0,
                turnovers: 2,
                personal_fouls: 3,
                plus_minus: 8,
                minutes: '35:20',
              },
            },
          ],
        },
      };

      mockedAPI.getNBAGameBoxscore.mockResolvedValue(mockBoxscore as any);

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: liveGame, autoRefresh: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockedAPI.getNBAGameBoxscore).toHaveBeenCalledWith('game-123');
      expect(result.current.isSeasonStats).toBe(false);
      expect(result.current.homePlayers.length).toBeGreaterThan(0);
      expect(result.current.awayPlayers.length).toBeGreaterThan(0);
    });

    it('should fallback to season stats if boxscore has no players', async () => {
      const mockBoxscore = {
        status: 'inprogress',
        home: { alias: 'LAL', points: 0, players: [] },
        away: { alias: 'BOS', points: 0, players: [] },
      };

      const mockSeasonStats = {
        alias: 'LAL',
        statistics: { average: { points: 110 } },
        players: [
          {
            id: 'player-1',
            full_name: 'LeBron James',
            average: { points: 25, rebounds: 8, assists: 7 },
          },
        ],
      };

      mockedAPI.getNBAGameBoxscore.mockResolvedValue(mockBoxscore as any);
      mockedAPI.getNBATeamStats.mockResolvedValue(mockSeasonStats as any);

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: liveGame }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fallback to season stats
      expect(result.current.isSeasonStats).toBe(true);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null gameId', () => {
      const { result } = renderHook(
        () => useGameStats({ gameId: null, game: null }),
        { wrapper: createWrapper() }
      );

      expect(result.current.homePlayers).toEqual([]);
      expect(result.current.awayPlayers).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      mockedAPI.getNBAGameBoxscore.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: { ...mockGame, isLive: true } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toContain('API Error');
    });

    it('should handle missing player statistics', async () => {
      const mockBoxscore = {
        status: 'inprogress',
        home: {
          alias: 'LAL',
          points: 85,
          players: [
            {
              id: 'player-1',
              full_name: 'LeBron James',
              played: true,
              // Missing statistics
            },
          ],
        },
        away: { alias: 'BOS', points: 80, players: [] },
      };

      mockedAPI.getNBAGameBoxscore.mockResolvedValue(mockBoxscore as any);

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: { ...mockGame, isLive: true } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Player without stats should be filtered out
      expect(result.current.homePlayers.length).toBe(0);
    });

    it('should handle players with partial statistics', async () => {
      const mockBoxscore = {
        status: 'inprogress',
        home: {
          alias: 'LAL',
          points: 85,
          players: [
            {
              id: 'player-1',
              full_name: 'LeBron James',
              played: true,
              statistics: {
                points: 20,
                // Missing other stats
              },
            },
          ],
        },
        away: { alias: 'BOS', points: 80, players: [] },
      };

      mockedAPI.getNBAGameBoxscore.mockResolvedValue(mockBoxscore as any);

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: { ...mockGame, isLive: true } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should handle missing stats with defaults
      const player = result.current.homePlayers[0];
      expect(player.points).toBe(20);
      expect(player.rebounds).toBe(0); // Default
    });

    it('should handle percentage normalization (decimal vs percentage)', async () => {
      const mockBoxscore = {
        status: 'inprogress',
        home: {
          alias: 'LAL',
          points: 100,
          players: [
            {
              id: 'player-1',
              full_name: 'LeBron James',
              played: true,
              statistics: {
                points: 20,
                field_goals_pct: 0.52, // Decimal format
                three_points_pct: 0.35, // Decimal format
                rebounds: 8,
                assists: 7,
              },
            },
          ],
        },
        away: { alias: 'BOS', points: 80, players: [] },
      };

      mockedAPI.getNBAGameBoxscore.mockResolvedValue(mockBoxscore as any);

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: { ...mockGame, isLive: true } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const player = result.current.homePlayers[0];
      expect(player.fieldGoalPct).toBe(52); // Converted to percentage
      expect(player.threePointPct).toBe(35); // Converted to percentage
    });

    it('should calculate percentages from made/attempted when percentage missing', async () => {
      const mockBoxscore = {
        status: 'inprogress',
        home: {
          alias: 'LAL',
          points: 100,
          players: [
            {
              id: 'player-1',
              full_name: 'LeBron James',
              played: true,
              statistics: {
                points: 20,
                // No percentage, but has made/attempted
                field_goals_made: 8,
                field_goals_att: 16,
                three_points_made: 2,
                three_points_att: 5,
                rebounds: 8,
                assists: 7,
              },
            },
          ],
        },
        away: { alias: 'BOS', points: 80, players: [] },
      };

      mockedAPI.getNBAGameBoxscore.mockResolvedValue(mockBoxscore as any);

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: { ...mockGame, isLive: true } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const player = result.current.homePlayers[0];
      expect(player.fieldGoalPct).toBe(50); // 8/16 * 100
      expect(player.threePointPct).toBe(40); // 2/5 * 100
    });
  });

  describe('player sorting and utilities', () => {
    it('should sort players by points', async () => {
      const mockBoxscore = {
        status: 'inprogress',
        home: {
          alias: 'LAL',
          points: 100,
          players: [
            {
              id: 'player-1',
              full_name: 'Player 1',
              played: true,
              statistics: { points: 10, rebounds: 5, assists: 3 },
            },
            {
              id: 'player-2',
              full_name: 'Player 2',
              played: true,
              statistics: { points: 25, rebounds: 8, assists: 7 },
            },
            {
              id: 'player-3',
              full_name: 'Player 3',
              played: true,
              statistics: { points: 15, rebounds: 6, assists: 4 },
            },
          ],
        },
        away: { alias: 'BOS', points: 80, players: [] },
      };

      mockedAPI.getNBAGameBoxscore.mockResolvedValue(mockBoxscore as any);

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: { ...mockGame, isLive: true } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const sorted = result.current.sortPlayers(
        result.current.homePlayers,
        'points',
        'desc'
      );

      expect(sorted[0].points).toBe(25);
      expect(sorted[1].points).toBe(15);
      expect(sorted[2].points).toBe(10);
    });

    it('should get top scorer', async () => {
      const mockBoxscore = {
        status: 'inprogress',
        home: {
          alias: 'LAL',
          points: 100,
          players: [
            {
              id: 'player-1',
              full_name: 'Player 1',
              played: true,
              statistics: { points: 10, rebounds: 5, assists: 3 },
            },
            {
              id: 'player-2',
              full_name: 'Player 2',
              played: true,
              statistics: { points: 25, rebounds: 8, assists: 7 },
            },
          ],
        },
        away: { alias: 'BOS', points: 80, players: [] },
      };

      mockedAPI.getNBAGameBoxscore.mockResolvedValue(mockBoxscore as any);

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: { ...mockGame, isLive: true } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const topScorer = result.current.getTopScorer('home');
      expect(topScorer?.points).toBe(25);
      expect(topScorer?.name).toBe('Player 2');
    });

    it('should get hot hand players', async () => {
      const mockBoxscore = {
        status: 'inprogress',
        home: {
          alias: 'LAL',
          points: 100,
          players: [
            {
              id: 'player-1',
              full_name: 'Hot Player',
              played: true,
              statistics: {
                points: 20,
                field_goals_pct: 0.60, // > 50%
                field_goals_made: 6,
                field_goals_att: 10,
                three_points_pct: 0.45, // > 40%
                three_points_made: 3,
                three_points_att: 7,
                rebounds: 5,
                assists: 3,
              },
            },
            {
              id: 'player-2',
              full_name: 'Cold Player',
              played: true,
              statistics: {
                points: 10,
                field_goals_pct: 0.30, // < 50%
                field_goals_made: 3,
                field_goals_att: 10,
                rebounds: 5,
                assists: 3,
              },
            },
          ],
        },
        away: { alias: 'BOS', points: 80, players: [] },
      };

      mockedAPI.getNBAGameBoxscore.mockResolvedValue(mockBoxscore as any);

      const { result } = renderHook(
        () => useGameStats({ gameId: 'game-123', game: { ...mockGame, isLive: true } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const hotHandPlayers = result.current.getHotHandPlayers('home');
      expect(hotHandPlayers.length).toBe(1);
      expect(hotHandPlayers[0].name).toBe('Hot Player');
    });
  });

  describe('injury handling', () => {
    it('should include injury status when provided', async () => {
      const mockBoxscore = {
        status: 'inprogress',
        home: {
          alias: 'LAL',
          points: 100,
          players: [
            {
              id: 'player-1',
              full_name: 'Injured Player',
              played: true,
              statistics: { points: 20, rebounds: 8, assists: 7 },
            },
          ],
        },
        away: { alias: 'BOS', points: 80, players: [] },
      };

      const mockInjuries = {
        players: [
          {
            id: 'player-1',
            full_name: 'Injured Player',
            injuries: [{ status: 'Out', description: 'Knee injury' }],
          },
        ],
      };

      mockedAPI.getNBAGameBoxscore.mockResolvedValue(mockBoxscore as any);

      const { result } = renderHook(
        () =>
          useGameStats({
            gameId: 'game-123',
            game: { ...mockGame, isLive: true },
            homeInjuries: mockInjuries as any,
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const player = result.current.homePlayers[0];
      expect(player.isInjured).toBe(true);
      expect(player.injuryStatus).toBe('Out');
    });
  });
});
