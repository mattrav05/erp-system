'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { safeQuery } from '@/lib/supabase-query'
import { useFocusReload } from '@/hooks/use-focus-reload'

interface QueryState<T> {
  data: T | null
  error: any
  isLoading: boolean
  refetch: () => Promise<void>
}

/**
 * Hook for Supabase queries with automatic retry, focus reload, and error handling
 */
export function useSupabaseQuery<T>(
  queryFn: () => any,
  options?: {
    enabled?: boolean
    onSuccess?: (data: T) => void
    onError?: (error: any) => void
    refetchOnFocus?: boolean
    refetchInterval?: number
    retryOnError?: boolean
  }
): QueryState<T> {
  const {
    enabled = true,
    onSuccess,
    onError,
    refetchOnFocus = true,
    refetchInterval,
    retryOnError = true
  } = options || {}

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const isMounted = useRef(true)
  const lastFetchTime = useRef(0)

  const fetchData = useCallback(async () => {
    // Prevent duplicate fetches
    const now = Date.now()
    if (now - lastFetchTime.current < 500) {
      console.log('Skipping duplicate fetch')
      return
    }
    lastFetchTime.current = now

    if (!enabled) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await safeQuery<T>(queryFn)

      if (isMounted.current) {
        if (result.error) {
          setError(result.error)
          setData(null)
          if (onError) onError(result.error)

          // Retry once after a delay if it's a connection error
          if (retryOnError && isConnectionError(result.error)) {
            console.log('Connection error detected, retrying in 2 seconds...')
            setTimeout(() => {
              if (isMounted.current) {
                fetchData()
              }
            }, 2000)
          }
        } else {
          setData(result.data)
          setError(null)
          if (onSuccess && result.data) onSuccess(result.data)
        }
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err)
        setData(null)
        if (onError) onError(err)
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false)
      }
    }
  }, [enabled, queryFn, onSuccess, onError, retryOnError])

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchData()
    }

    return () => {
      isMounted.current = false
    }
  }, [enabled])

  // Refetch on focus
  useFocusReload(() => {
    if (refetchOnFocus && enabled && !isLoading) {
      console.log('🔄 Refetching after focus')
      fetchData()
    }
  }, [refetchOnFocus, enabled, isLoading])

  // Refetch interval
  useEffect(() => {
    if (refetchInterval && enabled) {
      const interval = setInterval(() => {
        if (!isLoading && isMounted.current) {
          fetchData()
        }
      }, refetchInterval)

      return () => clearInterval(interval)
    }
  }, [refetchInterval, enabled, isLoading, fetchData])

  return {
    data,
    error,
    isLoading,
    refetch: fetchData
  }
}

function isConnectionError(error: any): boolean {
  if (!error) return false

  const message = error.message?.toLowerCase() || ''
  const code = error.code?.toLowerCase() || ''

  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('jwt') ||
    message.includes('token') ||
    code === 'pgrst301' ||
    error.name === 'NetworkError'
  )
}