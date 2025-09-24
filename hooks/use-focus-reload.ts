'use client'

import { useEffect, useRef } from 'react'

/**
 * Hook that reloads data when the window regains focus after being idle
 * Helps fix the issue where components don't load after tab switching
 */
export function useFocusReload(reloadFn: () => void, deps: any[] = []) {
  const lastFocusTime = useRef(Date.now())
  const isReloading = useRef(false)

  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now()
      const timeSinceLastFocus = now - lastFocusTime.current

      // If more than 30 seconds since last focus, reload data
      if (timeSinceLastFocus > 30000 && !isReloading.current) {
        console.log('🔄 Window regained focus after idle, reloading data...')
        isReloading.current = true

        // Small delay to ensure the page is fully focused
        setTimeout(() => {
          reloadFn()
          isReloading.current = false
        }, 100)
      }

      lastFocusTime.current = now
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleFocus()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [...deps, reloadFn])
}