import { useEffect } from 'react'

/**
 * Custom hook to warn users about unsaved changes when they try to leave the page
 * Handles browser navigation, tab closing, page refresh, etc.
 * 
 * @param hasUnsavedChanges - Boolean indicating if there are unsaved changes
 * @param message - Custom message to show (optional)
 */
export function useUnsavedChangesWarning(
  hasUnsavedChanges: boolean, 
  message: string = 'You have unsaved changes. Are you sure you want to leave?'
) {
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Modern browsers require setting both returnValue and returning a string
      event.preventDefault()
      event.returnValue = message
      return message
    }

    const handlePopState = (event: PopStateEvent) => {
      if (hasUnsavedChanges) {
        const shouldLeave = window.confirm(message)
        if (!shouldLeave) {
          // Push the current state back to prevent navigation
          window.history.pushState(null, '', window.location.href)
        }
      }
    }

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    // Cleanup on unmount or when hasUnsavedChanges changes
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [hasUnsavedChanges, message])
}