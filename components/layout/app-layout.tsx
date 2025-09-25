'use client'

import { useAuth } from '@/components/providers/auth-provider'
import Header from '@/components/layout/header'
import LoginForm from '@/components/auth/login-form'
import { ConnectionStatus } from '@/components/ui/connection-status'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  console.log('AppLayout render - loading:', loading, 'user:', user?.email || 'none')

  if (loading) {
    console.log('AppLayout: Still loading auth state')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user) {
    console.log('AppLayout: No user found, showing login form')
    return <LoginForm />
  }

  console.log('AppLayout: User authenticated, showing main app')

  return (
    <div className="min-h-screen bg-gray-50">
      <ConnectionStatus />
      <Header />
      <main className="mx-auto max-w-7xl px-2 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
        {children}
      </main>
    </div>
  )
}