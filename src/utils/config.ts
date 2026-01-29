/**
 * Configuration utility that supports both environment variables and runtime config
 * Priority: window.ELIZA_CONFIG > environment variables > production defaults
 */

// Production backend configuration - hardcoded for reliability
const PRODUCTION_CONFIG = {
  apiBase: 'https://3a6615a6-aeris-agent.containers.elizacloud.ai',
  agentId: '71196e85-8a16-0910-98e5-e2d2ee3018db',
};

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
 * Detect if we're running in production (Vercel deployment)
 */
function isProduction(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  // Production: Vercel deployments (*.vercel.app) or custom domains (not localhost)
  return hostname.includes('vercel.app') || 
         (!hostname.includes('localhost') && !hostname.includes('127.0.0.1'));
}

export function getApiBase(): string {
  // Check runtime config first (explicit check for property existence, not truthiness)
  // This allows setting apiBase to empty string to use relative URLs (through proxy)
  if (typeof window !== 'undefined' && window.ELIZA_CONFIG && 'apiBase' in window.ELIZA_CONFIG) {
    return window.ELIZA_CONFIG.apiBase || '';
  }
  
  // Check environment variables
  const envApiBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL;
  if (envApiBase) {
    return envApiBase;
  }
  
  // In production, use hardcoded backend URL (bypasses env var issues)
  if (isProduction()) {
    return PRODUCTION_CONFIG.apiBase;
  }
  
  // Local development: use empty string (Vite proxy handles /api)
  return '';
}

export function getAgentId(): string {
  // Check runtime config first
  if (typeof window !== 'undefined' && window.ELIZA_CONFIG?.agentId) {
    return window.ELIZA_CONFIG.agentId;
  }
  
  // Check environment variable
  const envAgentId = import.meta.env.VITE_AGENT_ID;
  if (envAgentId) {
    return envAgentId;
  }
  
  // In production, use hardcoded agent ID
  if (isProduction()) {
    return PRODUCTION_CONFIG.agentId;
  }
  
  // Local development fallback
  return '';
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
