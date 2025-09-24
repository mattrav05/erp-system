'use client'

import { useEffect } from 'react'

/**
 * Component to prevent aggressive page reloads on window focus changes
 * in Next.js 15 production environments
 */
export function FocusReloadPreventer() {
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') {
      return
    }

    console.log('🛡️ Initializing focus reload prevention...')

    let isInitialLoad = true
    let lastFocusTime = Date.now()

    const handleVisibilityChange = (event: Event) => {
      if (isInitialLoad) {
        isInitialLoad = false
        return
      }

      const now = Date.now()
      const timeSinceFocus = now - lastFocusTime

      console.log(`👁️ Visibility changed: ${document.hidden ? 'HIDDEN' : 'VISIBLE'}, time since last: ${timeSinceFocus}ms`)

      // If rapid visibility changes, prevent potential reload triggers
      if (timeSinceFocus < 1000) {
        console.log('🛡️ Preventing rapid focus change reload')
        event.preventDefault?.()
        event.stopPropagation?.()
      }

      lastFocusTime = now
    }

    const handleFocus = (event: FocusEvent) => {
      const now = Date.now()
      const timeSinceFocus = now - lastFocusTime

      console.log(`🎯 Window focused, time since last: ${timeSinceFocus}ms`)

      if (timeSinceFocus < 1000 && !isInitialLoad) {
        console.log('🛡️ Preventing rapid focus reload')
        event.preventDefault?.()
        event.stopPropagation?.()
      }

      lastFocusTime = now
    }

    const handleBlur = (event: FocusEvent) => {
      console.log('😴 Window blurred')
      lastFocusTime = Date.now()
    }

    // Override any router.reload or window.location.reload calls during focus changes
    const originalReload = window.location.reload
    const originalRouterReload = (window as unknown as Record<string, unknown>).__NEXT_DATA__?.router?.reload

    window.location.reload = function(...args: unknown[]) {
      const timeSinceFocus = Date.now() - lastFocusTime
      if (timeSinceFocus < 2000) {
        console.log('🛡️ Blocked window.location.reload during focus change')
        return
      }
      return originalReload.apply(this, args)
    }

    // Listen for all focus-related events
    document.addEventListener('visibilitychange', handleVisibilityChange, { capture: true })
    window.addEventListener('focus', handleFocus, { capture: true })
    window.addEventListener('blur', handleBlur, { capture: true })

    return () => {
      // Restore original functions
      window.location.reload = originalReload
      if (originalRouterReload) {
        ((window as unknown as Record<string, unknown>).__NEXT_DATA__ as Record<string, unknown>).router.reload = originalRouterReload
      }

      // Remove listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange, { capture: true })
      window.removeEventListener('focus', handleFocus, { capture: true })
      window.removeEventListener('blur', handleBlur, { capture: true })

      console.log('🧹 Focus reload prevention cleanup')
    }
  }, [])

  return null // This component doesn't render anything
}