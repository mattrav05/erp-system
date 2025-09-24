'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { getCurrentUser, getCurrentProfile, type Profile } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { connectionHealth } from '@/lib/connection-health'
import '@/lib/debug-supabase' // Auto-start debugging in development

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  connectionHealthy: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  connectionHealthy: true
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectionHealthy, setConnectionHealthy] = useState(true)

  console.log('AuthProvider render - user:', user?.email || 'none', 'loading:', loading)

  useEffect(() => {
    let mounted = true

    // Set up periodic session refresh to prevent expiration
    const sessionRefreshInterval = setInterval(async () => {
      if (user && mounted) {
        console.log('🔄 Periodic session refresh for user:', user.email)

        // Get current session info before refresh
        const { data: { session: beforeSession } } = await supabase.auth.getSession()
        console.log('📊 Session before refresh:', {
          exists: !!beforeSession,
          expiresAt: beforeSession?.expires_at ? new Date(beforeSession.expires_at * 1000).toLocaleTimeString() : 'N/A',
          expiresIn: beforeSession?.expires_at ? Math.round((beforeSession.expires_at * 1000 - Date.now()) / 1000) + 's' : 'N/A'
        })

        const { error, data } = await supabase.auth.refreshSession()
        if (error) {
          console.error('❌ Session refresh error:', error)

          // Try to re-authenticate if refresh fails
          console.log('🔄 Refresh failed, checking user status...')
          const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
          console.log('👤 Current user after failed refresh:', {
            user: currentUser?.email || 'none',
            error: userError?.message
          })
        } else {
          console.log('✅ Session refreshed successfully')
          if (data.session) {
            console.log('📊 New session expires at:', new Date(data.session.expires_at * 1000).toLocaleTimeString())
          }
        }
      }
    }, 600000) // Refresh every 10 minutes

    // Set up connection health monitoring
    const unsubscribeHealth = connectionHealth.onHealthChange((healthy) => {
      console.log('🔄 Connection health changed:', healthy)
      if (mounted) {
        setConnectionHealthy(healthy)

        // If connection recovered, reload auth state
        if (healthy && !connectionHealthy) {
          console.log('🔧 Connection recovered, checking auth state...')
          // Don't reload if we already have a user
          if (!user) {
            loadAuth()
          }
        }
      }
    })

    const loadAuth = async () => {
      console.log('🚀 AuthProvider: Loading initial auth state...')
      try {
        // First try to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
        }

        // If we have a session, use it, otherwise try getUser
        const { data: { user }, error } = session
          ? { data: { user: session.user }, error: null }
          : await supabase.auth.getUser()
        console.log('👤 AuthProvider: Got current user:', user?.email || 'none', 'error:', error?.message || 'none')

        if (!mounted) return

        setUser(user)

        if (user) {
          console.log('👤 AuthProvider: User found, loading profile...')
          try {
            const { data: userProfile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single()

            console.log('📋 AuthProvider: Got profile:', userProfile, 'error:', profileError?.message || 'none')

            if (mounted) {
              setProfile(userProfile || {
                id: user.id,
                email: user.email || 'unknown@example.com',
                first_name: 'User',
                last_name: '',
                role: 'user',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            }
          } catch (profileError) {
            console.error('❌ Profile error:', profileError)
            if (mounted) {
              setProfile({
                id: user.id,
                email: user.email || 'unknown@example.com',
                first_name: 'User',
                last_name: '',
                role: 'user',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            }
          }
        } else {
          console.log('👻 AuthProvider: No user found')
        }
      } catch (error) {
        console.error('💥 Auth error:', error)
      } finally {
        if (mounted) {
          console.log('✅ AuthProvider: Setting loading to false')
          setLoading(false)
        }
      }
    }

    // Load initial auth state
    loadAuth()

    // Listen for auth state changes (sign in/out)
    console.log('👂 AuthProvider: Setting up auth state listener...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔥 AUTH STATE CHANGED:', event, session?.user?.email || 'no user')
        console.log('📊 Current state before change - user:', user?.email || 'none', 'loading:', loading)

        if (!mounted) {
          console.log('⚠️ Component unmounted, ignoring auth change')
          return
        }

        // Force state updates regardless of current state
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ HANDLING SIGN IN for:', session.user.email)

          // Set user immediately
          setUser(session.user)
          setLoading(false)

          // Get profile directly here
          try {
            const { data: userProfile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()

            console.log('📋 Profile loaded on sign in:', userProfile)

            if (mounted) {
              setProfile(userProfile || {
                id: session.user.id,
                email: session.user.email || 'unknown@example.com',
                first_name: 'User',
                last_name: '',
                role: 'user',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            }
          } catch (profileError) {
            console.error('❌ Profile error on auth change:', profileError)
            if (mounted) {
              setProfile({
                id: session.user.id,
                email: session.user.email || 'unknown@example.com',
                first_name: 'User',
                last_name: '',
                role: 'user',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            }
          }
        } else if (event === 'SIGNED_OUT' || !session) {
          console.log('❌ HANDLING SIGN OUT')
          setUser(null)
          setProfile(null)
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 Token refresh with user:', session.user.email)
          setUser(session.user)
          setLoading(false)
        } else {
          console.log('🤷 Other auth event:', event, 'session:', !!session)
          setLoading(false)
        }

        console.log('📊 Auth state processing complete')
      }
    )
    console.log('👂 Auth listener subscription created:', !!subscription)

    // Add a timeout as safety net
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.log('⏰ Auth timeout - forcing loading to false')
        setLoading(false)
      }
    }, 5000)

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      clearInterval(sessionRefreshInterval)
      subscription.unsubscribe()
      unsubscribeHealth()
      console.log('🧹 AuthProvider cleanup')
    }
  }, [])

  // Add comprehensive debugging for Supabase client corruption
  useEffect(() => {
    let debugInterval: NodeJS.Timeout

    const logSupabaseState = () => {
      try {
        console.log('🔍 DEBUGGING SUPABASE CLIENT STATE:', {
          timestamp: new Date().toLocaleTimeString(),
          supabaseExists: !!supabase,
          supabaseType: typeof supabase,
          supabaseConstructor: supabase?.constructor?.name,
          authExists: !!supabase?.auth,
          authType: typeof supabase?.auth,
          hasGetUser: typeof supabase?.auth?.getUser === 'function',
          hasGetSession: typeof supabase?.auth?.getSession === 'function',
          hasOnAuthStateChange: typeof supabase?.auth?.onAuthStateChange === 'function',
          fromExists: !!supabase?.from,
          fromType: typeof supabase?.from,
          userState: user?.email || 'none',
          documentHidden: document.hidden,
          windowFocused: document.hasFocus(),
        })

        // Test if we can create a query builder
        try {
          const testQueryBuilder = supabase.from('profiles')
          console.log('✅ Query builder created successfully:', !!testQueryBuilder)
        } catch (queryError) {
          console.error('❌ Failed to create query builder:', queryError)
        }

        // Test auth methods
        try {
          console.log('🔐 Testing auth.getUser...')
          supabase.auth.getUser().then((result) => {
            console.log('✅ auth.getUser success:', {
              hasData: !!result.data,
              hasUser: !!result.data.user,
              email: result.data.user?.email,
              error: result.error?.message
            })
          }).catch((authError) => {
            console.error('❌ auth.getUser failed:', authError)
          })
        } catch (authError) {
          console.error('❌ auth.getUser threw sync error:', authError)
        }

      } catch (error) {
        console.error('💥 CRITICAL: Failed to debug Supabase state:', error)
      }
    }

    const handleVisibilityChange = () => {
      console.log(`👁️ VISIBILITY CHANGED: ${document.hidden ? 'HIDDEN' : 'VISIBLE'}`)
      logSupabaseState()

      if (!document.hidden && user) {
        console.log('🔄 Tab became visible with user, testing Supabase client...')
        setTimeout(logSupabaseState, 1000) // Test again after 1 second
      }
    }

    const handleFocus = () => {
      console.log('🎯 WINDOW FOCUSED')
      logSupabaseState()
    }

    const handleBlur = () => {
      console.log('😴 WINDOW BLURRED')
      logSupabaseState()
    }

    // Log initial state
    console.log('🚀 INITIAL SUPABASE DEBUG LOG')
    logSupabaseState()

    // Start periodic debugging (every 5 seconds)
    debugInterval = setInterval(logSupabaseState, 5000)

    // Listen to all visibility events
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      clearInterval(debugInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      console.log('🧹 Supabase debugging cleanup')
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, profile, loading, connectionHealthy }}>
      {children}
    </AuthContext.Provider>
  )
}