'use client'

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, Calendar, User, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface InventoryItem {
  id: string
  product: {
    id: string
    sku: string
    name: string
    unit_of_measure: string
  }
}

interface SalesOrderItem {
  id: string
  sales_order_id: string
  quantity: number
  unit_price: number
  total_price: number
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
}

interface SalesOrder {
  id: string
  order_number: string
  customer_name: string
  order_date: string
  status: 'DRAFT' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  total_amount: number
  items: SalesOrderItem[]
}

interface ItemSalesOrdersProps {
  item: InventoryItem
  dateRange?: { start: string; end: string }
  onClose?: () => void
}

export default function ItemSalesOrders({ item, dateRange, onClose }: ItemSalesOrdersProps) {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(dateRange?.start || '')
  const [endDate, setEndDate] = useState(dateRange?.end || '')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  useEffect(() => {
    loadSalesOrders()
  }, [item.id, startDate, endDate, statusFilter])

  const loadSalesOrders = async () => {
    try {
      setLoading(true)
      setError(null)

      // Sample data - in real implementation, query your sales_orders table
      const sampleOrders: SalesOrder[] = [
        {
          id: '1',
          order_number: 'SO-2024-001',
          customer_name: 'ABC Corporation',
          order_date: '2024-01-15T10:00:00Z',
          status: 'CONFIRMED',
          total_amount: 1250.00,
          items: [{
            id: '1',
            sales_order_id: '1',
            quantity: 50,
            unit_price: 15.00,
            total_price: 750.00,
            status: 'CONFIRMED'
          }]
        },
        {
          id: '2',
          order_number: 'SO-2024-002',
          customer_name: 'XYZ Industries',
          order_date: '2024-01-20T14:30:00Z',
          status: 'SHIPPED',
          total_amount: 2250.00,
          items: [{
            id: '2',
            sales_order_id: '2',
            quantity: 150,
            unit_price: 15.00,
            total_price: 2250.00,
            status: 'SHIPPED'
          }]
        },
        {
          id: '3',
          order_number: 'SO-2024-003',
          customer_name: 'DEF Company',
          order_date: '2024-01-25T09:15:00Z',
          status: 'DELIVERED',
          total_amount: 375.00,
          items: [{
            id: '3',
            sales_order_id: '3',
            quantity: 25,
            unit_price: 15.00,
            total_price: 375.00,
            status: 'DELIVERED'
          }]
        },
        {
          id: '4',
          order_number: 'SO-2024-004',
          customer_name: 'GHI Solutions',
          order_date: '2024-01-28T16:20:00Z',
          status: 'DRAFT',
          total_amount: 900.00,
          items: [{
            id: '4',
            sales_order_id: '4',
            quantity: 60,
            unit_price: 15.00,
            total_price: 900.00,
            status: 'PENDING'
          }]
        }
      ]

      // Filter by date range
      let filtered = sampleOrders
      if (startDate) {
        filtered = filtered.filter(order => new Date(order.order_date) >= new Date(startDate))
      }
      if (endDate) {
        filtered = filtered.filter(order => new Date(order.order_date) <= new Date(endDate))
      }

      // Filter by status
      if (statusFilter !== 'all') {
        switch (statusFilter) {
          case 'active':
            filtered = filtered.filter(order => ['DRAFT', 'CONFIRMED', 'SHIPPED'].includes(order.status))
            break
          case 'completed':
            filtered = filtered.filter(order => order.status === 'DELIVERED')
            break
          case 'cancelled':
            filtered = filtered.filter(order => order.status === 'CANCELLED')
            break
        }
      }

      // Sort by date (most recent first)
      filtered.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())

      setSalesOrders(filtered)

    } catch (err) {
      console.error('Error loading sales orders:', err)
      setError('Failed to load sales orders')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800'
      case 'SHIPPED': return 'bg-yellow-100 text-yellow-800'
      case 'DELIVERED': return 'bg-green-100 text-green-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const totalQuantityOrdered = salesOrders.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
  }, 0)

  const totalOrderValue = salesOrders.reduce((sum, order) => sum + order.total_amount, 0)

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">
          <ShoppingCart className="h-8 w-8 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Sales Orders</h2>
        <p className="text-sm text-gray-600">
          {item.product.sku} - {item.product.name}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesOrders.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalQuantityOrdered} {item.product.unit_of_measure}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalOrderValue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('active')}
          >
            Active
          </Button>
          <Button
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('completed')}
          >
            Completed
          </Button>
          <Button
            variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('cancelled')}
          >
            Cancelled
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Start date"
            className="w-40"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="End date"
            className="w-40"
          />
        </div>
      </div>

      {/* Sales Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Orders ({salesOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {salesOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sales orders found for this item</p>
            </div>
          ) : (
            <div className="space-y-3">
              {salesOrders.map((order) => {
                const itemInOrder = order.items.find(item => item.sales_order_id === order.id)
                const isExpanded = expandedOrder === order.id

                return (
                  <div
                    key={order.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <ShoppingCart className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{order.order_number}</span>
                            <Badge className={getStatusColor(order.status)}>
                              {order.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            {order.customer_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(order.order_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right flex items-center space-x-4">
                        <div>
                          <div className="font-medium text-blue-600">
                            {itemInOrder?.quantity || 0} {item.product.unit_of_measure}
                          </div>
                          <div className="text-sm text-gray-600">
                            @ {formatCurrency(itemInOrder?.unit_price || 0)}
                          </div>
                          <div className="text-sm font-medium">
                            {formatCurrency(itemInOrder?.total_price || 0)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Order Total:</span> {formatCurrency(order.total_amount)}
                          </div>
                          <div>
                            <span className="font-medium">Customer:</span> {order.customer_name}
                          </div>
                          <div>
                            <span className="font-medium">Order Date:</span> {new Date(order.order_date).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="font-medium">Status:</span> {order.status}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Bottom close button */}
      <div className="bg-gray-50 border-t border-gray-200 p-4 mt-6 text-center">
        <div className="text-xs text-gray-400 mb-3">
          — End of Sales Orders —
        </div>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
        >
          Close Window
        </button>
      </div>
    </div>
  )
}