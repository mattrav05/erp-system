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
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600 text-white px-2 sm:px-4 py-2 text-sm border-b border-yellow-700">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <div className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse flex-shrink-0"></div>
          <span className="truncate">
            <span className="hidden sm:inline">Connection unstable. Monitoring connectivity...</span>
            <span className="sm:hidden">Connection issues</span>
            {lastChecked && (
              <span className="text-yellow-200 ml-2 hidden md:inline">
                Last checked: {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="bg-yellow-700 hover:bg-yellow-800 disabled:bg-yellow-800 px-2 sm:px-3 py-1 rounded text-xs font-medium transition-colors"
          >
            {isRetrying ? 'Checking...' : 'Check Now'}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-yellow-700 hover:bg-yellow-800 px-2 sm:px-3 py-1 rounded text-xs font-medium transition-colors"
          >
            <span className="hidden sm:inline">Refresh Page</span>
            <span className="sm:hidden">Refresh</span>
          </button>
        </div>
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