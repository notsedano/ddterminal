/**
 * Configuration utility for backend API connection
 * SIMPLE APPROACH: Check hostname at runtime to determine backend URL
 */

// Production backend configuration - hardcoded for reliability
const PRODUCTION_API_BASE = 'https://3a6615a6-aeris-agent.containers.elizacloud.ai';
const PRODUCTION_AGENT_ID = '71196e85-8a16-0910-98e5-e2d2ee3018db';

interface ElizaConfig {
  apiBase?: string;
  agentId?: string;
  authToken?: string;
}

declare global {
  interface Window {
    ELIZA_CONFIG?: ElizaConfig;
    ELIZA_AUTH_TOKEN?: string;
  }
}

/**
 * Check if we're running on localhost (development)
 */
function isLocalhost(): boolean {
  if (typeof window === 'undefined') return true; // SSR = treat as dev
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function getApiBase(): string {
  // Runtime override takes highest priority
  if (typeof window !== 'undefined' && window.ELIZA_CONFIG?.apiBase) {
    return window.ELIZA_CONFIG.apiBase;
  }
  
  // SIMPLE: If localhost, use empty string (Vite proxy)
  // Otherwise, ALWAYS use production backend
  if (isLocalhost()) {
    return ''; // Vite dev server proxy handles /api
  }
  
  // Production: always use hardcoded backend URL
  // This bypasses all env var issues
  return PRODUCTION_API_BASE;
}

export function getAgentId(): string {
  // Runtime override takes highest priority
  if (typeof window !== 'undefined' && window.ELIZA_CONFIG?.agentId) {
    return window.ELIZA_CONFIG.agentId;
  }
  
  // SIMPLE: If localhost, check env var, otherwise use production agent ID
  if (isLocalhost()) {
    return import.meta.env.VITE_AGENT_ID || '';
  }
  
  // Production: always use hardcoded agent ID
  return PRODUCTION_AGENT_ID;
}

export function getAuthToken(): string | undefined {
  // Check runtime config first
  if (typeof window !== 'undefined' && window.ELIZA_AUTH_TOKEN) {
    return window.ELIZA_AUTH_TOKEN;
  }
  
  if (typeof window !== 'undefined' && window.ELIZA_CONFIG?.authToken) {
    return window.ELIZA_CONFIG.authToken;
  }
  
  // Fall back to environment variable
  return import.meta.env.VITE_AUTH_TOKEN;
}

export function getWebSocketUrl(): string {
  const apiBase = getApiBase();
  // WebSocket URL is typically the same as API base URL
  return apiBase;
}
