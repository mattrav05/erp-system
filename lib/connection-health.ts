/**
 * Connection Health Monitor
 * Monitors Supabase connection health and provides auto-recovery
 */

import { supabase } from './supabase'

export class ConnectionHealthMonitor {
  private static instance: ConnectionHealthMonitor
  private isHealthy = true
  private lastHealthCheck = Date.now()
  private healthCheckInterval: NodeJS.Timeout | null = null
  private listeners: Array<(healthy: boolean) => void> = []
  private failureCount = 0
  private readonly HEALTH_CHECK_INTERVAL = 60000 // 60 seconds (less frequent)
  private readonly HEALTH_CHECK_TIMEOUT = 10000 // 10 seconds (more tolerant)
  private readonly FAILURE_THRESHOLD = 2 // Must fail 2 times before marking unhealthy

  private constructor() {
    // Only start health checks if explicitly enabled
    const isEnabled = process.env.NEXT_PUBLIC_ENABLE_CONNECTION_MONITORING === 'true'
    if (isEnabled) {
      this.startHealthChecks()
    } else {
      console.log('📡 Connection health monitoring is disabled')
    }
  }

  static getInstance(): ConnectionHealthMonitor {
    if (!ConnectionHealthMonitor.instance) {
      ConnectionHealthMonitor.instance = new ConnectionHealthMonitor()
    }
    return ConnectionHealthMonitor.instance
  }

  /**
   * Add a listener for connection health changes
   */
  onHealthChange(callback: (healthy: boolean) => void): () => void {
    this.listeners.push(callback)
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback)
    }
  }

  /**
   * Get current connection health status
   */
  isConnectionHealthy(): boolean {
    return this.isHealthy
  }

  /**
   * Manually trigger a health check
   */
  async checkHealth(): Promise<boolean> {
    try {
      console.log('🔍 Checking connection health...')

      // Create a promise that races with timeout
      const healthPromise = this.performHealthCheck()
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.HEALTH_CHECK_TIMEOUT)
      })

      await Promise.race([healthPromise, timeoutPromise])

      // Health check succeeded - reset failure count
      this.failureCount = 0
      this.updateHealthStatus(true)
      return true
    } catch (error) {
      console.error('❌ Health check failed:', error)

      // Increment failure count
      this.failureCount++

      // Only mark as unhealthy if we've failed multiple times
      if (this.failureCount >= this.FAILURE_THRESHOLD) {
        this.updateHealthStatus(false)
      } else {
        console.log(`⚠️ Health check failed ${this.failureCount}/${this.FAILURE_THRESHOLD} times, not marking unhealthy yet`)
      }

      return this.failureCount < this.FAILURE_THRESHOLD
    }
  }

  /**
   * Perform the actual health check
   */
  private async performHealthCheck(): Promise<void> {
    // Very lightweight query - just check if we can connect
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    if (error) {
      // Only throw for actual connection errors, not data errors
      if (error.code === 'PGRST301' || error.code === 'PGRST116') {
        // These are "no rows" or "table not found" - connection is fine
        return
      }
      throw error
    }
  }

  /**
   * Update health status and notify listeners
   */
  private updateHealthStatus(healthy: boolean): void {
    const wasHealthy = this.isHealthy
    this.isHealthy = healthy
    this.lastHealthCheck = Date.now()

    // Only notify if status changed
    if (wasHealthy !== healthy) {
      console.log(`🔄 Connection health changed: ${healthy ? 'HEALTHY' : 'UNHEALTHY'}`)
      this.listeners.forEach(callback => {
        try {
          callback(healthy)
        } catch (error) {
          console.error('Error in health change callback:', error)
        }
      })
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    // Initial health check
    this.checkHealth()

    // Set up interval for periodic checks
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth()
    }, this.HEALTH_CHECK_INTERVAL)
  }

  /**
   * Stop health monitoring
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    this.listeners = []
  }

  /**
   * Attempt to recover from connection issues
   */
  async attemptRecovery(): Promise<boolean> {
    console.log('🔧 Attempting connection recovery...')

    try {
      // Force refresh the auth session
      const { error } = await supabase.auth.refreshSession()
      if (error) {
        console.error('Session refresh failed:', error)
      }

      // Wait a moment for the refresh to take effect
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Check if recovery was successful
      const recovered = await this.checkHealth()

      if (recovered) {
        console.log('✅ Connection recovery successful')
      } else {
        console.log('❌ Connection recovery failed')
      }

      return recovered
    } catch (error) {
      console.error('Recovery attempt failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const connectionHealth = ConnectionHealthMonitor.getInstance()

// React hook is defined in a separate file to avoid server-side issues