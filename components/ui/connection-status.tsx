'use client'

import { useAuth } from '@/components/providers/auth-provider'
import { useConnectionHealth } from '@/hooks/use-connection-health'
import { useState } from 'react'

export function ConnectionStatus() {
  const { connectionHealthy } = useAuth()
  const { isHealthy, lastChecked, checkHealth, attemptRecovery } = useConnectionHealth()
  const [isRetrying, setIsRetrying] = useState(false)

  const isConnected = connectionHealthy && isHealthy

  const handleRetry = async () => {
    if (isRetrying) return

    setIsRetrying(true)
    try {
      const recovered = await attemptRecovery()
      if (!recovered) {
        // If auto-recovery failed, try manual health check
        await checkHealth()
      }
    } finally {
      setIsRetrying(false)
    }
  }

  // Don't show anything if connection is healthy
  if (isConnected) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 text-sm">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse"></div>
          <span>
            Connection lost. Some features may not work properly.
            {lastChecked && (
              <span className="text-red-200 ml-2">
                Last checked: {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </span>
        </div>

        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="bg-red-700 hover:bg-red-800 disabled:bg-red-800 px-3 py-1 rounded text-xs font-medium transition-colors"
        >
          {isRetrying ? 'Retrying...' : 'Retry Connection'}
        </button>
      </div>
    </div>
  )
}

export function ConnectionIndicator() {
  const { connectionHealthy } = useAuth()
  const { isHealthy } = useConnectionHealth()

  const isConnected = connectionHealthy && isHealthy

  return (
    <div className="flex items-center space-x-1">
      <div
        className={`w-2 h-2 rounded-full ${
          isConnected
            ? 'bg-green-500'
            : 'bg-red-500 animate-pulse'
        }`}
        title={isConnected ? 'Connected' : 'Connection issues detected'}
      />
      <span className="text-xs text-gray-500">
        {isConnected ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}