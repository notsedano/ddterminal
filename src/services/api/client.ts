import axios, { AxiosInstance, AxiosError } from 'axios';
import { getApiBase, getAuthToken } from '@/utils/config';
import { captureError } from '@/utils/errorTracking';

// Create axios instance with default config
// Note: We use a request interceptor to set baseURL dynamically
// This ensures the production detection works correctly at runtime
const apiClient: AxiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to dynamically set baseURL and auth token
// This runs on every request, ensuring production detection works correctly
apiClient.interceptors.request.use((config) => {
  const apiBase = getApiBase();
  const authToken = getAuthToken();
  
  // Set baseURL dynamically on each request
  config.baseURL = apiBase ? `${apiBase}/api` : '/api';
  
  // Set auth token if available
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  
  return config;
});

// Custom error class to preserve error code information
export class SessionNotFoundError extends Error {
  constructor(message: string, public readonly code: string = 'SESSION_NOT_FOUND') {
    super(message);
    this.name = 'SessionNotFoundError';
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const { status, data, config } = error.response;
      const errorData = data as { error?: { message?: string; code?: string } };
      const errorMessage = errorData?.error?.message || error.message || 'An error occurred';
      const errorCode = errorData?.error?.code;
      const requestUrl = config?.url || 'unknown endpoint';
      
      // Log specific error types for debugging
      // Skip verbose logging for expected 404s/400s on sessions (they expire naturally)
      const isSessionsEndpoint = requestUrl.includes('/messaging/sessions');
      
      // Handle SESSION_NOT_FOUND errors (can be 400 or 404)
      // But distinguish from AGENT_NOT_FOUND errors
      if (isSessionsEndpoint && status === 404) {
        // Check if it's an agent not found error (specifically mentions "Agent with ID")
        if (errorMessage.includes('Agent with ID') && !errorMessage.includes('Session')) {
          // This is an agent validation error, not a session error
          console.error(`Agent not found: ${errorMessage}`);
          throw new Error(errorMessage);
        }
        // Check if it's a session not found error (mentions "Session" or has SESSION_NOT_FOUND code)
        if (
          errorCode === 'SESSION_NOT_FOUND' ||
          errorMessage.includes('Session with ID') ||
          errorMessage.includes('Session not found') ||
          (errorMessage.includes('not found') && errorMessage.includes('Session'))
        ) {
          // This is a session not found error - throw SessionNotFoundError so it can be handled properly
          throw new SessionNotFoundError(errorMessage, errorCode || 'SESSION_NOT_FOUND');
        }
        // For any other 404 on sessions endpoint, assume it's a session not found
        throw new SessionNotFoundError(errorMessage || 'Session not found', errorCode || 'SESSION_NOT_FOUND');
      }
      
      if (status === 401) {
        console.error('Unauthorized - authentication may be required');
        captureError(new Error('Unauthorized'), {
          component: 'apiClient',
          action: 'httpRequest',
          metadata: { status, url: requestUrl, errorCode },
        });
      } else if (status === 403) {
        console.error('Forbidden - insufficient permissions');
        captureError(new Error('Forbidden'), {
          component: 'apiClient',
          action: 'httpRequest',
          metadata: { status, url: requestUrl, errorCode },
        });
      } else if (status === 404) {
        console.error(`Not found (404) - ${requestUrl}`);
        if (!isSessionsEndpoint) {
          captureError(new Error('Not found'), {
            component: 'apiClient',
            action: 'httpRequest',
            metadata: { status, url: requestUrl },
          });
        }
      } else if (status === 400 && isSessionsEndpoint) {
        // 400 errors on sessions endpoint might be SESSION_NOT_FOUND
        if (errorCode === 'SESSION_NOT_FOUND') {
          throw new SessionNotFoundError(errorMessage, errorCode);
        }
        console.error(`Bad request (400) - ${requestUrl}`);
        captureError(new Error('Bad request'), {
          component: 'apiClient',
          action: 'httpRequest',
          metadata: { status, url: requestUrl, errorCode },
        });
      } else if (status === 429) {
        console.error('Rate limited - too many requests');
        captureError(new Error('Rate limited'), {
          component: 'apiClient',
          action: 'httpRequest',
          metadata: { status, url: requestUrl },
        });
      } else if (status >= 500) {
        console.error(`Server error (${status}) - backend may be unavailable`);
        captureError(new Error(`Server error ${status}`), {
          component: 'apiClient',
          action: 'httpRequest',
          metadata: { status, url: requestUrl, errorMessage },
        });
      }
      
      // Provide more helpful error messages based on the endpoint
      if (status === 404) {
        if (requestUrl.includes('/messaging/sessions')) {
          throw new Error('Sessions API not available (404). The backend may not support the Sessions API or the endpoint path may have changed.');
        }
        if (requestUrl.includes('/agents')) {
          throw new Error('Agents API not available (404). Please check if the backend is running and accessible.');
        }
      }
      
      throw new Error(errorMessage);
    }
    
    if (error.request) {
      const networkError = new Error('Network error - unable to reach backend server. Please check your connection and that the server is running.');
      captureError(networkError, {
        component: 'apiClient',
        action: 'httpRequest',
        metadata: { errorType: 'network', message: error.message },
      });
      throw networkError;
    }
    
    const unexpectedError = new Error(error.message || 'An unexpected error occurred');
    captureError(unexpectedError, {
      component: 'apiClient',
      action: 'httpRequest',
      metadata: { errorType: 'unexpected', message: error.message },
    });
    throw unexpectedError;
  }
);

export default apiClient;
