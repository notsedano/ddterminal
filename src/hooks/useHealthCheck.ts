/**
 * Health Check Hook
 * Provides API health status for the application
 */

import { useQuery } from '@tanstack/react-query';
import { runHealthCheck, runQuickHealthCheck, type HealthCheckResult, type APIStatus } from '@/services/api/healthCheck';

interface UseHealthCheckOptions {
  /**
   * Polling interval in milliseconds (default: 60000 = 1 minute)
   * Set to 0 to disable polling
   */
  pollingInterval?: number;
  /**
   * Whether to run a full check or just quick (backend only)
   */
  fullCheck?: boolean;
  /**
   * Whether the health check is enabled
   */
  enabled?: boolean;
}

interface UseHealthCheckReturn {
  result: HealthCheckResult | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isHealthy: boolean;
  isDegraded: boolean;
  isUnhealthy: boolean;
}

/**
 * Hook to monitor API health status
 */
export function useHealthCheck(options: UseHealthCheckOptions = {}): UseHealthCheckReturn {
  const { pollingInterval = 60000, fullCheck = true, enabled = true } = options;

  const { data, isLoading, error, refetch } = useQuery<HealthCheckResult>({
    queryKey: ['healthCheck', fullCheck],
    queryFn: async () => {
      if (fullCheck) {
        return runHealthCheck();
      }
      // Quick check returns just backend status
      const backendStatus = await runQuickHealthCheck();
      return {
        overall: backendStatus.status === 'ok' ? 'healthy' : 
                 backendStatus.status === 'degraded' ? 'degraded' : 'unhealthy',
        timestamp: new Date().toISOString(),
        apis: [backendStatus],
      };
    },
    enabled,
    staleTime: 30000, // 30 seconds
    refetchInterval: pollingInterval > 0 ? pollingInterval : undefined,
  });

  return {
    result: data || null,
    isLoading,
    error: error as Error | null,
    refetch,
    isHealthy: data?.overall === 'healthy',
    isDegraded: data?.overall === 'degraded',
    isUnhealthy: data?.overall === 'unhealthy',
  };
}

/**
 * Hook to get a specific API's status
 */
export function useAPIStatus(apiName: string, options: UseHealthCheckOptions = {}): APIStatus | null {
  const { result } = useHealthCheck(options);
  return result?.apis.find((api) => api.name === apiName) || null;
}
