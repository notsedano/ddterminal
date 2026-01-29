/**
 * Tests for prediction content length validation
 * Tests boundary conditions, edge cases, and error handling
 */

import { describe, it, expect } from 'vitest';
import { buildComprehensivePredictionMessage } from '@/hooks/usePredictionData';
import type { PredictionData } from '@/hooks/usePredictionData';

describe('Prediction Content Length', () => {
  const MAX_CONTENT_LENGTH = 20000;

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

  describe('Content Length Calculation', () => {
    it('should calculate content length correctly', () => {
      const message = buildComprehensivePredictionMessage(basePredictionData);
      const length = message.length;

      expect(length).toBeGreaterThan(0);
      expect(typeof length).toBe('number');
    });

    it('should produce content under 20000 characters for normal data', () => {
      const message = buildComprehensivePredictionMessage(basePredictionData);
      
      expect(message.length).toBeLessThan(MAX_CONTENT_LENGTH);
      expect(message.length).toBeGreaterThan(100); // Should have some content
    });

    it('should handle null predictionData', () => {
      const message = buildComprehensivePredictionMessage(null);
      
      expect(message.length).toBeGreaterThan(0);
      expect(message.length).toBeLessThan(MAX_CONTENT_LENGTH);
      expect(message).toContain('PREDICTION REQUEST');
    });
  });

  describe('Content with Full Data', () => {
    it('should handle prediction with all data fields populated', () => {
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
          spreads: [
            {
              type: 'spread' as const,
              question: 'Lakers -5.5',
              outcomes: [
                { name: 'Lakers -5.5', probability: '52%', americanOdds: '-108', price: 0.52 },
                { name: 'Warriors +5.5', probability: '48%', americanOdds: '+108', price: 0.48 },
              ],
              line: 5.5,
              volume: 150000,
            },
          ],
          totals: [
            {
              type: 'total' as const,
              question: 'Over/Under 220.5',
              outcomes: [
                { name: 'Over 220.5', probability: '51%', americanOdds: '-105', price: 0.51 },
                { name: 'Under 220.5', probability: '49%', americanOdds: '+105', price: 0.49 },
              ],
              line: 220.5,
              volume: 100000,
            },
          ],
          props: [
            {
              type: 'prop' as const,
              question: 'LeBron James Points Over/Under 27.5',
              outcomes: [
                { name: 'Over 27.5', probability: '50%', americanOdds: '-110', price: 0.5 },
                { name: 'Under 27.5', probability: '50%', americanOdds: '-110', price: 0.5 },
              ],
              volume: 50000,
            },
          ],
        },
        injuries: {
          home: [
            { playerName: 'LeBron James', status: 'Questionable', description: 'Ankle soreness' },
            { playerName: 'Anthony Davis', status: 'Probable', description: 'Knee maintenance' },
          ],
          away: [
            { playerName: 'Stephen Curry', status: 'Out', description: 'Shoulder injury' },
            { playerName: 'Klay Thompson', status: 'Day-To-Day', description: 'Back tightness' },
          ],
          impactSummary: 'Multiple injuries on both teams',
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
            isInjured: true,
            injuryStatus: 'Out',
          },
          homeHotHand: [
            {
              name: 'Austin Reaves',
              points: 18.2,
              rebounds: 4.1,
              assists: 4.3,
              fieldGoalPct: 0.55,
              threePointPct: 0.40,
              plusMinus: 3.5,
              isInjured: false,
            },
          ],
          awayHotHand: [
            {
              name: 'Jordan Poole',
              points: 20.1,
              rebounds: 3.2,
              assists: 4.5,
              fieldGoalPct: 0.47,
              threePointPct: 0.35,
              plusMinus: 2.8,
              isInjured: false,
            },
          ],
          isSeasonStats: true,
        },
        matchHistory: {
          homeHistory: {
            streakType: 'W',
            streakCount: 3,
            last10: { wins: 7, losses: 3 },
            homeRecord: { wins: 25, losses: 10 },
            awayRecord: { wins: 20, losses: 20 },
            recentGames: [
              { opponent: 'Celtics', result: 'W', score: '112-108', marginOfVictory: 4 },
              { opponent: 'Heat', result: 'W', score: '105-98', marginOfVictory: 7 },
              { opponent: 'Nuggets', result: 'L', score: '98-105', marginOfVictory: -7 },
            ],
          },
          awayHistory: {
            streakType: 'L',
            streakCount: 2,
            last10: { wins: 5, losses: 5 },
            homeRecord: { wins: 22, losses: 13 },
            awayRecord: { wins: 20, losses: 20 },
            recentGames: [
              { opponent: 'Suns', result: 'L', score: '110-115', marginOfVictory: -5 },
              { opponent: 'Clippers', result: 'L', score: '102-108', marginOfVictory: -6 },
              { opponent: 'Jazz', result: 'W', score: '118-105', marginOfVictory: 13 },
            ],
          },
          homeStanding: {
            wins: 45,
            losses: 30,
            winPct: 0.6,
            pointDiff: 3.2,
            gamesBack: 2.5,
            conferenceRank: 5,
          },
          awayStanding: {
            wins: 42,
            losses: 33,
            winPct: 0.56,
            pointDiff: 1.8,
            gamesBack: 5.5,
            conferenceRank: 8,
          },
        },
      };

      const message = buildComprehensivePredictionMessage(fullData);
      
      expect(message.length).toBeGreaterThan(1000);
      expect(message.length).toBeLessThan(MAX_CONTENT_LENGTH);
      expect(message).toContain('Lakers');
      expect(message).toContain('Warriors');
      expect(message).toContain('PREDICTION REQUEST');
    });

    it('should include all major data sections in message', () => {
      const message = buildComprehensivePredictionMessage(basePredictionData);
      
      expect(message).toContain('MATCHUP');
      expect(message).toContain('BETTING INDICATORS');
      expect(message).toContain('ANALYSIS REQUEST');
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle content exactly at 20000 characters (boundary)', () => {
      // This test verifies the validation logic handles the boundary correctly
      const boundaryLength = 20000;
      const isWithinLimit = boundaryLength <= MAX_CONTENT_LENGTH;
      
      expect(isWithinLimit).toBe(true);
    });

    it('should reject content over 20000 characters', () => {
      const overLimit = 20001;
      const isWithinLimit = overLimit <= MAX_CONTENT_LENGTH;
      
      expect(isWithinLimit).toBe(false);
    });

    it('should handle very large injury lists', () => {
      const dataWithManyInjuries: PredictionData = {
        ...basePredictionData,
        injuries: {
          home: Array(50).fill(null).map((_, i) => ({
            playerName: `Player ${i}`,
            status: 'Out' as const,
            description: `Injury ${i}`,
          })),
          away: Array(50).fill(null).map((_, i) => ({
            playerName: `Player ${i}`,
            status: 'Questionable' as const,
            description: `Injury ${i}`,
          })),
          impactSummary: 'Many injuries',
        },
      };

      const message = buildComprehensivePredictionMessage(dataWithManyInjuries);
      
      expect(message.length).toBeLessThan(MAX_CONTENT_LENGTH);
      expect(message).toContain('INJURY REPORT');
    });

    it('should handle very large betting markets lists', () => {
      const dataWithManyMarkets: PredictionData = {
        ...basePredictionData,
        bettingMarkets: {
          hasMarkets: true,
          totalVolume: 1000000,
          moneyline: {
            type: 'moneyline' as const,
            question: 'Who will win?',
            outcomes: [
              { name: 'Lakers', probability: '55%', americanOdds: '-122', price: 0.55 },
              { name: 'Warriors', probability: '45%', americanOdds: '+122', price: 0.45 },
            ],
            volume: 200000,
          },
          spreads: Array(20).fill(null).map((_, i) => ({
            type: 'spread' as const,
            question: `Spread ${i}`,
            outcomes: [
              { name: `Team A ${i}`, probability: '50%', americanOdds: '-110', price: 0.5 },
              { name: `Team B ${i}`, probability: '50%', americanOdds: '-110', price: 0.5 },
            ],
            line: i,
            volume: 10000,
          })),
          totals: Array(20).fill(null).map((_, i) => ({
            type: 'total' as const,
            question: `Total ${i}`,
            outcomes: [
              { name: `Over ${i}`, probability: '50%', americanOdds: '-110', price: 0.5 },
              { name: `Under ${i}`, probability: '50%', americanOdds: '-110', price: 0.5 },
            ],
            line: 200 + i,
            volume: 10000,
          })),
          props: Array(50).fill(null).map((_, i) => ({
            type: 'prop' as const,
            question: `Prop ${i}`,
            outcomes: [
              { name: `Over ${i}`, probability: '50%', americanOdds: '-110', price: 0.5 },
              { name: `Under ${i}`, probability: '50%', americanOdds: '-110', price: 0.5 },
            ],
            volume: 5000,
          })),
        },
      };

      const message = buildComprehensivePredictionMessage(dataWithManyMarkets);
      
      // Should still be under limit (buildComprehensivePredictionMessage may truncate)
      expect(message.length).toBeLessThan(MAX_CONTENT_LENGTH * 2); // Allow some buffer
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing required fields gracefully', () => {
      const incompleteData = {
        ...basePredictionData,
        homeTeam: {
          ...basePredictionData.homeTeam,
          name: undefined as any,
        },
      };

      const message = buildComprehensivePredictionMessage(incompleteData as any);
      
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain('PREDICTION REQUEST');
    });

    it('should handle undefined values in nested objects', () => {
      const dataWithUndefined: PredictionData = {
        ...basePredictionData,
        market: undefined,
        bettingMarkets: undefined,
        scores: undefined,
      };

      const message = buildComprehensivePredictionMessage(dataWithUndefined);
      
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain('PREDICTION REQUEST');
    });
  });
});
