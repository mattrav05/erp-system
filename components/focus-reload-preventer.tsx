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

    // Block h1-check.js error from causing reloads
    const originalAddEventListener = window.addEventListener
    window.addEventListener = function(type: string, listener: any, options?: any) {
      // Block specific problematic events that trigger reloads
      if (type === 'error' || type === 'unhandledrejection') {
        const wrappedListener = function(event: any) {
          // Check if error is from h1-check.js or similar
          if (event?.message?.includes('detectStore') ||
              event?.reason?.message?.includes('detectStore')) {
            console.log('🛡️ Blocked h1-check.js error from triggering reload')
            event.preventDefault?.()
            event.stopPropagation?.()
            return false
          }
          return listener.call(this, event)
        }
        return originalAddEventListener.call(this, type, wrappedListener, options)
      }
      return originalAddEventListener.call(this, type, listener, options)
    }

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
    const originalReload = window.location.reload.bind(window.location)

    // Use defineProperty to override reload in a way that works in strict mode
    try {
      Object.defineProperty(window.location, 'reload', {
        configurable: true,
        value: function(): void {
          const timeSinceFocus = Date.now() - lastFocusTime
          if (timeSinceFocus < 2000) {
            console.log('🛡️ Blocked window.location.reload during focus change')
            return
          }
          originalReload()
        }
      })
    } catch (e) {
      console.warn('Could not override window.location.reload:', e)
    }

    // Listen for all focus-related events
    document.addEventListener('visibilitychange', handleVisibilityChange, { capture: true })
    window.addEventListener('focus', handleFocus, { capture: true })
    window.addEventListener('blur', handleBlur, { capture: true })

    return () => {
      // Restore original functions
      try {
        Object.defineProperty(window.location, 'reload', {
          configurable: true,
          value: originalReload
        })
      } catch (e) {
        // Ignore cleanup errors
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