'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'
import { useAuth } from '@/components/providers/auth-provider'
import { supabase } from '@/lib/supabase'
import { safeQuery } from '@/lib/supabase-query'
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

  // Removed focus reload - was causing auth state issues

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
      <div className="mx-auto max-w-7xl px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-white flex-shrink-0">
            EZ
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1 overflow-x-auto flex-1 max-w-none ml-6">
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

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-white hover:bg-blue-500"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4">
            <nav className="grid grid-cols-3 gap-2">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex flex-col items-center p-2 text-xs font-bold rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-500 text-white font-extrabold'
                        : 'text-white hover:bg-blue-500 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 mb-1" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Search Bar with User Controls */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="py-2 md:py-3 flex items-center gap-2 md:gap-4">
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
            <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100 p-2">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
              <div className="hidden sm:flex items-center space-x-2">
                <ConnectionIndicator />
                <span className="text-sm text-gray-700 whitespace-nowrap">
                  {profile?.first_name || user.email?.split('@')[0] || 'User'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 text-xs px-2 md:px-3 py-1">
                <span className="hidden sm:inline">Sign Out</span>
                <span className="sm:hidden">Out</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

    </header>
  )
}