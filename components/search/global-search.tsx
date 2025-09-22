'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Search, Package, Settings, User, FileText, ShoppingCart, Users, Truck, PieChart, Receipt, Calculator, DollarSign, Building, Phone, Mail, MapPin, CreditCard, Calendar, Hash, Eye, Edit, Plus, Filter, BarChart3 } from 'lucide-react'

interface SearchResult {
  id: string
  type: 'inventory' | 'receipts' | 'estimates' | 'sales_orders' | 'invoices' | 'purchase_orders' | 'customers' | 'vendors' | 'settings' | 'navigation' | 'actions'
  module: string
  title: string
  subtitle?: string
  description?: string
  icon: any
  iconColor?: string
  action: () => void
  priority?: number // For result ordering
}

interface GlobalSearchProps {
  onNavigate?: () => void // Optional callback for mobile menu closing
}

export default function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Global keyboard shortcut (Ctrl+K)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
      
      if (event.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Comprehensive search function
  const performSearch = async (searchQuery: string) => {
    if (searchQuery.length < 1) {
      setResults([])
      return
    }

    setLoading(true)
    const searchResults: SearchResult[] = []
    const searchLower = searchQuery.toLowerCase()

    try {
      // Search in parallel for better performance
      const searchPromises = [
        searchEstimates(searchLower),
        searchSalesOrders(searchLower),
        searchInvoices(searchLower), 
        searchPurchaseOrders(searchLower),
        searchReceipts(searchLower),
        searchCustomers(searchLower),
        searchVendors(searchLower),
        searchInventory(searchLower)
      ]

      const results = await Promise.allSettled(searchPromises)
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          searchResults.push(...result.value)
        }
      })

      // Add settings/navigation results
      const settingsResults = getSettingsResults(searchQuery)
      searchResults.push(...settingsResults)

      // Sort by priority and relevance
      searchResults.sort((a, b) => (b.priority || 0) - (a.priority || 0))

      console.log('Final search results:', searchResults)
      setResults(searchResults.slice(0, 15)) // Limit to 15 results
    } catch (error) {
      console.error('Error performing search:', error)
    }

    setLoading(false)
  }

  // Individual search functions
  const searchEstimates = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const { data, error } = await supabase
        .from('estimates')
        .select(`
          id, estimate_number, job_name, status, total_amount, estimate_date,
          customers (name, email),
          sales_reps (first_name, last_name, employee_code)
        `)
        .limit(10)

      if (error || !data) return []

      return data
        .filter((item: any) => 
          item.estimate_number?.toLowerCase().includes(searchQuery) ||
          item.job_name?.toLowerCase().includes(searchQuery) ||
          item.customers?.name?.toLowerCase().includes(searchQuery) ||
          item.customers?.email?.toLowerCase().includes(searchQuery) ||
          `${item.sales_reps?.first_name} ${item.sales_reps?.last_name}`.toLowerCase().includes(searchQuery)
        )
        .slice(0, 3)
        .map((item: any) => ({
          id: item.id,
          type: 'estimates' as const,
          module: 'Estimates',
          title: `${item.estimate_number} - ${item.job_name || 'Untitled'}`,
          subtitle: item.customers?.name || 'No Customer',
          description: `$${item.total_amount?.toFixed(2) || '0.00'} • ${item.status}`,
          icon: Calculator,
          iconColor: 'text-green-600',
          priority: 8,
          action: () => {
            router.push(`/estimates?open=${item.id}`)
            setIsOpen(false)
            setQuery('')
            onNavigate?.()
          }
        }))
    } catch (error) {
      console.error('Error searching estimates:', error)
      return []
    }
  }

  const searchSalesOrders = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id, so_number, status, total_amount, order_date,
          customers (name, email),
          sales_reps (first_name, last_name, employee_code)
        `)
        .limit(10)

      if (error || !data) return []

      return data
        .filter((item: any) => 
          item.so_number?.toLowerCase().includes(searchQuery) ||
          item.customers?.name?.toLowerCase().includes(searchQuery) ||
          item.customers?.email?.toLowerCase().includes(searchQuery)
        )
        .slice(0, 3)
        .map((item: any) => ({
          id: item.id,
          type: 'sales_orders' as const,
          module: 'Sales Orders',
          title: `${item.so_number}`,
          subtitle: item.customers?.name || 'No Customer',
          description: `$${item.total_amount?.toFixed(2) || '0.00'} • ${item.status}`,
          icon: FileText,
          iconColor: 'text-purple-600',
          priority: 8,
          action: () => {
            router.push(`/sales-orders?open=${item.id}`)
            setIsOpen(false)
            setQuery('')
            onNavigate?.()
          }
        }))
    } catch (error) {
      console.error('Error searching sales orders:', error)
      return []
    }
  }

  const searchInvoices = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, status, total_amount, invoice_date,
          customers (name, email)
        `)
        .limit(10)

      if (error || !data) return []

      return data
        .filter((item: any) => 
          item.invoice_number?.toLowerCase().includes(searchQuery) ||
          item.customers?.name?.toLowerCase().includes(searchQuery) ||
          item.customers?.email?.toLowerCase().includes(searchQuery)
        )
        .slice(0, 3)
        .map((item: any) => ({
          id: item.id,
          type: 'invoices' as const,
          module: 'Invoices',
          title: `${item.invoice_number}`,
          subtitle: item.customers?.name || 'No Customer',
          description: `$${item.total_amount?.toFixed(2) || '0.00'} • ${item.status}`,
          icon: Receipt,
          iconColor: 'text-red-600',
          priority: 8,
          action: () => {
            router.push(`/invoices?open=${item.id}`)
            setIsOpen(false)
            setQuery('')
            onNavigate?.()
          }
        }))
    } catch (error) {
      console.error('Error searching invoices:', error)
      return []
    }
  }

  const searchPurchaseOrders = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id, po_number, status, total_amount, order_date,
          vendors (name, email)
        `)
        .limit(10)

      if (error || !data) return []

      return data
        .filter((item: any) => 
          item.po_number?.toLowerCase().includes(searchQuery) ||
          item.vendors?.name?.toLowerCase().includes(searchQuery) ||
          item.vendors?.email?.toLowerCase().includes(searchQuery)
        )
        .slice(0, 3)
        .map((item: any) => ({
          id: item.id,
          type: 'purchase_orders' as const,
          module: 'Purchase Orders',
          title: `${item.po_number}`,
          subtitle: item.vendors?.name || 'No Vendor',
          description: `$${item.total_amount?.toFixed(2) || '0.00'} • ${item.status}`,
          icon: ShoppingCart,
          iconColor: 'text-green-600',
          priority: 8,
          action: () => {
            router.push(`/purchase-orders?open=${item.id}`)
            setIsOpen(false)
            setQuery('')
            onNavigate?.()
          }
        }))
    } catch (error) {
      console.error('Error searching purchase orders:', error)
      return []
    }
  }

  const searchReceipts = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const { data, error } = await supabase
        .from('inventory_receipts')
        .select(`
          id, receipt_number, reference_number, qty_received, receive_date, notes,
          products (id, name, sku),
          purchase_order_lines (
            purchase_orders (po_number, vendors (name))
          )
        `)
        .limit(10)

      if (error || !data) return []

      return data
        .filter((item: any) => 
          item.receipt_number?.toLowerCase().includes(searchQuery) ||
          item.reference_number?.toLowerCase().includes(searchQuery) ||
          item.products?.name?.toLowerCase().includes(searchQuery) ||
          item.products?.sku?.toLowerCase().includes(searchQuery) ||
          item.purchase_order_lines?.purchase_orders?.po_number?.toLowerCase().includes(searchQuery) ||
          item.purchase_order_lines?.purchase_orders?.vendors?.name?.toLowerCase().includes(searchQuery) ||
          item.notes?.toLowerCase().includes(searchQuery)
        )
        .slice(0, 3)
        .map((item: any) => ({
          id: item.id,
          type: 'receipts' as const,
          module: 'Receiving',
          title: `${item.receipt_number || 'Receipt'} - ${item.products?.name || 'Unknown Item'}`,
          subtitle: item.purchase_order_lines?.purchase_orders?.po_number || 'No PO',
          description: `Qty: ${item.qty_received} • ${new Date(item.receive_date).toLocaleDateString()}`,
          icon: Package,
          iconColor: 'text-indigo-600',
          priority: 7,
          action: () => {
            router.push(`/receiving?highlight=${item.id}`)
            setIsOpen(false)
            setQuery('')
            onNavigate?.()
          }
        }))
    } catch (error) {
      console.error('Error searching receipts:', error)
      return []
    }
  }

  const searchCustomers = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone, city, state')
        .limit(10)

      if (error || !data) return []

      return data
        .filter((item: any) => 
          item.name?.toLowerCase().includes(searchQuery) ||
          item.email?.toLowerCase().includes(searchQuery) ||
          item.phone?.toLowerCase().includes(searchQuery) ||
          item.city?.toLowerCase().includes(searchQuery)
        )
        .slice(0, 3)
        .map((item: any) => ({
          id: item.id,
          type: 'customers' as const,
          module: 'Customers',
          title: item.name,
          subtitle: item.email || 'No Email',
          description: `${item.phone || 'No Phone'} • ${item.city || ''}, ${item.state || ''}`.trim(),
          icon: Users,
          iconColor: 'text-orange-600',
          priority: 7,
          action: () => {
            router.push(`/customers?highlight=${item.id}`)
            setIsOpen(false)
            setQuery('')
            onNavigate?.()
          }
        }))
    } catch (error) {
      console.error('Error searching customers:', error)
      return []
    }
  }

  const searchVendors = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, email, phone, city, state')
        .limit(10)

      if (error || !data) return []

      return data
        .filter((item: any) => 
          item.name?.toLowerCase().includes(searchQuery) ||
          item.email?.toLowerCase().includes(searchQuery) ||
          item.phone?.toLowerCase().includes(searchQuery) ||
          item.city?.toLowerCase().includes(searchQuery)
        )
        .slice(0, 3)
        .map((item: any) => ({
          id: item.id,
          type: 'vendors' as const,
          module: 'Vendors',
          title: item.name,
          subtitle: item.email || 'No Email',
          description: `${item.phone || 'No Phone'} • ${item.city || ''}, ${item.state || ''}`.trim(),
          icon: Truck,
          iconColor: 'text-yellow-600',
          priority: 7,
          action: () => {
            router.push(`/vendors?highlight=${item.id}`)
            setIsOpen(false)
            setQuery('')
            onNavigate?.()
          }
        }))
    } catch (error) {
      console.error('Error searching vendors:', error)
      return []
    }
  }

  const searchInventory = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select(`
          id, available_quantity, cost, price,
          product:products (
            id, sku, manufacturer_part_number, name, description, category
          )
        `)
        .limit(10)

      if (inventoryError || !inventoryData) return []

      const filteredItems = inventoryData.filter((item: any) => {
        return (
          item.product.sku?.toLowerCase().includes(searchQuery) ||
          item.product.name?.toLowerCase().includes(searchQuery) ||
          item.product.manufacturer_part_number?.toLowerCase().includes(searchQuery) ||
          item.product.category?.toLowerCase().includes(searchQuery) ||
          item.product.description?.toLowerCase().includes(searchQuery)
        )
      })

      return filteredItems.slice(0, 4).map((item: any) => ({
        id: item.id,
        type: 'inventory' as const,
        module: 'Inventory',
        title: item.product.name,
        subtitle: item.product.sku,
        description: `Qty: ${item.available_quantity || 0} • $${item.price?.toFixed(2) || '0.00'}`,
        icon: Package,
        iconColor: 'text-blue-600',
        priority: 6,
        action: () => {
          router.push(`/inventory?highlight=${item.id}`)
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      }))
    } catch (error) {
      console.error('Error searching inventory:', error)
      return []
    }
  }

  // Static settings and navigation search results
  const getSettingsResults = (query: string): SearchResult[] => {
    const staticResults = [
      // Navigation
      {
        id: 'nav-dashboard',
        type: 'navigation' as const,
        module: 'Navigation',
        title: 'Dashboard',
        subtitle: 'Business overview and metrics',
        icon: PieChart,
        iconColor: 'text-gray-600',
        keywords: ['dashboard', 'home', 'overview', 'metrics'],
        priority: 5,
        action: () => {
          router.push('/')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'nav-estimates',
        type: 'navigation' as const,
        module: 'Navigation',
        title: 'Estimates',
        subtitle: 'Quotes and proposals',
        icon: Calculator,
        iconColor: 'text-green-600',
        keywords: ['estimates', 'quotes', 'proposals', 'est'],
        priority: 5,
        action: () => {
          router.push('/estimates')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'nav-sales-orders',
        type: 'navigation' as const,
        module: 'Navigation',
        title: 'Sales Orders',
        subtitle: 'Customer orders and fulfillment',
        icon: FileText,
        iconColor: 'text-purple-600',
        keywords: ['sales', 'so', 'orders', 'customers', 'sell'],
        priority: 5,
        action: () => {
          router.push('/sales-orders')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'nav-invoices',
        type: 'navigation' as const,
        module: 'Navigation',
        title: 'Invoices',
        subtitle: 'Billing and payments',
        icon: Receipt,
        iconColor: 'text-red-600',
        keywords: ['invoices', 'billing', 'payments', 'inv'],
        priority: 5,
        action: () => {
          router.push('/invoices')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'nav-purchase-orders',
        type: 'navigation' as const,
        module: 'Navigation',
        title: 'Purchase Orders',
        subtitle: 'Vendor orders and procurement',
        icon: ShoppingCart,
        iconColor: 'text-green-600',
        keywords: ['purchase', 'po', 'orders', 'suppliers', 'vendors', 'buy'],
        priority: 5,
        action: () => {
          router.push('/purchase-orders')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'nav-inventory',
        type: 'navigation' as const,
        module: 'Navigation',
        title: 'Inventory',
        subtitle: 'Stock levels and products',
        icon: Package,
        iconColor: 'text-blue-600',
        keywords: ['inventory', 'stock', 'items', 'products'],
        priority: 5,
        action: () => {
          router.push('/inventory')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'nav-customers',
        type: 'navigation' as const,
        module: 'Navigation',
        title: 'Customers',
        subtitle: 'Customer relationship management',
        icon: Users,
        iconColor: 'text-orange-600',
        keywords: ['customers', 'clients', 'accounts', 'crm'],
        priority: 5,
        action: () => {
          router.push('/customers')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'nav-vendors',
        type: 'navigation' as const,
        module: 'Navigation',
        title: 'Vendors',
        subtitle: 'Supplier relationship management',
        icon: Truck,
        iconColor: 'text-yellow-600',
        keywords: ['vendors', 'suppliers', 'partners'],
        priority: 5,
        action: () => {
          router.push('/vendors')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'nav-receiving',
        type: 'navigation' as const,
        module: 'Navigation',
        title: 'Receiving',
        subtitle: 'Inventory receipts and tracking',
        icon: Package,
        iconColor: 'text-indigo-600',
        keywords: ['receiving', 'receipts', 'intake', 'warehouse'],
        priority: 5,
        action: () => {
          router.push('/receiving')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'nav-reports',
        type: 'navigation' as const,
        module: 'Navigation',
        title: 'Reports & Analytics',
        subtitle: 'Business intelligence and reporting',
        icon: BarChart3,
        iconColor: 'text-indigo-600',
        keywords: ['reports', 'analytics', 'charts', 'sql', 'data', 'dashboard'],
        priority: 5,
        action: () => {
          router.push('/reports')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'nav-settings',
        type: 'navigation' as const,
        module: 'Navigation',
        title: 'Settings',
        subtitle: 'System configuration',
        icon: Settings,
        iconColor: 'text-gray-600',
        keywords: ['settings', 'config', 'configuration', 'preferences', 'setup'],
        priority: 5,
        action: () => {
          router.push('/settings')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },

      // Quick Actions
      {
        id: 'action-new-estimate',
        type: 'actions' as const,
        module: 'Quick Actions',
        title: 'Create New Estimate',
        subtitle: 'Start a new quote',
        icon: Plus,
        iconColor: 'text-green-600',
        keywords: ['create', 'new', 'estimate', 'quote', 'add'],
        priority: 4,
        action: () => {
          router.push('/estimates?create=true')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'action-new-sales-order',
        type: 'actions' as const,
        module: 'Quick Actions',
        title: 'Create New Sales Order',
        subtitle: 'Start a new customer order',
        icon: Plus,
        iconColor: 'text-purple-600',
        keywords: ['create', 'new', 'sales', 'order', 'so', 'add'],
        priority: 4,
        action: () => {
          router.push('/sales-orders?create=true')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'action-new-invoice',
        type: 'actions' as const,
        module: 'Quick Actions',
        title: 'Create New Invoice',
        subtitle: 'Bill a customer',
        icon: Plus,
        iconColor: 'text-red-600',
        keywords: ['create', 'new', 'invoice', 'bill', 'add'],
        priority: 4,
        action: () => {
          router.push('/invoices?create=true')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'action-new-purchase-order',
        type: 'actions' as const,
        module: 'Quick Actions',
        title: 'Create New Purchase Order',
        subtitle: 'Order from vendor',
        icon: Plus,
        iconColor: 'text-green-600',
        keywords: ['create', 'new', 'purchase', 'order', 'po', 'vendor', 'add'],
        priority: 4,
        action: () => {
          router.push('/purchase-orders?create=true')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'action-add-inventory',
        type: 'actions' as const,
        module: 'Quick Actions',
        title: 'Add Inventory Item',
        subtitle: 'Create a new product',
        icon: Plus,
        iconColor: 'text-blue-600',
        keywords: ['add', 'new', 'create', 'inventory', 'item', 'product'],
        priority: 4,
        action: () => {
          router.push('/inventory?add=true')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'action-add-customer',
        type: 'actions' as const,
        module: 'Quick Actions',
        title: 'Add New Customer',
        subtitle: 'Create customer account',
        icon: Plus,
        iconColor: 'text-orange-600',
        keywords: ['add', 'new', 'customer', 'client', 'create'],
        priority: 4,
        action: () => {
          router.push('/customers?add=true')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'action-add-vendor',
        type: 'actions' as const,
        module: 'Quick Actions',
        title: 'Add New Vendor',
        subtitle: 'Create supplier account',
        icon: Plus,
        iconColor: 'text-yellow-600',
        keywords: ['add', 'new', 'vendor', 'supplier', 'create'],
        priority: 4,
        action: () => {
          router.push('/vendors?add=true')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },

      // Settings & Configuration
      {
        id: 'settings-sales-reps',
        type: 'settings' as const,
        module: 'Settings',
        title: 'Sales Representatives',
        subtitle: 'Manage sales team',
        icon: Users,
        iconColor: 'text-indigo-600',
        keywords: ['sales', 'reps', 'representatives', 'team', 'employees', 'settings'],
        priority: 3,
        action: () => {
          router.push('/settings?section=sales-reps')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'settings-templates',
        type: 'settings' as const,
        module: 'Settings',
        title: 'Document Templates',
        subtitle: 'Estimate and invoice templates',
        icon: FileText,
        iconColor: 'text-gray-600',
        keywords: ['templates', 'documents', 'estimate', 'invoice', 'format', 'settings'],
        priority: 3,
        action: () => {
          router.push('/settings?section=templates')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'settings-tax',
        type: 'settings' as const,
        module: 'Settings',
        title: 'Tax Configuration',
        subtitle: 'Tax rates and codes',
        icon: Calculator,
        iconColor: 'text-red-600',
        keywords: ['tax', 'rates', 'codes', 'taxation', 'settings'],
        priority: 3,
        action: () => {
          router.push('/settings?section=tax')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'action-adjust-inventory',
        type: 'actions' as const,
        module: 'Inventory Actions',
        title: 'Adjust Inventory',
        subtitle: 'Modify quantities with audit trail',
        icon: Settings,
        iconColor: 'text-blue-600',
        keywords: ['adjust', 'adjustment', 'inventory', 'quantity', 'correct', 'fix'],
        priority: 3,
        action: () => {
          router.push('/inventory?adjust=true')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      },
      {
        id: 'action-receive-inventory',
        type: 'actions' as const,
        module: 'Receiving Actions',
        title: 'Receive Inventory',
        subtitle: 'Record incoming shipments',
        icon: Package,
        iconColor: 'text-indigo-600',
        keywords: ['receive', 'receiving', 'shipment', 'delivery', 'intake'],
        priority: 3,
        action: () => {
          router.push('/receiving?create=true')
          setIsOpen(false)
          setQuery('')
          onNavigate?.()
        }
      }
    ]

    return staticResults
      .filter(result => 
        result.keywords.some(keyword => 
          keyword.toLowerCase().includes(query.toLowerCase())
        ) ||
        result.title.toLowerCase().includes(query.toLowerCase()) ||
        result.subtitle.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  // Handle search input changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query)
    }, 300) // Debounce search

    return () => clearTimeout(timeoutId)
  }, [query])

  // Handle result selection with keyboard
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && results.length > 0) {
      results[selectedIndex]?.action()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex(prev => prev < results.length - 1 ? prev + 1 : prev)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex(prev => prev > 0 ? prev - 1 : prev)
    }
  }
  
  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  return (
    <div className="relative w-full max-w-2xl mx-auto" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search everything... (Ctrl+K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full h-10 pl-10 pr-4 text-sm border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (query.length > 0 || results.length > 0) && (
        <div className="fixed top-16 left-4 right-4 mt-1 bg-white border border-gray-200 rounded-md shadow-xl z-50 max-h-96 overflow-y-auto md:absolute md:top-full md:left-0 md:right-0 md:w-[500px] md:mx-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Searching...
            </div>
          )}
          
          {!loading && results.length === 0 && query.length > 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No results found for "{query}"
            </div>
          )}
          
          {results.length > 0 && (
            <div className="py-2">
              {(() => {
                // Group results by type for better organization
                const groupedResults = results.reduce((groups: {[key: string]: SearchResult[]}, result) => {
                  const key = result.type
                  if (!groups[key]) groups[key] = []
                  groups[key].push(result)
                  return groups
                }, {})

                const typeOrder = ['estimates', 'sales_orders', 'invoices', 'purchase_orders', 'receipts', 'customers', 'vendors', 'inventory', 'navigation', 'actions', 'settings']
                const typeLabels = {
                  estimates: 'Estimates',
                  sales_orders: 'Sales Orders', 
                  invoices: 'Invoices',
                  purchase_orders: 'Purchase Orders',
                  receipts: 'Receipts',
                  customers: 'Customers',
                  vendors: 'Vendors',
                  inventory: 'Inventory',
                  navigation: 'Navigate To',
                  actions: 'Quick Actions',
                  settings: 'Settings'
                }

                let globalIndex = 0
                return typeOrder.map(type => {
                  if (!groupedResults[type] || groupedResults[type].length === 0) return null
                  
                  return (
                    <div key={type}>
                      {Object.keys(groupedResults).length > 1 && (
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t first:border-t-0">
                          {typeLabels[type as keyof typeof typeLabels] || type}
                        </div>
                      )}
                      {groupedResults[type].map((result) => {
                        const IconComponent = result.icon
                        const isSelected = globalIndex === selectedIndex
                        const currentIndex = globalIndex++
                        
                        return (
                          <button
                            key={result.id}
                            onClick={result.action}
                            className={`w-full px-4 py-3 text-left focus:outline-none group flex items-center space-x-3 ${
                              isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              <IconComponent className={`h-5 w-5 ${result.iconColor || 'text-gray-400'} group-hover:brightness-110`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {result.title}
                                </p>
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {result.module}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                {result.subtitle && (
                                  <p className="text-xs text-gray-600 truncate">
                                    {result.subtitle}
                                  </p>
                                )}
                                {result.description && (
                                  <p className="text-xs text-gray-500 truncate">
                                    • {result.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                }).filter(Boolean)
              })()}
            </div>
          )}
          
          {query.length === 0 && (
            <div className="px-4 py-3 text-xs text-gray-400 border-t">
              Search across all data: estimates, orders, invoices, receipts, customers, vendors, inventory, and settings. Use Ctrl+K from anywhere.
            </div>
          )}
        </div>
      )}
    </div>
  )
}