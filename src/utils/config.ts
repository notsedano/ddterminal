/**
 * Configuration utility that supports both environment variables and runtime config
 * Priority: window.ELIZA_CONFIG > environment variables
 */

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

export function getApiBase(): string {
  // Check runtime config first
  if (typeof window !== 'undefined' && window.ELIZA_CONFIG?.apiBase) {
    return window.ELIZA_CONFIG.apiBase;
  }
  
  // Fall back to environment variables (support both naming conventions)
  return import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '';
}

export function getAgentId(): string {
  // Check runtime config first
  if (typeof window !== 'undefined' && window.ELIZA_CONFIG?.agentId) {
    return window.ELIZA_CONFIG.agentId;
  }
  
  // Fall back to environment variable
  return import.meta.env.VITE_AGENT_ID || '';
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
