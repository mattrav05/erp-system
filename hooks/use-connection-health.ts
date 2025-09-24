'use client'

import { useState, useEffect } from 'react'
import { connectionHealth } from '@/lib/connection-health'

export function useConnectionHealth() {
  const [isHealthy, setIsHealthy] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    // Set initial state
    setIsHealthy(connectionHealth.isConnectionHealthy())
    setLastChecked(new Date())

    // Subscribe to health changes
    const unsubscribe = connectionHealth.onHealthChange((healthy) => {
      setIsHealthy(healthy)
      setLastChecked(new Date())
    })

    return unsubscribe
  }, [])

  return {
    isHealthy,
    lastChecked,
    checkHealth: () => connectionHealth.checkHealth(),
    attemptRecovery: () => connectionHealth.attemptRecovery()
  }
}