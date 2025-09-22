'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { matchesAmount } from '@/lib/search-utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Eye, Edit, Mail, Copy, Trash2, FileText, Package, Truck, CheckCircle, RefreshCw } from 'lucide-react'
import ContextMenu from '@/components/ui/context-menu'

type SalesOrder = Database['public']['Tables']['sales_orders']['Row'] & {
  customers?: { name: string; email: string | null }
  sales_reps?: { first_name: string; last_name: string; employee_code: string }
  sales_order_lines?: {
    item_code: string | null
    description: string
    product_id: string | null
    quantity: number
    qty_invoiced: number
    qty_remaining: number
    fulfillment_status: string
    products: {
      name: string
      sku: string
    } | null
  }[]
}

interface SalesOrdersListProps {
  onCreateSalesOrder: () => void
  onEditSalesOrder: (salesOrder: SalesOrder) => void
  salesOrders: SalesOrder[]
  setSalesOrders: (salesOrders: SalesOrder[]) => void
}

export default function SalesOrdersList({ 
  onCreateSalesOrder, 
  onEditSalesOrder, 
  salesOrders, 
  setSalesOrders 
}: SalesOrdersListProps) {
  const [filteredSalesOrders, setFilteredSalesOrders] = useState<SalesOrder[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    fetchSalesOrders()
    
    // Listen for duplicate sales order events
    const handleOpenSalesOrder = (event: CustomEvent) => {
      const { salesOrder } = event.detail
      // Refresh the sales orders list to include the new duplicate
      fetchSalesOrders()
      // Open the duplicate sales order for editing
      onEditSalesOrder(salesOrder)
    }
    
    window.addEventListener('openSalesOrderForEdit', handleOpenSalesOrder as EventListener)
    
    return () => {
      window.removeEventListener('openSalesOrderForEdit', handleOpenSalesOrder as EventListener)
    }
  }, [])

  // Check URL parameters to auto-open specific sales order
  useEffect(() => {
    const checkUrlParams = async () => {
      if (typeof window === 'undefined') return
      
      const urlParams = new URLSearchParams(window.location.search)
      const openSOId = urlParams.get('open')
      
      if (openSOId && salesOrders.length > 0) {
        const salesOrderToOpen = salesOrders.find(so => so.id === openSOId)
        if (salesOrderToOpen) {
          // Clear the URL parameter
          window.history.replaceState({}, '', window.location.pathname)
          // Open the sales order for editing
          onEditSalesOrder(salesOrderToOpen)
        } else {
          // If not found in current list, try to fetch it directly
          const { data: salesOrder, error } = await supabase
            .from('sales_orders')
            .select(`
              *,
              customers (name, email),
              sales_reps (first_name, last_name, employee_code)
            `)
            .eq('id', openSOId)
            .single()
          
          if (!error && salesOrder) {
            // Clear the URL parameter
            window.history.replaceState({}, '', window.location.pathname)
            // Open the sales order for editing
            onEditSalesOrder(salesOrder)
          }
        }
      }
    }
    
    checkUrlParams()
  }, [salesOrders])

  useEffect(() => {
    let filtered = salesOrders

    // Apply search filter
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase()
      filtered = filtered.filter(so => {
        // Search in basic SO fields
        const basicMatch = 
          so.so_number?.toLowerCase().includes(lowerSearchTerm) ||
          so.customers?.name.toLowerCase().includes(lowerSearchTerm) ||
          so.customers?.email?.toLowerCase().includes(lowerSearchTerm) ||
          so.job_name?.toLowerCase().includes(lowerSearchTerm) ||
          so.reference_number?.toLowerCase().includes(lowerSearchTerm) ||
          so.estimate_number?.toLowerCase().includes(lowerSearchTerm) ||
          so.sales_reps?.first_name?.toLowerCase().includes(lowerSearchTerm) ||
          so.sales_reps?.last_name?.toLowerCase().includes(lowerSearchTerm) ||
          so.sales_reps?.employee_code?.toLowerCase().includes(lowerSearchTerm) ||
          so.memo?.toLowerCase().includes(lowerSearchTerm)
        
        // Search in amounts (supports various formats: 8024, 8,024, 8024.00, etc.)
        const amountMatch = 
          matchesAmount(so.total_amount, searchTerm) ||
          matchesAmount(so.subtotal, searchTerm) ||
          matchesAmount(so.tax_amount, searchTerm) ||
          matchesAmount(so.discount_amount, searchTerm)
        
        // Search in line items
        const lineItemMatch = so.sales_order_lines?.some(line => 
          line.item_code?.toLowerCase().includes(lowerSearchTerm) ||
          line.description?.toLowerCase().includes(lowerSearchTerm) ||
          line.products?.name?.toLowerCase().includes(lowerSearchTerm) ||
          line.products?.sku?.toLowerCase().includes(lowerSearchTerm) ||
          matchesAmount(line.amount, searchTerm) ||
          matchesAmount(line.unit_price, searchTerm)
        )
        
        return basicMatch || amountMatch || lineItemMatch
      })
    }

    // Apply status filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PARTIAL') {
        // Special filter for partial invoicing status
        filtered = filtered.filter(so => getInvoiceStatus(so) === 'PARTIAL')
      } else {
        filtered = filtered.filter(so => so.status === statusFilter)
      }
    }

    setFilteredSalesOrders(filtered)
  }, [salesOrders, searchTerm, statusFilter])

  const fetchSalesOrders = async () => {
    try {
      console.log('Fetching sales orders from database...')
      
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers (name, email),
          sales_reps (first_name, last_name, employee_code),
          sales_order_lines (
            item_code,
            description,
            product_id,
            quantity,
            qty_invoiced,
            qty_remaining,
            fulfillment_status,
            products (
              name,
              sku
            )
          )
        `)
        .order('order_date', { ascending: false })

      if (error) {
        console.error('Error fetching sales orders:', error)
        console.error('Fetch error details:', JSON.stringify(error, null, 2))
        setSalesOrders([])
      } else {
        console.log('Fetched sales orders from database:', data?.length || 0, 'records')
        console.log('Sales orders data:', data)
        setSalesOrders(data || [])
      }
    } catch (error) {
      console.error('Error fetching sales orders:', error)
      setSalesOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchSalesOrders()
    setIsRefreshing(false)
  }

  const handleViewEdit = (salesOrder: SalesOrder) => {
    onEditSalesOrder(salesOrder)
  }

  const handleDuplicate = async (salesOrder: SalesOrder) => {
    try {
      // Generate new SO number - fetch from database to ensure uniqueness
      const { data: existingSOs, error: fetchError } = await supabase
        .from('sales_orders')
        .select('so_number')
        .order('so_number', { ascending: false })
        .limit(1)

      if (fetchError) {
        console.error('Error fetching existing SO numbers:', fetchError)
      }

      // Get the highest existing SO number from the database
      let lastNum = 0
      if (existingSOs && existingSOs.length > 0) {
        const lastSOFromDB = existingSOs[0].so_number
        if (lastSOFromDB && lastSOFromDB.match(/^SO-\d{6}$/)) {
          lastNum = parseInt(lastSOFromDB.split('-')[1])
        }
      }

      // Also check the current salesOrders array in case of recent additions
      const lastSOFromArray = salesOrders
        .map(so => so.so_number)
        .filter(num => num?.match(/^SO-\d{6}$/))
        .sort()
        .pop()

      if (lastSOFromArray) {
        const arrayNum = parseInt(lastSOFromArray.split('-')[1])
        lastNum = Math.max(lastNum, arrayNum)
      }

      const newSONumber = `SO-${String(lastNum + 1).padStart(6, '0')}`

      // Start with minimal required fields only
      const duplicateData = {
        so_number: newSONumber,
        customer_id: salesOrder.customer_id,
        status: 'PENDING' as const, // Not confirmed
        order_date: new Date().toISOString().split('T')[0], // Today's date
        subtotal: salesOrder.subtotal || 0,
        tax_rate: salesOrder.tax_rate || 0,
        tax_amount: salesOrder.tax_amount || 0,
        total_amount: salesOrder.total_amount || 0
      }

      const { data: newSalesOrder, error } = await supabase
        .from('sales_orders')
        .insert(duplicateData)
        .select(`
          *,
          customers (name, email),
          sales_reps (first_name, last_name, employee_code)
        `)
        .single()

      if (error) throw error

      setSalesOrders(prev => [newSalesOrder, ...prev])
      
      // Also copy line items if they exist
      const { data: lines } = await supabase
        .from('sales_order_lines')
        .select('*')
        .eq('sales_order_id', salesOrder.id)

      if (lines && lines.length > 0) {
        const newLines = lines.map(line => ({
          ...line,
          id: undefined,
          sales_order_id: newSalesOrder.id,
          fulfillment_status: 'pending' as const
        }))

        await supabase
          .from('sales_order_lines')
          .insert(newLines)
      }

      // Navigate to the duplicated sales order for editing
      setTimeout(() => {
        onEditSalesOrder(newSalesOrder)
      }, 100)

      console.log('Sales order duplicated successfully')
    } catch (error) {
      console.error('Error duplicating sales order:', error)
    }
  }

  const handleDelete = async (salesOrder: SalesOrder) => {
    if (!confirm(`Are you sure you want to delete sales order ${salesOrder.so_number}?`)) {
      return
    }

    try {
      console.log('Attempting to delete sales order:', salesOrder.id, salesOrder.so_number)
      
      // First, clear any estimate references to this sales order
      if (salesOrder.estimate_id) {
        const { error: estError } = await supabase
          .from('estimates')
          .update({ converted_to_sales_order_id: null })
          .eq('converted_to_sales_order_id', salesOrder.id)

        if (estError) {
          console.error('Error clearing estimate references:', estError)
          // Continue with deletion even if this fails
        }
      }

      // Clear any purchase order references to this sales order
      if (salesOrder.converted_to_purchase_order_id) {
        const { error: poError } = await supabase
          .from('purchase_orders')
          .update({ source_sales_order_id: null })
          .eq('source_sales_order_id', salesOrder.id)

        if (poError) {
          console.error('Error clearing purchase order references:', poError)
          // Continue with deletion even if this fails
        }
      }
      
      // Then delete any related sales order lines (they should cascade, but let's be explicit)
      const { error: linesError } = await supabase
        .from('sales_order_lines')
        .delete()
        .eq('sales_order_id', salesOrder.id)
      
      if (linesError) {
        console.error('Error deleting sales order lines:', linesError)
        // Don't throw here, try to continue with sales order deletion
      } else {
        console.log('Deleted related sales order lines')
      }
      
      // Finally delete the sales order
      const { data: deletedData, error } = await supabase
        .from('sales_orders')
        .delete()
        .eq('id', salesOrder.id)
        .select()

      if (error) {
        console.error('Supabase delete error:', error)
        throw error
      }

      console.log('Delete response data:', deletedData)
      
      // Verify the deletion by trying to fetch the deleted record
      const { data: verifyData, error: verifyError } = await supabase
        .from('sales_orders')
        .select('id')
        .eq('id', salesOrder.id)
        .single()
      
      if (verifyError && verifyError.code === 'PGRST116') {
        // Record not found - deletion was successful
        console.log('Deletion verified - record no longer exists in database')
        setSalesOrders(prev => prev.filter(so => so.id !== salesOrder.id))
        console.log('Sales order deleted successfully from database and local state')
      } else if (verifyData) {
        // Record still exists - deletion failed
        console.error('Deletion failed - record still exists in database')
        alert('Failed to delete sales order - it may be referenced by other records')
      } else {
        console.error('Verification error:', verifyError)
      }
    } catch (error) {
      console.error('Error deleting sales order:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      alert(`Error deleting sales order: ${error.message || 'Unknown error'}`)
    }
  }

  const handleEmail = async (salesOrder: SalesOrder) => {
    // TODO: Implement email functionality
    console.log('Email sales order:', salesOrder.so_number)
  }

  // Calculate fulfillment percentage for a sales order
  const calculateFulfillmentPercentage = (salesOrder: SalesOrder): number => {
    if (!salesOrder.sales_order_lines || salesOrder.sales_order_lines.length === 0) {
      return 0
    }
    
    const totalQuantity = salesOrder.sales_order_lines.reduce((sum, line) => sum + (line.quantity || 0), 0)
    const invoicedQuantity = salesOrder.sales_order_lines.reduce((sum, line) => sum + (line.qty_invoiced || 0), 0)
    
    if (totalQuantity === 0) return 0
    
    return Math.round((invoicedQuantity / totalQuantity) * 100)
  }

  // Determine if sales order has any partial invoicing
  const getInvoiceStatus = (salesOrder: SalesOrder): 'NONE' | 'PARTIAL' | 'COMPLETE' => {
    if (!salesOrder.sales_order_lines || salesOrder.sales_order_lines.length === 0) {
      return 'NONE'
    }
    
    const hasInvoiced = salesOrder.sales_order_lines.some(line => (line.qty_invoiced || 0) > 0)
    const allComplete = salesOrder.sales_order_lines.every(line => line.fulfillment_status === 'complete')
    
    if (!hasInvoiced) return 'NONE'
    if (allComplete) return 'COMPLETE'
    return 'PARTIAL'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800'
      case 'IN_PROGRESS': return 'bg-purple-100 text-purple-800'
      case 'SHIPPED': return 'bg-indigo-100 text-indigo-800'
      case 'DELIVERED': return 'bg-green-100 text-green-800'
      case 'INVOICED': return 'bg-gray-100 text-gray-800'
      case 'PARTIAL': return 'bg-orange-100 text-orange-800' // New status for partial invoicing
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      case 'ON_HOLD': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Orders</h1>
          <p className="text-gray-600">Manage your customer sales orders</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={onCreateSalesOrder}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Sales Order
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search sales orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="INVOICED">Invoiced</option>
                <option value="PARTIAL">Partial Invoicing</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Orders List */}
      <div className="space-y-4">
        {filteredSalesOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sales orders found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'ALL' 
                  ? 'No sales orders match your current filters.'
                  : 'Get started by creating your first sales order.'
                }
              </p>
              {(!searchTerm && statusFilter === 'ALL') && (
                <Button onClick={onCreateSalesOrder} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Sales Order
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredSalesOrders.map((salesOrder) => (
            <Card key={salesOrder.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <ContextMenu
                  options={[
                    {
                      id: 'view',
                      label: 'View Details',
                      icon: <Eye className="w-4 h-4" />,
                      onClick: () => handleViewEdit(salesOrder)
                    },
                    {
                      id: 'edit',
                      label: 'Edit',
                      icon: <Edit className="w-4 h-4" />,
                      onClick: () => handleViewEdit(salesOrder)
                    },
                    {
                      id: 'email',
                      label: 'Email',
                      icon: <Mail className="w-4 h-4" />,
                      onClick: () => handleEmail(salesOrder)
                    },
                    {
                      id: 'duplicate',
                      label: 'Duplicate',
                      icon: <Copy className="w-4 h-4" />,
                      onClick: () => handleDuplicate(salesOrder)
                    },
                    {
                      id: 'separator',
                      label: '',
                      onClick: () => {},
                      separator: true
                    },
                    {
                      id: 'delete',
                      label: 'Delete',
                      icon: <Trash2 className="w-4 h-4" />,
                      onClick: () => handleDelete(salesOrder)
                    }
                  ]}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {salesOrder.so_number}
                        </h3>
                        <Badge className={getStatusColor(salesOrder.status)}>
                          {salesOrder.status.replace('_', ' ')}
                        </Badge>
                        {/* Fulfillment Status Badge */}
                        {(() => {
                          const invoiceStatus = getInvoiceStatus(salesOrder)
                          const fulfillmentPercentage = calculateFulfillmentPercentage(salesOrder)
                          
                          if (invoiceStatus === 'PARTIAL') {
                            return (
                              <Badge className="bg-orange-100 text-orange-800">
                                {fulfillmentPercentage}% Invoiced
                              </Badge>
                            )
                          } else if (invoiceStatus === 'COMPLETE') {
                            return (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Fully Invoiced
                              </Badge>
                            )
                          }
                          return null
                        })()}
                        {salesOrder.estimate_number && (
                          <Badge className="bg-blue-100 text-blue-800">
                            From {salesOrder.estimate_number}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Customer</p>
                          <p className="font-medium">{salesOrder.customers?.name || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Sales Rep</p>
                          <p className="font-medium">
                            {salesOrder.sales_reps 
                              ? `${salesOrder.sales_reps.first_name} ${salesOrder.sales_reps.last_name}`
                              : 'Unassigned'
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Order Date</p>
                          <p className="font-medium">
                            {new Date(salesOrder.order_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Total</p>
                          <p className="font-medium text-lg">
                            {formatCurrency(salesOrder.total_amount)}
                          </p>
                        </div>
                      </div>

                      {/* Fulfillment Status Details for Invoiced Orders */}
                      {getInvoiceStatus(salesOrder) !== 'NONE' && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-700">Invoice Fulfillment</h4>
                            <Badge className={`text-xs ${
                              getInvoiceStatus(salesOrder) === 'COMPLETE' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {calculateFulfillmentPercentage(salesOrder)}% Complete
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="text-gray-500">Lines Fulfilled</p>
                              <p className="font-medium">
                                {salesOrder.sales_order_lines?.filter(line => line.fulfillment_status === 'complete').length || 0} of {salesOrder.sales_order_lines?.length || 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Status</p>
                              <p className="font-medium capitalize">
                                {getInvoiceStatus(salesOrder) === 'COMPLETE' ? 'Fully Invoiced' : 
                                 getInvoiceStatus(salesOrder) === 'PARTIAL' ? 'Partially Invoiced' : 'Not Invoiced'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {salesOrder.job_name && (
                        <div className="mt-2">
                          <p className="text-gray-500 text-sm">Job Name</p>
                          <p className="font-medium">{salesOrder.job_name}</p>
                        </div>
                      )}

                      {salesOrder.ship_date && (
                        <div className="mt-2">
                          <p className="text-gray-500 text-sm">Ship Date</p>
                          <p className="font-medium">
                            {new Date(salesOrder.ship_date).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEdit(salesOrder)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(salesOrder)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </ContextMenu>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}