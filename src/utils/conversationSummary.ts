/**
 * Conversation Summary Utilities
 * Utilities for generating conversation summaries and extracting context
 */

import type { Message } from '@/types';
import type { KeyEntities, CreateConversationSummary } from '@/types/memory';

/**
 * Extract key entities from messages
 * Uses pattern matching for sports-related entities
 */
export function extractKeyEntities(messages: Message[]): KeyEntities {
  const entities: KeyEntities = {
    teams: [],
    players: [],
    markets: [],
    sports: [],
    other: [],
  };

  const allText = messages.map((m) => m.text).join(' ');

  // NBA Teams
  const nbaTeams = [
    'Lakers', 'Celtics', 'Warriors', 'Heat', 'Bulls', 'Nets', 'Knicks',
    '76ers', 'Sixers', 'Bucks', 'Suns', 'Mavericks', 'Mavs', 'Nuggets',
    'Clippers', 'Kings', 'Hawks', 'Raptors', 'Cavaliers', 'Cavs', 'Magic',
    'Pacers', 'Hornets', 'Wizards', 'Pistons', 'Thunder', 'Trail Blazers',
    'Blazers', 'Spurs', 'Rockets', 'Grizzlies', 'Timberwolves', 'Wolves',
    'Pelicans', 'Jazz',
  ];

  // NFL Teams
  const nflTeams = [
    'Chiefs', 'Eagles', '49ers', 'Cowboys', 'Bills', 'Bengals', 'Ravens',
    'Dolphins', 'Lions', 'Packers', 'Vikings', 'Jets', 'Patriots', 'Chargers',
    'Raiders', 'Broncos', 'Steelers', 'Browns', 'Colts', 'Titans', 'Jaguars',
    'Texans', 'Seahawks', 'Rams', 'Cardinals', 'Saints', 'Buccaneers', 'Bucs',
    'Panthers', 'Falcons', 'Bears', 'Commanders', 'Giants',
  ];

  // Sports
  const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'MLS', 'NCAA', 'basketball', 'football', 'baseball', 'hockey', 'soccer'];

  // Market terms
  const marketTerms = ['spread', 'moneyline', 'over', 'under', 'total', 'parlay', 'prop', 'futures', 'odds'];

  // Extract teams
  const teamRegex = new RegExp(`\\b(${[...nbaTeams, ...nflTeams].join('|')})\\b`, 'gi');
  const teamMatches = allText.match(teamRegex) || [];
  entities.teams = [...new Set(teamMatches.map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()))];

  // Extract sports
  const sportsRegex = new RegExp(`\\b(${sports.join('|')})\\b`, 'gi');
  const sportsMatches = allText.match(sportsRegex) || [];
  entities.sports = [...new Set(sportsMatches.map((s) => s.toUpperCase()))];

  // Extract market terms
  const marketRegex = new RegExp(`\\b(${marketTerms.join('|')})\\b`, 'gi');
  const marketMatches = allText.match(marketRegex) || [];
  entities.markets = [...new Set(marketMatches.map((m) => m.toLowerCase()))];

  return entities;
}

/**
 * Extract key topics from messages
 * Uses keyword frequency and pattern matching
 */
export function extractKeyTopics(messages: Message[]): string[] {
  const topics: Map<string, number> = new Map();
  const allText = messages.map((m) => m.text.toLowerCase()).join(' ');

  // Topic patterns
  const topicPatterns: { pattern: RegExp; topic: string }[] = [
    { pattern: /\b(betting|bet|wager)\b/gi, topic: 'betting' },
    { pattern: /\b(odds|line|spread)\b/gi, topic: 'odds' },
    { pattern: /\b(game|match|matchup)\b/gi, topic: 'games' },
    { pattern: /\b(injury|injured|out|questionable)\b/gi, topic: 'injuries' },
    { pattern: /\b(prediction|predict|pick)\b/gi, topic: 'predictions' },
    { pattern: /\b(analysis|analyze|breakdown)\b/gi, topic: 'analysis' },
    { pattern: /\b(stats|statistics|numbers)\b/gi, topic: 'statistics' },
    { pattern: /\b(player|players)\b/gi, topic: 'players' },
    { pattern: /\b(team|teams)\b/gi, topic: 'teams' },
    { pattern: /\b(trade|trading)\b/gi, topic: 'trades' },
    { pattern: /\b(schedule|upcoming|tonight|today)\b/gi, topic: 'schedule' },
    { pattern: /\b(live|score|scores)\b/gi, topic: 'live scores' },
    { pattern: /\b(polymarket|market|markets)\b/gi, topic: 'markets' },
    { pattern: /\b(price|prices|value)\b/gi, topic: 'pricing' },
  ];

  for (const { pattern, topic } of topicPatterns) {
    const matches = allText.match(pattern);
    if (matches) {
      topics.set(topic, (topics.get(topic) || 0) + matches.length);
    }
  }

  // Sort by frequency and return top topics
  return Array.from(topics.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
}

/**
 * Calculate simple sentiment score from messages
 * Returns a value between -1 (negative) and 1 (positive)
 */
export function calculateSentiment(messages: Message[]): number {
  const positiveWords = [
    'good', 'great', 'excellent', 'amazing', 'love', 'like', 'best', 'win',
    'winning', 'winner', 'confident', 'bullish', 'strong', 'solid', 'nice',
    'perfect', 'awesome', 'fantastic', 'thanks', 'thank', 'helpful', 'yes',
  ];

  const negativeWords = [
    'bad', 'terrible', 'awful', 'hate', 'worst', 'lose', 'losing', 'loser',
    'bearish', 'weak', 'worried', 'concern', 'no', 'wrong', 'fail', 'failed',
    'risky', 'danger', 'problem', 'issue', 'unfortunately', 'disappointed',
  ];

  let score = 0;
  let wordCount = 0;

  for (const message of messages) {
    const words = message.text.toLowerCase().split(/\s+/);
    for (const word of words) {
      const cleanWord = word.replace(/[^a-z]/g, '');
      if (positiveWords.includes(cleanWord)) {
        score += 1;
        wordCount++;
      } else if (negativeWords.includes(cleanWord)) {
        score -= 1;
        wordCount++;
      }
    }
  }

  if (wordCount === 0) return 0;
  return Math.max(-1, Math.min(1, score / wordCount));
}

/**
 * Generate a basic text summary of the conversation
 * This is a simple extractive summary - for production, use LLM
 */
export function generateBasicSummary(messages: Message[]): string {
  if (messages.length === 0) return '';

  const userMessages = messages.filter((m) => m.role === 'user');
  const agentMessages = messages.filter((m) => m.role === 'agent');

  const topics = extractKeyTopics(messages);
  const entities = extractKeyEntities(messages);

  const parts: string[] = [];

  // Opening
  parts.push(`Conversation with ${userMessages.length} user messages and ${agentMessages.length} agent responses.`);

  // Topics
  if (topics.length > 0) {
    parts.push(`Main topics discussed: ${topics.join(', ')}.`);
  }

  // Entities
  if (entities.teams && entities.teams.length > 0) {
    parts.push(`Teams mentioned: ${entities.teams.slice(0, 5).join(', ')}.`);
  }

  if (entities.sports && entities.sports.length > 0) {
    parts.push(`Sports covered: ${entities.sports.join(', ')}.`);
  }

  // First user message context
  if (userMessages.length > 0) {
    const firstMsg = userMessages[0].text.slice(0, 100);
    parts.push(`Started with: "${firstMsg}${userMessages[0].text.length > 100 ? '...' : ''}"`);
  }

  return parts.join(' ');
}

/**
 * Create a conversation summary object from messages
 */
export function createSummaryFromMessages(
  messages: Message[],
  sessionId: string,
  _userId: string,
  _agentId: string
): Omit<CreateConversationSummary, 'userId' | 'agentId'> {
  const userMessages = messages.filter((m) => m.role === 'user');
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return {
    sessionId,
    summary: generateBasicSummary(messages),
    keyTopics: extractKeyTopics(messages),
    keyEntities: extractKeyEntities(messages),
    sentimentScore: calculateSentiment(userMessages), // Only analyze user sentiment
    messageCount: messages.length,
    firstMessageAt: sortedMessages[0]?.createdAt || null,
    lastMessageAt: sortedMessages[sortedMessages.length - 1]?.createdAt || null,
  };
}

/**
 * Extract user preferences from conversation
 * Returns facts that can be saved as memory fragments
 */
export function extractUserPreferences(
  messages: Message[]
): { content: string; memoryType: 'preference' | 'fact' | 'intent' }[] {
  const preferences: { content: string; memoryType: 'preference' | 'fact' | 'intent' }[] = [];
  const userMessages = messages.filter((m) => m.role === 'user');
  const allUserText = userMessages.map((m) => m.text).join(' ');

  // Look for explicit preferences
  const preferencePatterns = [
    { pattern: /I\s+(like|love|prefer|enjoy)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/gi, type: 'preference' as const },
    { pattern: /(?:my\s+)?favorite\s+(?:team\s+is|is)\s+(?:the\s+)?(\w+)/gi, type: 'preference' as const },
    { pattern: /I\s+(?:always|usually|often)\s+bet\s+(?:on\s+)?(\w+(?:\s+\w+)?)/gi, type: 'preference' as const },
    { pattern: /I('m| am)\s+(bullish|bearish)\s+on\s+(\w+(?:\s+\w+)?)/gi, type: 'intent' as const },
    { pattern: /I\s+(?:want|need)\s+to\s+(\w+(?:\s+\w+){0,3})/gi, type: 'intent' as const },
  ];

  for (const { pattern, type } of preferencePatterns) {
    const matches = allUserText.matchAll(pattern);
    for (const match of matches) {
      preferences.push({
        content: match[0].trim(),
        memoryType: type,
      });
    }
  }

  return preferences;
}
