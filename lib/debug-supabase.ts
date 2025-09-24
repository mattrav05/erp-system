/**
 * Debug utilities to understand Supabase session issues
 */

import { supabase } from './supabase'

let debugInterval: NodeJS.Timeout | null = null

export function startSupabaseDebugging() {
  if (typeof window === 'undefined') return // Only run in browser

  console.log('🐛 Starting Supabase debugging...')

  // Log session info every 10 seconds
  debugInterval = setInterval(async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      console.log('🐛 Debug Info:', {
        timestamp: new Date().toLocaleTimeString(),
        sessionExists: !!session,
        sessionError: sessionError?.message,
        sessionExpiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : 'N/A',
        sessionExpiresIn: session?.expires_at ? Math.round((session.expires_at * 1000 - Date.now()) / 1000) + 's' : 'N/A',
        sessionAccessToken: session?.access_token ? session.access_token.substring(0, 20) + '...' : 'N/A',
        sessionRefreshToken: session?.refresh_token ? 'present' : 'missing',
        userExists: !!user,
        userError: userError?.message,
        userEmail: user?.email || 'N/A'
      })

      // Try a simple query to test connectivity
      const { data, error } = await supabase.from('profiles').select('count(*)', { count: 'exact', head: true })

      console.log('🐛 Query Test:', {
        querySuccess: !error,
        queryError: error?.message || error?.code,
        queryData: data
      })

      // If session is expiring soon, warn
      if (session?.expires_at) {
        const expiresIn = (session.expires_at * 1000 - Date.now()) / 1000
        if (expiresIn < 300) { // Less than 5 minutes
          console.warn('⚠️ Session expires in', Math.round(expiresIn), 'seconds')
        }
      }

    } catch (error) {
      console.error('🐛 Debug error:', error)
    }
  }, 10000)
}

export function stopSupabaseDebugging() {
  if (debugInterval) {
    clearInterval(debugInterval)
    debugInterval = null
    console.log('🐛 Stopped Supabase debugging')
  }
}

// Auto-start debugging in development
if (process.env.NODE_ENV === 'development') {
  if (typeof window !== 'undefined') {
    setTimeout(startSupabaseDebugging, 1000) // Start after page load
  }
}