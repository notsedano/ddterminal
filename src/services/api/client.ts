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

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const { status, data, config } = error.response;
      const errorData = data as { error?: { message?: string; code?: string } };
      const errorMessage = errorData?.error?.message || error.message || 'An error occurred';
      const requestUrl = config?.url || 'unknown endpoint';
      
      // Log specific error types for debugging
      const statusMessages: Record<number, string> = {
        401: 'Unauthorized - authentication may be required',
        403: 'Forbidden - insufficient permissions',
        404: `Not found (404) - ${requestUrl}`,
        429: 'Rate limited - too many requests',
      };
      
      if (statusMessages[status]) {
        console.error(statusMessages[status]);
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
