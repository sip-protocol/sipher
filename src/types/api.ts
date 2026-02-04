export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'shutting_down'
  version: string
  timestamp: string
  uptime: number
  solana: {
    connected: boolean
    cluster: string
    slot?: number
    latencyMs?: number
  }
  memory: {
    heapUsedMB: number
    rssMB: number
  }
  endpoints: number
}
