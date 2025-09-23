/**
 * Simplified Supabase Wrapper with Auto-Recovery
 * Provides utility functions for retry logic with connection monitoring
 */

import { supabase } from './supabase'
import { connectionHealth } from './connection-health'

export class SupabaseWrapper {
  private static readonly MAX_RETRIES = 3
  private static readonly RETRY_DELAY = 1000 // 1 second

  /**
   * Execute a Supabase query with automatic retry and recovery
   */
  static async executeWithRetry<T>(
    queryFn: () => Promise<T>,
    operation: string = 'query'
  ): Promise<T> {
    let lastError: any = null

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🔄 Retrying ${operation} (attempt ${attempt}/${this.MAX_RETRIES})`)
        }

        const result = await queryFn()

        if (attempt > 1) {
          console.log(`✅ ${operation} succeeded after ${attempt} attempts`)
        }

        return result

      } catch (error) {
        lastError = error
        console.error(`💥 ${operation} failed on attempt ${attempt}:`, error)

        // Check if this is a connection-related error
        if (this.isConnectionError(error)) {
          console.log(`🔌 Connection error detected, checking health...`)

          // Update health status
          connectionHealth.checkHealth()

          // Attempt recovery if not the last try
          if (attempt < this.MAX_RETRIES) {
            console.log('🔧 Attempting recovery...')
            await connectionHealth.attemptRecovery()
            await this.delay(this.RETRY_DELAY * attempt) // Exponential backoff
            continue
          }
        } else if (attempt < this.MAX_RETRIES) {
          // Non-connection error, still retry but with shorter delay
          await this.delay(this.RETRY_DELAY)
          continue
        }
      }
    }

    // All retries exhausted
    console.error(`❌ ${operation} failed after ${this.MAX_RETRIES} attempts. Last error:`, lastError)
    throw lastError
  }

  /**
   * Check if an error is connection-related
   */
  private static isConnectionError(error: any): boolean {
    if (!error) return false

    const errorMessage = error.message?.toLowerCase() || ''
    const errorCode = error.code?.toLowerCase() || ''

    return (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('fetch') ||
      errorCode.includes('network') ||
      errorCode.includes('connection') ||
      error.name === 'NetworkError' ||
      error.name === 'TypeError' // Often thrown for network issues
    )
  }

  /**
   * Delay utility for retries
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Helper function to wrap common Supabase queries with retry logic
export function withRetry<T>(queryFn: () => Promise<T>, operation?: string): Promise<T> {
  return SupabaseWrapper.executeWithRetry(queryFn, operation)
}

// Re-export the original client
export { supabase }