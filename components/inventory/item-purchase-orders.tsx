'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { ShoppingBag, Calendar, Building, Eye } from 'lucide-react'
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

interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  quantity: number
  unit_cost: number
  total_cost: number
  quantity_received: number
  status: 'PENDING' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'
}

interface PurchaseOrder {
  id: string
  po_number: string
  supplier_name: string
  order_date: string
  expected_date?: string
  status: 'DRAFT' | 'SENT' | 'CONFIRMED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'
  total_amount: number
  items: PurchaseOrderItem[]
}

interface ItemPurchaseOrdersProps {
  item: InventoryItem
  dateRange?: { start: string; end: string }
  onClose?: () => void
}

export default function ItemPurchaseOrders({ item, dateRange, onClose }: ItemPurchaseOrdersProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(dateRange?.start || '')
  const [endDate, setEndDate] = useState(dateRange?.end || '')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'received' | 'cancelled'>('all')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  useEffect(() => {
    loadPurchaseOrders()
  }, [item.id, startDate, endDate, statusFilter])

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true)
      setError(null)

      // Query purchase order lines for this specific product
      const { data: poLines, error: poLinesError } = await supabase
        .from('purchase_order_lines')
        .select(`
          id,
          purchase_order_id,
          quantity,
          unit_price,
          purchase_orders (
            id,
            po_number,
            order_date,
            expected_delivery_date,
            status,
            total_amount,
            vendors (
              company_name
            )
          )
        `)
        .eq('product_id', item.product.id)
        .order('purchase_orders(order_date)', { ascending: false })

      if (poLinesError) {
        console.error('Error fetching PO lines:', poLinesError)
        throw poLinesError
      }

      // Get received quantities for each PO line
      const poLineIds = (poLines || []).map(line => line.id)
      const { data: receipts } = await supabase
        .from('inventory_receipts')
        .select('po_line_id, qty_received')
        .in('po_line_id', poLineIds)

      // Calculate received quantities by PO line
      const receivedByPoLine = (receipts || []).reduce((acc, receipt) => {
        if (!acc[receipt.po_line_id]) {
          acc[receipt.po_line_id] = 0
        }
        acc[receipt.po_line_id] += receipt.qty_received || 0
        return acc
      }, {} as Record<string, number>)

      // Transform data to match component interface
      const transformedOrders: PurchaseOrder[] = (poLines || [])
        .filter(line => line.purchase_orders) // Only include lines with valid POs
        .map(line => {
          const po = line.purchase_orders!
          const qtyReceived = receivedByPoLine[line.id] || 0
          const qtyOrdered = line.quantity || 0
          const unitCost = line.unit_price || 0
          const totalCost = qtyOrdered * unitCost

          // Determine line status based on received vs ordered
          let lineStatus: 'PENDING' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'
          if ((po as any).status === 'CANCELLED') {
            lineStatus = 'CANCELLED'
          } else if (qtyReceived === 0) {
            lineStatus = 'PENDING'
          } else if (qtyReceived >= qtyOrdered) {
            lineStatus = 'RECEIVED'
          } else {
            lineStatus = 'PARTIAL'
          }

          return {
            id: (po as any).id,
            po_number: (po as any).po_number || '',
            supplier_name: (po as any).vendors?.company_name || 'Unknown Supplier',
            order_date: (po as any).order_date || '',
            expected_date: (po as any).expected_delivery_date || undefined,
            status: (po as any).status as any,
            total_amount: (po as any).total_amount || 0,
            items: [{
              id: line.id,
              purchase_order_id: (po as any).id,
              quantity: qtyOrdered,
              unit_cost: unitCost,
              total_cost: totalCost,
              quantity_received: qtyReceived,
              status: lineStatus
            }]
          }
        })

      // Remove duplicates (if multiple lines for same PO, combine them)
      const uniqueOrders = new Map<string, PurchaseOrder>()
      transformedOrders.forEach(order => {
        if (uniqueOrders.has(order.id)) {
          const existing = uniqueOrders.get(order.id)!
          existing.items.push(...order.items)
        } else {
          uniqueOrders.set(order.id, order)
        }
      })

      let filtered = Array.from(uniqueOrders.values())

      // Filter by date range
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
            filtered = filtered.filter(order => ['PENDING', 'CONFIRMED', 'PARTIAL'].includes(order.status))
            break
          case 'received':
            filtered = filtered.filter(order => order.status === 'RECEIVED')
            break
          case 'cancelled':
            filtered = filtered.filter(order => order.status === 'CANCELLED')
            break
        }
      }

      // Sort by date (most recent first)
      filtered.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())

      setPurchaseOrders(filtered)

    } catch (err) {
      console.error('Error loading purchase orders:', err)
      setError('Failed to load purchase orders')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'SENT': return 'bg-blue-100 text-blue-800'
      case 'CONFIRMED': return 'bg-purple-100 text-purple-800'
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-800'
      case 'RECEIVED': return 'bg-green-100 text-green-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const totalQuantityOrdered = purchaseOrders.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
  }, 0)

  const totalQuantityReceived = purchaseOrders.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity_received, 0)
  }, 0)

  const totalOrderValue = purchaseOrders.reduce((sum, order) => sum + order.total_amount, 0)

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
          <ShoppingBag className="h-8 w-8 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Purchase Orders</h2>
        <p className="text-sm text-gray-600">
          {item.product.sku} - {item.product.name}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseOrders.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Qty Ordered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalQuantityOrdered} {item.product.unit_of_measure}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Qty Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalQuantityReceived} {item.product.unit_of_measure}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
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
            variant={statusFilter === 'received' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('received')}
          >
            Received
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

      {/* Purchase Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Orders ({purchaseOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No purchase orders found for this item</p>
            </div>
          ) : (
            <div className="space-y-3">
              {purchaseOrders.map((order) => {
                const itemInOrder = order.items.find(item => item.purchase_order_id === order.id)
                const isExpanded = expandedOrder === order.id

                return (
                  <div
                    key={order.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <ShoppingBag className="h-5 w-5 text-purple-600" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{order.po_number}</span>
                            <Badge className={getStatusColor(order.status)}>
                              {order.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 flex items-center">
                            <Building className="h-3 w-3 mr-1" />
                            {order.supplier_name}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            Ordered: {new Date(order.order_date).toLocaleDateString()}
                            {order.expected_date && (
                              <span className="ml-2">
                                • Expected: {new Date(order.expected_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right flex items-center space-x-4">
                        <div>
                          <div className="font-medium text-purple-600">
                            {itemInOrder?.quantity || 0} {item.product.unit_of_measure} ordered
                          </div>
                          <div className="text-sm text-green-600">
                            {itemInOrder?.quantity_received || 0} {item.product.unit_of_measure} received
                          </div>
                          <div className="text-sm text-gray-600">
                            @ {formatCurrency(itemInOrder?.unit_cost || 0)}
                          </div>
                          <div className="text-sm font-medium">
                            {formatCurrency(itemInOrder?.total_cost || 0)}
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
                            <span className="font-medium">Supplier:</span> {order.supplier_name}
                          </div>
                          <div>
                            <span className="font-medium">Order Date:</span> {new Date(order.order_date).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="font-medium">Expected Date:</span> {order.expected_date ? new Date(order.expected_date).toLocaleDateString() : 'Not specified'}
                          </div>
                          <div>
                            <span className="font-medium">Status:</span> {order.status}
                          </div>
                          {itemInOrder && (
                            <div>
                              <span className="font-medium">Received:</span> {itemInOrder.quantity_received} / {itemInOrder.quantity} {item.product.unit_of_measure}
                            </div>
                          )}
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
          — End of Purchase Orders —
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