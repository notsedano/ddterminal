import axios, { AxiosInstance, AxiosError } from 'axios';
import { getApiBase, getAuthToken } from '@/utils/config';

const apiBase = getApiBase();
const authToken = getAuthToken();

const apiClient: AxiosInstance = axios.create({
  baseURL: apiBase ? `${apiBase}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
    ...(authToken && { Authorization: `Bearer ${authToken}` }),
  },
  timeout: 30000,
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
      if (isSessionsEndpoint && (errorCode === 'SESSION_NOT_FOUND' || status === 404)) {
        // Don't log - this is expected when sessions expire, handled by caller
        // Throw a SessionNotFoundError to make it easier to detect
        throw new SessionNotFoundError(errorMessage, errorCode || 'SESSION_NOT_FOUND');
      }
      
      if (status === 401) {
        console.error('Unauthorized - authentication may be required');
      } else if (status === 403) {
        console.error('Forbidden - insufficient permissions');
      } else if (status === 404) {
        console.error(`Not found (404) - ${requestUrl}`);
      } else if (status === 400 && isSessionsEndpoint) {
        // 400 errors on sessions endpoint might be SESSION_NOT_FOUND
        if (errorCode === 'SESSION_NOT_FOUND') {
          throw new SessionNotFoundError(errorMessage, errorCode);
        }
        console.error(`Bad request (400) - ${requestUrl}`);
      } else if (status === 429) {
        console.error('Rate limited - too many requests');
      } else if (status >= 500) {
        console.error(`Server error (${status}) - backend may be unavailable`);
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
      throw new Error('Network error - unable to reach backend server. Please check your connection and that the server is running.');
    }
    
    throw new Error(error.message || 'An unexpected error occurred');
  }
);

export default apiClient;
