import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  role: 'admin' | 'manager' | 'user'
  created_at: string
  updated_at: string
}

export async function signUp(email: string, password: string, firstName?: string, lastName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      }
    }
  })

  if (error) throw error

  // Profile will be created automatically by database trigger
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signOut() {
  console.log('🚪 lib/auth: Starting signOut...')
  const { error } = await supabase.auth.signOut()
  console.log('🚪 lib/auth: signOut result, error:', error?.message || 'none')
  if (error) throw error
  console.log('✅ lib/auth: signOut completed successfully')
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) throw error
  return data
}

export async function updateProfile(updates: Partial<Profile>) {
  const user = await getCurrentUser()
  if (!user) throw new Error('No user logged in')

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null)
  })
}

// Role-based access control helpers
export function hasRole(profile: Profile | null, roles: ('admin' | 'manager' | 'user')[]): boolean {
  if (!profile) return false
  return roles.includes(profile.role)
}

export function isAdmin(profile: Profile | null): boolean {
  return hasRole(profile, ['admin'])
}

export function isManager(profile: Profile | null): boolean {
  return hasRole(profile, ['admin', 'manager'])
}

export function canEditProducts(profile: Profile | null): boolean {
  return hasRole(profile, ['admin', 'manager'])
}

export function canCreatePurchaseOrders(profile: Profile | null): boolean {
  return hasRole(profile, ['admin', 'manager'])
}

export function canViewReports(profile: Profile | null): boolean {
  return hasRole(profile, ['admin', 'manager'])
}