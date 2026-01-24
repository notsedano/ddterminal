export interface HealthCheckResponse {
  status: string;
  timestamp: string;
}

export interface SystemConfig {
  success: boolean;
  data: {
    requiresAuth: boolean;
  };
}
