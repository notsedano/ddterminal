/**
 * API Health Check Service
 * Tests connectivity and status of all external APIs
 */

export interface APIStatus {
  name: string;
  status: 'ok' | 'error' | 'degraded' | 'unknown';
  latencyMs: number | null;
  message: string;
  lastChecked: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  apis: APIStatus[];
}

/**
 * Check ElizaCloud/Backend API status
 */
async function checkBackendAPI(): Promise<APIStatus> {
  const start = performance.now();
  const apiBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL;
  
  if (!apiBase) {
    return {
      name: 'ElizaCloud Backend',
      status: 'error',
      latencyMs: null,
      message: 'VITE_API_BASE not configured',
      lastChecked: new Date().toISOString(),
    };
  }

  const response = await fetch(`${apiBase}/api/agents`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  }).catch(() => null);

  const latencyMs = Math.round(performance.now() - start);

  if (!response) {
    return {
      name: 'ElizaCloud Backend',
      status: 'error',
      latencyMs,
      message: 'Network error - backend unreachable',
      lastChecked: new Date().toISOString(),
      details: { url: apiBase },
    };
  }

  if (response.status === 429) {
    return {
      name: 'ElizaCloud Backend',
      status: 'degraded',
      latencyMs,
      message: 'Rate limited (429) - too many requests',
      lastChecked: new Date().toISOString(),
      details: { url: apiBase, status: 429 },
    };
  }

  if (!response.ok) {
    return {
      name: 'ElizaCloud Backend',
      status: 'error',
      latencyMs,
      message: `HTTP ${response.status} - ${response.statusText}`,
      lastChecked: new Date().toISOString(),
      details: { url: apiBase, status: response.status },
    };
  }

  return {
    name: 'ElizaCloud Backend',
    status: 'ok',
    latencyMs,
    message: 'Connected',
    lastChecked: new Date().toISOString(),
    details: { url: apiBase },
  };
}

/**
 * Check Sportradar API status
 */
async function checkSportradarAPI(): Promise<APIStatus> {
  const start = performance.now();
  
  // Use the local proxy endpoint
  const response = await fetch('/api/sports/schedule?days=1', {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  }).catch(() => null);

  const latencyMs = Math.round(performance.now() - start);

  if (!response) {
    return {
      name: 'Sportradar API',
      status: 'error',
      latencyMs,
      message: 'Network error',
      lastChecked: new Date().toISOString(),
    };
  }

  if (response.status === 403 || response.status === 401) {
    return {
      name: 'Sportradar API',
      status: 'error',
      latencyMs,
      message: 'Invalid or expired API key',
      lastChecked: new Date().toISOString(),
      details: { status: response.status },
    };
  }

  if (response.status === 429) {
    return {
      name: 'Sportradar API',
      status: 'degraded',
      latencyMs,
      message: 'Rate limited',
      lastChecked: new Date().toISOString(),
    };
  }

  if (!response.ok) {
    return {
      name: 'Sportradar API',
      status: 'error',
      latencyMs,
      message: `HTTP ${response.status}`,
      lastChecked: new Date().toISOString(),
    };
  }

  const data = await response.json().catch(() => null);
  const hasGames = data?.games?.length > 0 || data?.schedule?.games?.length > 0;

  return {
    name: 'Sportradar API',
    status: 'ok',
    latencyMs,
    message: hasGames ? `Connected - ${data?.games?.length || data?.schedule?.games?.length || 0} games found` : 'Connected - no games today',
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Check Polymarket API status
 */
async function checkPolymarketAPI(): Promise<APIStatus> {
  const start = performance.now();
  
  // Use the Gamma API to check market discovery
  const response = await fetch('/api/polymarket/gamma/events?tag=nba&limit=1', {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  }).catch(() => null);

  const latencyMs = Math.round(performance.now() - start);

  if (!response) {
    return {
      name: 'Polymarket API',
      status: 'error',
      latencyMs,
      message: 'Network error',
      lastChecked: new Date().toISOString(),
    };
  }

  if (response.status === 429) {
    return {
      name: 'Polymarket API',
      status: 'degraded',
      latencyMs,
      message: 'Rate limited',
      lastChecked: new Date().toISOString(),
    };
  }

  if (!response.ok) {
    return {
      name: 'Polymarket API',
      status: 'degraded',
      latencyMs,
      message: `HTTP ${response.status} - some features may not work`,
      lastChecked: new Date().toISOString(),
    };
  }

  return {
    name: 'Polymarket API',
    status: 'ok',
    latencyMs,
    message: 'Connected',
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Check Supabase API status
 */
async function checkSupabaseAPI(): Promise<APIStatus> {
  const start = performance.now();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return {
      name: 'Supabase',
      status: 'error',
      latencyMs: null,
      message: 'Not configured',
      lastChecked: new Date().toISOString(),
    };
  }


  // Test the REST API endpoint
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'GET',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  }).catch(() => null);

  const latencyMs = Math.round(performance.now() - start);

  if (!response) {
    return {
      name: 'Supabase',
      status: 'error',
      latencyMs,
      message: 'Network error',
      lastChecked: new Date().toISOString(),
    };
  }

  if (response.status === 401) {
    return {
      name: 'Supabase',
      status: 'error',
      latencyMs,
      message: 'Invalid API key',
      lastChecked: new Date().toISOString(),
    };
  }

  if (!response.ok && response.status !== 200) {
    return {
      name: 'Supabase',
      status: 'degraded',
      latencyMs,
      message: `HTTP ${response.status}`,
      lastChecked: new Date().toISOString(),
    };
  }

  // Decode JWT to check key type
  let keyType = 'unknown';
  try {
    const payload = JSON.parse(atob(supabaseKey.split('.')[1]));
    keyType = payload.role || 'unknown';
  } catch {
    // Ignore decode errors
  }

  const status: APIStatus = {
    name: 'Supabase',
    status: 'ok',
    latencyMs,
    message: 'Connected',
    lastChecked: new Date().toISOString(),
    details: { keyType },
  };

  // Add warning for service_role key
  if (keyType === 'service_role') {
    status.status = 'degraded';
    status.message = 'WARNING: Using service_role key in client code. Replace with anon key for security.';
  }

  return status;
}

/**
 * Check Privy Authentication status
 */
async function checkPrivyAPI(): Promise<APIStatus> {
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
  
  if (!privyAppId) {
    return {
      name: 'Privy Auth',
      status: 'error',
      latencyMs: null,
      message: 'VITE_PRIVY_APP_ID not configured',
      lastChecked: new Date().toISOString(),
    };
  }

  const start = performance.now();
  
  // Check JWKS endpoint
  const response = await fetch(`https://auth.privy.io/api/v1/apps/${privyAppId}/jwks.json`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  }).catch(() => null);

  const latencyMs = Math.round(performance.now() - start);

  if (!response) {
    return {
      name: 'Privy Auth',
      status: 'error',
      latencyMs,
      message: 'Network error',
      lastChecked: new Date().toISOString(),
    };
  }

  if (!response.ok) {
    return {
      name: 'Privy Auth',
      status: 'error',
      latencyMs,
      message: `HTTP ${response.status} - invalid app ID or configuration`,
      lastChecked: new Date().toISOString(),
    };
  }

  return {
    name: 'Privy Auth',
    status: 'ok',
    latencyMs,
    message: 'Configured',
    lastChecked: new Date().toISOString(),
    details: { appId: privyAppId },
  };
}

/**
 * Run all health checks
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const results = await Promise.all([
    checkBackendAPI(),
    checkSportradarAPI(),
    checkPolymarketAPI(),
    checkSupabaseAPI(),
    checkPrivyAPI(),
  ]);

  // Determine overall status
  const hasError = results.some((r) => r.status === 'error');
  const hasDegraded = results.some((r) => r.status === 'degraded');
  
  let overall: 'healthy' | 'degraded' | 'unhealthy';
  if (hasError) {
    overall = 'unhealthy';
  } else if (hasDegraded) {
    overall = 'degraded';
  } else {
    overall = 'healthy';
  }

  return {
    overall,
    timestamp: new Date().toISOString(),
    apis: results,
  };
}

/**
 * Run a quick health check (just backend)
 */
export async function runQuickHealthCheck(): Promise<APIStatus> {
  return checkBackendAPI();
}
