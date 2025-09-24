/**
 * Enhanced Supabase query handling with better error recovery
 */

import { supabase } from './supabase'

/**
 * Execute a Supabase query with proper error handling and connection recovery
 */
export async function executeQuery<T>(
  queryFn: () => any,
  options?: {
    retries?: number
    retryDelay?: number
    onError?: (error: any) => void
  }
): Promise<{ data: T | null; error: any }> {
  const { retries = 2, retryDelay = 500, onError } = options || {}

  let lastError: any = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // For first retry, refresh the session first
      if (attempt === 1) {
        console.log('🔄 Refreshing session before retry...')
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.warn('Session refresh failed:', refreshError)
        }
        // Wait a moment for refresh to take effect
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // Execute the query
      const result = await queryFn()

      // Check if result is valid
      if (result === undefined || result === null) {
        throw new Error('Query returned undefined/null result')
      }

      // If we have data or no error, return success
      if (result.data !== undefined || !result.error) {
        if (attempt > 0) {
          console.log(`✅ Query succeeded on attempt ${attempt + 1}`)
        }
        return result
      }

      // We have an error
      lastError = result.error

      // Check if it's a connection/auth error that might be recoverable
      const isRecoverable =
        result.error?.message?.includes('JWT') ||
        result.error?.message?.includes('token') ||
        result.error?.message?.includes('session') ||
        result.error?.message?.includes('fetch') ||
        result.error?.code === 'PGRST301'

      if (!isRecoverable || attempt === retries) {
        // Non-recoverable error or last attempt
        if (onError) onError(result.error)
        return result
      }

      console.log(`⚠️ Recoverable error on attempt ${attempt + 1}, retrying...`)
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))

    } catch (error) {
      lastError = error
      console.error(`Query failed on attempt ${attempt + 1}:`, error)

      if (attempt === retries) {
        if (onError) onError(error)
        return { data: null, error }
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
    }
  }

  return { data: null, error: lastError }
}

/**
 * Wrapper to ensure Supabase client is ready before querying
 */
export async function ensureConnection(): Promise<boolean> {
  try {
    // Try to get the current session
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('Failed to get session:', error)
      return false
    }

    if (!session) {
      console.log('No active session')
      return false
    }

    // Check if token needs refresh (expires in less than 60 seconds)
    const expiresAt = session.expires_at
    const now = Math.floor(Date.now() / 1000)

    if (expiresAt && expiresAt - now < 60) {
      console.log('Token expiring soon, refreshing...')
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        console.error('Failed to refresh token:', refreshError)
        return false
      }
    }

    return true
  } catch (error) {
    console.error('Connection check failed:', error)
    return false
  }
}

/**
 * Safe query wrapper that ensures connection before executing
 */
export async function safeQuery<T = any>(
  queryFn: () => any,
  description?: string
): Promise<{ data: T | null; error: any }> {
  // Check connection first
  const isConnected = await ensureConnection()

  if (!isConnected) {
    console.warn(`⚠️ No connection for query: ${description || 'unknown'}`)
    // Try to refresh session
    await supabase.auth.refreshSession()
  }

  // Execute query with retry logic
  return executeQuery<T>(queryFn, {
    retries: 2,
    retryDelay: 500,
    onError: (error) => {
      console.error(`Query failed: ${description || 'unknown'}`, error)
    }
  })
}