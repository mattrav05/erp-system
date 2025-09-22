'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { 
  Package, 
  ShoppingCart, 
  FileText, 
  Users,
  TrendingUp,
  AlertTriangle,
  Truck
} from 'lucide-react'

interface DashboardStats {
  totalProducts: number
  lowStockProducts: number
  pendingPurchaseOrders: number
  activeSalesOrders: number
  totalInventoryValue: number
  pendingInvoices: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    pendingPurchaseOrders: 0,
    activeSalesOrders: 0,
    totalInventoryValue: 0,
    pendingInvoices: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Load basic stats in parallel
        const [
          productsResult,
          inventoryResult,
          purchaseOrdersResult,
          salesOrdersResult,
          invoicesResult
        ] = await Promise.all([
          supabase.from('products').select('id, reorder_point', { count: 'exact' }),
          supabase.from('inventory').select('quantity_available, weighted_average_cost'),
          supabase.from('purchase_orders').select('id', { count: 'exact' }).in('status', ['DRAFT', 'SENT', 'ACKNOWLEDGED']),
          supabase.from('sales_orders').select('id', { count: 'exact' }).in('status', ['DRAFT', 'CONFIRMED']),
          supabase.from('invoices').select('id', { count: 'exact' }).in('status', ['DRAFT', 'SENT'])
        ])

        // Calculate inventory value and low stock items
        let totalInventoryValue = 0
        let lowStockCount = 0

        if (inventoryResult.data) {
          totalInventoryValue = inventoryResult.data.reduce((sum, item) => {
            return sum + (item.quantity_available * item.weighted_average_cost)
          }, 0)
        }

        // Check for low stock items (simplified - would need to join with products in real implementation)
        if (inventoryResult.data) {
          lowStockCount = inventoryResult.data.filter(item => item.quantity_available < 50).length
        }

        setStats({
          totalProducts: productsResult.count || 0,
          lowStockProducts: lowStockCount,
          pendingPurchaseOrders: purchaseOrdersResult.count || 0,
          activeSalesOrders: salesOrdersResult.count || 0,
          totalInventoryValue,
          pendingInvoices: invoicesResult.count || 0
        })
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  const statCards = [
    {
      title: 'Total Products',
      value: stats.totalProducts.toString(),
      description: 'Active products in catalog',
      icon: Package,
      color: 'text-blue-600'
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockProducts.toString(),
      description: 'Products below reorder point',
      icon: AlertTriangle,
      color: 'text-red-600'
    },
    {
      title: 'Pending Purchase Orders',
      value: stats.pendingPurchaseOrders.toString(),
      description: 'Orders awaiting fulfillment',
      icon: ShoppingCart,
      color: 'text-orange-600'
    },
    {
      title: 'Active Sales Orders',
      value: stats.activeSalesOrders.toString(),
      description: 'Orders in progress',
      icon: FileText,
      color: 'text-green-600'
    },
    {
      title: 'Inventory Value',
      value: formatCurrency(stats.totalInventoryValue),
      description: 'Total inventory at cost',
      icon: TrendingUp,
      color: 'text-purple-600'
    },
    {
      title: 'Pending Invoices',
      value: stats.pendingInvoices.toString(),
      description: 'Invoices awaiting payment',
      icon: Users,
      color: 'text-indigo-600'
    }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Welcome to your ERP system. Here's an overview of your business.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            <CardDescription>Latest system activity and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">System initialized successfully</p>
                  <p className="text-xs text-gray-500">Welcome to your new ERP system</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Database schema deployed</p>
                  <p className="text-xs text-gray-500">Ready to add your business data</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Configure integrations</p>
                  <p className="text-xs text-gray-500">Set up ShipStation and QuickBooks connections</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <a href="/inventory" className="p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors block">
                <Package className="h-6 w-6 text-blue-600 mb-2" />
                <div className="text-sm font-medium">Inventory</div>
                <div className="text-xs text-gray-500">Manage stock levels</div>
              </a>
              <a href="/purchase-orders" className="p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors block">
                <ShoppingCart className="h-6 w-6 text-green-600 mb-2" />
                <div className="text-sm font-medium">Purchase Orders</div>
                <div className="text-xs text-gray-500">Buy from suppliers</div>
              </a>
              <a href="/sales-orders" className="p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors block">
                <FileText className="h-6 w-6 text-purple-600 mb-2" />
                <div className="text-sm font-medium">Sales Orders</div>
                <div className="text-xs text-gray-500">Sell to customers</div>
              </a>
              <a href="/customers" className="p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors block">
                <Users className="h-6 w-6 text-orange-600 mb-2" />
                <div className="text-sm font-medium">Customers</div>
                <div className="text-xs text-gray-500">Customer records</div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}