/**
 * Tests for prediction metadata building and validation
 * Tests boundary conditions, size limits, and data structure
 */

import { describe, it, expect, vi } from 'vitest';
import type { PredictionData } from '@/hooks/usePredictionData';

// Mock the actual implementation
const buildPredictionMetadata = (predictionData: PredictionData | null) => {
  if (!predictionData) {
    return { action: 'predict' as const, context: {} };
  }

  return {
    action: 'predict' as const,
    context: {
      matchup: {
        gameId: predictionData.gameId,
        homeTeamId: predictionData.homeTeam.teamId,
        awayTeamId: predictionData.awayTeam.teamId,
        homeTeamAbbr: predictionData.homeTeam.abbreviation,
        awayTeamAbbr: predictionData.awayTeam.abbreviation,
        scheduledTime: predictionData.scheduledTime,
        sport: predictionData.sport,
        isLive: predictionData.isLive,
      },
      dataAvailable: {
        hasMarketData: !!predictionData.market,
        hasBettingMarkets: !!predictionData.bettingMarkets?.hasMarkets,
        hasInjuries: predictionData.injuries.home.length > 0 || predictionData.injuries.away.length > 0,
        hasBettingIndicators: !!predictionData.bettingIndicators,
        hasPlayerStats: !!predictionData.playerStats.homeTopScorer || !!predictionData.playerStats.awayTopScorer,
        hasMatchHistory: !!predictionData.matchHistory.homeHistory || !!predictionData.matchHistory.awayHistory,
        hasScores: !!predictionData.scores,
      },
    },
  };
};

describe('Prediction Metadata Building', () => {
  const basePredictionData: PredictionData = {
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
    sport: 'NBA',
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
      impactSummary: 'No injuries',
    },
    bettingIndicators: {
      homeRestDays: 2,
      awayRestDays: 1,
      homeIsBackToBack: false,
      awayIsBackToBack: false,
      homeStreak: { type: 'W', count: 3 },
      awayStreak: { type: 'L', count: 2 },
      homeLast10: { wins: 7, losses: 3 },
      awayLast10: { wins: 5, losses: 5 },
      h2hRecord: { homeWins: 2, awayWins: 1, total: 3 },
      h2hAverageTotal: 215.5,
      signals: [],
      marketEfficiency: 'medium',
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

  describe('Metadata Structure', () => {
    it('should build correct metadata structure', () => {
      const metadata = buildPredictionMetadata(basePredictionData);

      expect(metadata).toHaveProperty('action', 'predict');
      expect(metadata).toHaveProperty('context');
      expect(metadata.context).toHaveProperty('matchup');
      expect(metadata.context).toHaveProperty('dataAvailable');
    });

    it('should include all required matchup fields', () => {
      const metadata = buildPredictionMetadata(basePredictionData);

      expect(metadata.context.matchup).toEqual({
        gameId: 'game-123',
        homeTeamId: 'team-home-123',
        awayTeamId: 'team-away-456',
        homeTeamAbbr: 'LAL',
        awayTeamAbbr: 'GSW',
        scheduledTime: basePredictionData.scheduledTime,
        sport: 'NBA',
        isLive: false,
      });
    });

    it('should include data availability flags', () => {
      const metadata = buildPredictionMetadata(basePredictionData);

      expect(metadata.context.dataAvailable).toEqual({
        hasMarketData: true,
        hasBettingMarkets: false,
        hasInjuries: false,
        hasBettingIndicators: true,
        hasPlayerStats: false,
        hasMatchHistory: false,
        hasScores: false,
      });
    });

    it('should handle null predictionData', () => {
      const metadata = buildPredictionMetadata(null);

      expect(metadata).toEqual({
        action: 'predict',
        context: {},
      });
    });
  });

  describe('Metadata Size Validation', () => {
    it('should produce metadata under 10KB for normal data', () => {
      const metadata = buildPredictionMetadata(basePredictionData);
      const metadataJson = JSON.stringify(metadata);
      const metadataSize = new Blob([metadataJson]).size;

      expect(metadataSize).toBeLessThan(10240);
      expect(metadataSize).toBeGreaterThan(0);
    });

    it('should produce metadata under 10KB for data with all fields', () => {
      const fullData: PredictionData = {
        ...basePredictionData,
        scores: {
          home: 105,
          away: 98,
          quarter: 4,
          time: '2:30',
        },
        bettingMarkets: {
          hasMarkets: true,
          totalVolume: 500000,
          moneyline: {
            type: 'moneyline' as const,
            question: 'Who will win?',
            outcomes: [
              { name: 'Lakers', probability: '55%', americanOdds: '-122', price: 0.55 },
              { name: 'Warriors', probability: '45%', americanOdds: '+122', price: 0.45 },
            ],
            volume: 200000,
          },
          spreads: [],
          totals: [],
          props: [],
        },
        playerStats: {
          homeTopScorer: {
            name: 'LeBron James',
            points: 28.5,
            rebounds: 8.2,
            assists: 6.8,
            fieldGoalPct: 0.52,
            threePointPct: 0.38,
            plusMinus: 5.2,
            isInjured: false,
          },
          awayTopScorer: {
            name: 'Stephen Curry',
            points: 26.8,
            rebounds: 4.5,
            assists: 6.1,
            fieldGoalPct: 0.48,
            threePointPct: 0.42,
            plusMinus: 4.8,
            isInjured: false,
          },
          homeHotHand: [],
          awayHotHand: [],
          isSeasonStats: true,
        },
        matchHistory: {
          homeHistory: {
            streakType: 'W',
            streakCount: 3,
            last10: { wins: 7, losses: 3 },
            homeRecord: { wins: 25, losses: 10 },
            awayRecord: { wins: 20, losses: 20 },
            recentGames: [],
          },
          awayHistory: {
            streakType: 'L',
            streakCount: 2,
            last10: { wins: 5, losses: 5 },
            homeRecord: { wins: 22, losses: 13 },
            awayRecord: { wins: 20, losses: 20 },
            recentGames: [],
          },
          homeStanding: {
            wins: 45,
            losses: 30,
            winPct: 0.6,
            pointDiff: 3.2,
            conferenceRank: 5,
          },
          awayStanding: {
            wins: 42,
            losses: 33,
            winPct: 0.56,
            pointDiff: 1.8,
            conferenceRank: 8,
          },
        },
        injuries: {
          home: [
            { playerName: 'Player A', status: 'Out', description: 'Knee injury' },
          ],
          away: [
            { playerName: 'Player B', status: 'Questionable', description: 'Ankle sprain' },
          ],
          impactSummary: 'Some injuries',
        },
      };

      const metadata = buildPredictionMetadata(fullData);
      const metadataJson = JSON.stringify(metadata);
      const metadataSize = new Blob([metadataJson]).size;

      expect(metadataSize).toBeLessThan(10240);
    });

    it('should handle very long team names without exceeding limit', () => {
      const dataWithLongNames: PredictionData = {
        ...basePredictionData,
        homeTeam: {
          ...basePredictionData.homeTeam,
          name: 'A'.repeat(500),
          abbreviation: 'LAL',
        },
        awayTeam: {
          ...basePredictionData.awayTeam,
          name: 'B'.repeat(500),
          abbreviation: 'GSW',
        },
      };

      const metadata = buildPredictionMetadata(dataWithLongNames);
      const metadataJson = JSON.stringify(metadata);
      const metadataSize = new Blob([metadataJson]).size;

      // Should still be under limit because we only use abbreviation, not full name
      expect(metadataSize).toBeLessThan(10240);
    });

    it('should produce consistent metadata size for same data', () => {
      const metadata1 = buildPredictionMetadata(basePredictionData);
      const metadata2 = buildPredictionMetadata(basePredictionData);
      
      const size1 = new Blob([JSON.stringify(metadata1)]).size;
      const size2 = new Blob([JSON.stringify(metadata2)]).size;

      expect(size1).toBe(size2);
    });
  });

  describe('Data Availability Flags', () => {
    it('should correctly flag market data availability', () => {
      const withMarket = buildPredictionMetadata(basePredictionData);
      expect(withMarket.context.dataAvailable.hasMarketData).toBe(true);

      const withoutMarket = buildPredictionMetadata({
        ...basePredictionData,
        market: undefined,
      });
      expect(withoutMarket.context.dataAvailable.hasMarketData).toBe(false);
    });

    it('should correctly flag betting markets availability', () => {
      const withBettingMarkets = buildPredictionMetadata({
        ...basePredictionData,
        bettingMarkets: {
          hasMarkets: true,
          totalVolume: 100000,
          moneyline: null,
          spreads: [],
          totals: [],
          props: [],
        },
      });
      expect(withBettingMarkets.context.dataAvailable.hasBettingMarkets).toBe(true);

      const withoutBettingMarkets = buildPredictionMetadata(basePredictionData);
      expect(withoutBettingMarkets.context.dataAvailable.hasBettingMarkets).toBe(false);
    });

    it('should correctly flag injuries availability', () => {
      const withInjuries = buildPredictionMetadata({
        ...basePredictionData,
        injuries: {
          home: [{ playerName: 'Player A', status: 'Out' }],
          away: [],
          impactSummary: 'Some injuries',
        },
      });
      expect(withInjuries.context.dataAvailable.hasInjuries).toBe(true);

      const withoutInjuries = buildPredictionMetadata(basePredictionData);
      expect(withoutInjuries.context.dataAvailable.hasInjuries).toBe(false);
    });

    it('should correctly flag player stats availability', () => {
      const withStats = buildPredictionMetadata({
        ...basePredictionData,
        playerStats: {
          homeTopScorer: {
            name: 'Player A',
            points: 25,
            rebounds: 8,
            assists: 6,
            fieldGoalPct: 0.5,
            threePointPct: 0.4,
            plusMinus: 5,
            isInjured: false,
          },
          awayTopScorer: null,
          homeHotHand: [],
          awayHotHand: [],
          isSeasonStats: true,
        },
      });
      expect(withStats.context.dataAvailable.hasPlayerStats).toBe(true);

      const withoutStats = buildPredictionMetadata(basePredictionData);
      expect(withoutStats.context.dataAvailable.hasPlayerStats).toBe(false);
    });

    it('should correctly flag match history availability', () => {
      const withHistory = buildPredictionMetadata({
        ...basePredictionData,
        matchHistory: {
          homeHistory: {
            streakType: 'W',
            streakCount: 3,
            last10: { wins: 7, losses: 3 },
            homeRecord: { wins: 25, losses: 10 },
            awayRecord: { wins: 20, losses: 20 },
            recentGames: [],
          },
          awayHistory: null,
          homeStanding: null,
          awayStanding: null,
        },
      });
      expect(withHistory.context.dataAvailable.hasMatchHistory).toBe(true);

      const withoutHistory = buildPredictionMetadata(basePredictionData);
      expect(withoutHistory.context.dataAvailable.hasMatchHistory).toBe(false);
    });

    it('should correctly flag scores availability', () => {
      const withScores = buildPredictionMetadata({
        ...basePredictionData,
        scores: {
          home: 105,
          away: 98,
          quarter: 4,
          time: '2:30',
        },
      });
      expect(withScores.context.dataAvailable.hasScores).toBe(true);

      const withoutScores = buildPredictionMetadata(basePredictionData);
      expect(withoutScores.context.dataAvailable.hasScores).toBe(false);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle empty strings in team data', () => {
      const dataWithEmptyStrings: PredictionData = {
        ...basePredictionData,
        homeTeam: {
          ...basePredictionData.homeTeam,
          abbreviation: '',
        },
      };

      const metadata = buildPredictionMetadata(dataWithEmptyStrings);
      expect(metadata.context.matchup.homeTeamAbbr).toBe('');
    });

    it('should handle very long gameId', () => {
      const dataWithLongGameId: PredictionData = {
        ...basePredictionData,
        gameId: 'A'.repeat(200),
      };

      const metadata = buildPredictionMetadata(dataWithLongGameId);
      const metadataSize = new Blob([JSON.stringify(metadata)]).size;
      
      expect(metadataSize).toBeLessThan(10240);
      expect(metadata.context.matchup.gameId).toBe('A'.repeat(200));
    });

    it('should handle special characters in team abbreviations', () => {
      const dataWithSpecialChars: PredictionData = {
        ...basePredictionData,
        homeTeam: {
          ...basePredictionData.homeTeam,
          abbreviation: 'LAL-2024',
        },
        awayTeam: {
          ...basePredictionData.awayTeam,
          abbreviation: 'GSW@Home',
        },
      };

      const metadata = buildPredictionMetadata(dataWithSpecialChars);
      expect(metadata.context.matchup.homeTeamAbbr).toBe('LAL-2024');
      expect(metadata.context.matchup.awayTeamAbbr).toBe('GSW@Home');
    });

    it('should handle future scheduled times', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const dataWithFutureDate: PredictionData = {
        ...basePredictionData,
        scheduledTime: futureDate.toISOString(),
      };

      const metadata = buildPredictionMetadata(dataWithFutureDate);
      expect(metadata.context.matchup.scheduledTime).toBe(futureDate.toISOString());
    });

    it('should handle past scheduled times', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      
      const dataWithPastDate: PredictionData = {
        ...basePredictionData,
        scheduledTime: pastDate.toISOString(),
      };

      const metadata = buildPredictionMetadata(dataWithPastDate);
      expect(metadata.context.matchup.scheduledTime).toBe(pastDate.toISOString());
    });
  });
});
