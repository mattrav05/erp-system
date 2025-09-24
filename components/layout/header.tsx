'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'
import { useAuth } from '@/components/providers/auth-provider'
import { supabase } from '@/lib/supabase'
import { safeQuery } from '@/lib/supabase-query'
import { useFocusReload } from '@/hooks/use-focus-reload'
import GlobalSearch from '@/components/search/global-search'
import { ConnectionIndicator } from '@/components/ui/connection-status'
import { 
  Package, 
  ShoppingCart, 
  FileText, 
  Users, 
  BarChart3, 
  Settings,
  Menu,
  X,
  Truck,
  PieChart,
  Calculator,
  UserCheck,
  Receipt,
  PackageCheck,
  Ship,
  Database
} from 'lucide-react'

export default function Header() {
  const { user, profile } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [enabledModules, setEnabledModules] = useState<string[]>([])
  const pathname = usePathname()

  useEffect(() => {
    loadEnabledModules()
  }, [])

  // Reload modules when window regains focus
  useFocusReload(() => {
    console.log('🔄 Reloading enabled modules after focus')
    loadEnabledModules()
  })

  const loadEnabledModules = async () => {
    try {
      const { data, error } = await safeQuery(
        () => supabase
          .from('company_settings')
          .select('enabled_modules')
          .single(),
        'Loading enabled modules'
      )

      if (data?.enabled_modules) {
        setEnabledModules(data.enabled_modules as string[])
      } else if (!error) {
        // No modules configured, use default empty array
        setEnabledModules([])
      }
    } catch (error) {
      console.error('Failed to load enabled modules:', error)
      // Fallback to empty array if error
      setEnabledModules([])
    }
  }

  const handleSignOut = async () => {
    try {
      console.log('🚪 Header: Starting sign out process...')
      await signOut()
      console.log('✅ Header: Sign out completed')
    } catch (error) {
      console.error('❌ Header: Error signing out:', error)
    }
  }

  const baseNavigation = [
    { name: 'Dashboard', href: '/', icon: BarChart3, color: 'text-gray-600' },
    { name: 'Reports', href: '/reports', icon: PieChart, color: 'text-indigo-600' },
    { name: 'Inventory', href: '/inventory', icon: Package, color: 'text-blue-600' },
    { name: 'Receiving', href: '/receiving', icon: PackageCheck, color: 'text-teal-600' },
    { name: 'Customers', href: '/customers', icon: Users, color: 'text-orange-600' },
    { name: 'Vendors', href: '/vendors', icon: Truck, color: 'text-yellow-600' },
    { name: 'Estimates', href: '/estimates', icon: Calculator, color: 'text-emerald-600' },
    { name: 'SOs', href: '/sales-orders', icon: FileText, color: 'text-purple-600' },
    { name: 'POs', href: '/purchase-orders', icon: ShoppingCart, color: 'text-green-600' },
    { name: 'Invoices', href: '/invoices', icon: Receipt, color: 'text-red-600' },
    { name: 'Data Tools', href: '/data-tools', icon: Database, color: 'text-pink-600' },
  ]

  // Add conditional modules
  const navigation = [
    ...baseNavigation,
    ...(enabledModules.includes('shipping') ? [
      { name: 'Shipping', href: '/shipping', icon: Ship, color: 'text-sky-600' }
    ] : [])
  ]

  // Show header if user exists, even without profile
  if (!user) {
    return null
  }

  console.log('User found, rendering header. Profile:', profile)

  return (
    <header className="bg-blue-600 text-white shadow-lg border-b border-blue-700">
      {/* Main Title Bar with Navigation */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14">
          {/* Logo + Full Width Navigation */}
          <div className="flex items-center space-x-6 flex-1">
            <Link href="/" className="text-xl font-bold text-white">
              EZ
            </Link>
            <nav className="flex space-x-1 overflow-x-auto flex-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-2 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-500 text-white font-extrabold'
                        : 'text-white hover:bg-blue-500 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Search Bar with User Controls */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="py-3 flex items-center gap-4">
            <div className="flex-1">
              <GlobalSearch />
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100 p-2">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <ConnectionIndicator />
                <span className="text-sm text-gray-700 whitespace-nowrap">
                  {profile?.first_name || user.email?.split('@')[0] || 'User'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 text-xs px-3 py-1">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

    </header>
  )
}