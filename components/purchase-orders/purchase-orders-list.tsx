'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { matchesAmount } from '@/lib/search-utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Eye, Edit, Mail, Copy, Trash2, ShoppingCart, Truck, Package, RefreshCw } from 'lucide-react'
import ContextMenu from '@/components/ui/context-menu'

type PurchaseOrder = any & {
  vendors?: { company_name: string; contact_name: string | null }
  purchase_order_lines?: {
    item_code: string | null
    description: string
    product_id: string | null
    products: {
      name: string
      sku: string
    } | null
  }[]
  sales_orders?: { so_number: string }
}

interface PurchaseOrdersListProps {
  onCreatePurchaseOrder: () => void
  onEditPurchaseOrder: (purchaseOrder: PurchaseOrder) => void
  purchaseOrders: PurchaseOrder[]
  setPurchaseOrders: any
}

export default function PurchaseOrdersList({ 
  onCreatePurchaseOrder, 
  onEditPurchaseOrder, 
  purchaseOrders, 
  setPurchaseOrders 
}: PurchaseOrdersListProps) {
  const router = useRouter()
  const [filteredPurchaseOrders, setFilteredPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    fetchPurchaseOrders()
    
    // Listen for duplicate purchase order events
    const handleOpenPurchaseOrder = (event: CustomEvent) => {
      const { purchaseOrder } = event.detail
      // Refresh the purchase orders list to include the new duplicate
      fetchPurchaseOrders()
      // Open the duplicate purchase order for editing
      onEditPurchaseOrder(purchaseOrder)
    }
    
    window.addEventListener('openPurchaseOrderForEdit', handleOpenPurchaseOrder as EventListener)
    
    return () => {
      window.removeEventListener('openPurchaseOrderForEdit', handleOpenPurchaseOrder as EventListener)
    }
  }, [])

  // Check URL parameters to auto-open specific purchase order
  useEffect(() => {
    const checkUrlParams = async () => {
      if (typeof window === 'undefined') return
      
      const urlParams = new URLSearchParams(window.location.search)
      const openPOId = urlParams.get('open')
      
      if (openPOId && purchaseOrders.length > 0) {
        const purchaseOrderToOpen = purchaseOrders.find(po => po.id === openPOId)
        if (purchaseOrderToOpen) {
          // Clear the URL parameter
          window.history.replaceState({}, '', window.location.pathname)
          // Open the purchase order for editing
          onEditPurchaseOrder(purchaseOrderToOpen)
        } else {
          // If not found in current list, try to fetch it directly
          const { data: purchaseOrder, error } = await supabase
            .from('purchase_orders')
            .select(`
              *,
              vendors (company_name, contact_name)
            `)
            .eq('id', openPOId)
            .single()
          
          if (!error && purchaseOrder) {
            // Clear the URL parameter
            window.history.replaceState({}, '', window.location.pathname)
            // Open the purchase order for editing
            onEditPurchaseOrder(purchaseOrder)
          }
        }
      }
    }
    
    checkUrlParams()
  }, [purchaseOrders])

  useEffect(() => {
    let filtered = purchaseOrders

    // Apply search filter
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase()
      filtered = filtered.filter(po => {
        // Search in basic PO fields
        const basicMatch = 
          po.po_number?.toLowerCase().includes(lowerSearchTerm) ||
          po.vendors?.company_name.toLowerCase().includes(lowerSearchTerm) ||
          po.vendors?.contact_name?.toLowerCase().includes(lowerSearchTerm) ||
          po.vendor_reference?.toLowerCase().includes(lowerSearchTerm) ||
          po.internal_notes?.toLowerCase().includes(lowerSearchTerm) ||
          po.vendor_notes?.toLowerCase().includes(lowerSearchTerm)
        
        // Search in amounts (supports various formats: 8024, 8,024, 8024.00, etc.)
        const amountMatch = 
          matchesAmount(po.total_amount, searchTerm) ||
          matchesAmount(po.subtotal, searchTerm) ||
          matchesAmount(po.tax_amount, searchTerm)
        
        // Search in line items
        const lineItemMatch = po.purchase_order_lines?.some((line: any) =>
          line.item_code?.toLowerCase().includes(lowerSearchTerm) ||
          line.description?.toLowerCase().includes(lowerSearchTerm) ||
          line.products?.name?.toLowerCase().includes(lowerSearchTerm) ||
          line.products?.sku?.toLowerCase().includes(lowerSearchTerm) ||
          matchesAmount(line.amount, searchTerm) ||
          matchesAmount(line.unit_cost, searchTerm)
        )
        
        return basicMatch || amountMatch || lineItemMatch
      })
    }

    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(po => po.status === statusFilter)
    }

    setFilteredPurchaseOrders(filtered)
  }, [purchaseOrders, searchTerm, statusFilter])

  const fetchPurchaseOrders = async () => {
    try {
      console.log('Fetching purchase orders from database...')
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (company_name, contact_name),
          purchase_order_lines (
            item_code,
            description,
            product_id,
            products (
              name,
              sku
            )
          ),
          sales_orders!source_sales_order_id (so_number)
        `)
        .order('order_date', { ascending: false })

      if (error) {
        console.error('Error fetching purchase orders:', error)
        console.error('Fetch error details:', JSON.stringify(error, null, 2))
        setPurchaseOrders([])
      } else {
        console.log('Fetched purchase orders from database:', data?.length || 0, 'records')
        console.log('Purchase orders data:', data)
        setPurchaseOrders(data || [])
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
      setPurchaseOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchPurchaseOrders()
    setIsRefreshing(false)
  }

  const handleViewEdit = (purchaseOrder: PurchaseOrder) => {
    onEditPurchaseOrder(purchaseOrder)
  }

  const handleDuplicate = async (purchaseOrder: PurchaseOrder) => {
    try {
      // Generate new PO number - fetch from database to ensure uniqueness
      const { data: existingPOs, error: fetchError } = await supabase
        .from('purchase_orders')
        .select('po_number')
        .order('po_number', { ascending: false })
        .limit(1)

      if (fetchError) {
        console.error('Error fetching existing PO numbers:', fetchError)
      }

      // Get the highest existing PO number from the database
      let lastNum = 0
      if (existingPOs && existingPOs.length > 0) {
        const lastPOFromDB = existingPOs[0].po_number
        if (lastPOFromDB && lastPOFromDB.match(/^PO-\d{6}$/)) {
          lastNum = parseInt(lastPOFromDB.split('-')[1])
        }
      }

      // Also check the current purchaseOrders array in case of recent additions
      const lastPOFromArray = purchaseOrders
        .map(po => po.po_number)
        .filter(num => num?.match(/^PO-\d{6}$/))
        .sort()
        .pop()

      if (lastPOFromArray) {
        const arrayNum = parseInt(lastPOFromArray.split('-')[1])
        lastNum = Math.max(lastNum, arrayNum)
      }

      const newPONumber = `PO-${String(lastNum + 1).padStart(6, '0')}`

      // Start with minimal required fields only
      const duplicateData = {
        po_number: newPONumber,
        vendor_id: purchaseOrder.vendor_id,
        status: 'PENDING' as const, // Not confirmed
        order_date: new Date().toISOString().split('T')[0], // Today's date
        subtotal: purchaseOrder.subtotal || 0,
        tax_rate: purchaseOrder.tax_rate || 0,
        tax_amount: purchaseOrder.tax_amount || 0,
        total_amount: purchaseOrder.total_amount || 0
      }

      const { data: newPurchaseOrder, error } = await supabase
        .from('purchase_orders')
        .insert(duplicateData)
        .select(`
          *,
          vendors (company_name, contact_name)
        `)
        .single()

      if (error) throw error

      setPurchaseOrders((prev: any) => [newPurchaseOrder, ...prev] as any)
      
      // Also copy line items if they exist
      const { data: lines } = await supabase
        .from('purchase_order_lines')
        .select('*')
        .eq('purchase_order_id', purchaseOrder.id)

      if (lines && lines.length > 0) {
        const newLines = lines.map(line => ({
          ...line,
          id: undefined,
          purchase_order_id: newPurchaseOrder.id
        }))

        await supabase
          .from('purchase_order_lines')
          .insert(newLines)
      }

      // Navigate to the duplicated purchase order for editing
      setTimeout(() => {
        onEditPurchaseOrder(newPurchaseOrder)
      }, 100)

      console.log('Purchase order duplicated successfully')
    } catch (error) {
      console.error('Error duplicating purchase order:', error)
    }
  }

  const handleDelete = async (purchaseOrder: PurchaseOrder) => {
    if (!confirm(`Are you sure you want to delete purchase order ${purchaseOrder.po_number}?`)) {
      return
    }

    try {
      console.log('Attempting to delete purchase order:', purchaseOrder.id, purchaseOrder.po_number)
      
      // First, clear any sales order references to this PO to avoid foreign key constraint
      if (purchaseOrder.source_sales_order_id) {
        console.log('Clearing sales order reference to this PO')
        const { error: soError } = await supabase
          .from('sales_orders')
          .update({ converted_to_purchase_order_id: null })
          .eq('converted_to_purchase_order_id', purchaseOrder.id)
        
        if (soError) {
          console.error('Error clearing sales order reference:', soError)
          // Don't throw here, but log the error
        } else {
          console.log('Cleared sales order reference to PO')
        }
      }
      
      // Then delete any related purchase order lines (they should cascade, but let's be explicit)
      const { error: linesError } = await supabase
        .from('purchase_order_lines')
        .delete()
        .eq('purchase_order_id', purchaseOrder.id)
      
      if (linesError) {
        console.error('Error deleting purchase order lines:', linesError)
        // Don't throw here, try to continue with purchase order deletion
      } else {
        console.log('Deleted related purchase order lines')
      }
      
      // Finally delete the purchase order
      const { data: deletedData, error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', purchaseOrder.id)
        .select()

      if (error) {
        console.error('Supabase delete error:', error)
        throw error
      }

      console.log('Delete response data:', deletedData)
      
      // Verify the deletion by trying to fetch the deleted record
      const { data: verifyData, error: verifyError } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('id', purchaseOrder.id)
        .single()
      
      if (verifyError && verifyError.code === 'PGRST116') {
        // Record not found - deletion was successful
        console.log('Deletion verified - record no longer exists in database')
        setPurchaseOrders((prev: any) => prev.filter((po: any) => po.id !== purchaseOrder.id) as any)
        console.log('Purchase order deleted successfully from database and local state')
      } else if (verifyData) {
        // Record still exists - deletion failed
        console.error('Deletion failed - record still exists in database')
        alert('Failed to delete purchase order - it may be referenced by other records')
      } else {
        console.error('Verification error:', verifyError)
      }
    } catch (error) {
      console.error('Error deleting purchase order:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      alert(`Error deleting purchase order: ${(error as any).message || 'Unknown error'}`)
    }
  }

  const handleEmail = async (purchaseOrder: PurchaseOrder) => {
    // TODO: Implement email functionality
    console.log('Email purchase order:', purchaseOrder.po_number)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800'
      case 'PARTIAL': return 'bg-purple-100 text-purple-800'
      case 'RECEIVED': return 'bg-green-100 text-green-800'
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
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-600">Manage your vendor purchase orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={() => router.push('/inventory?receive=true')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Package className="w-4 h-4 mr-2" />
            Receive Inventory
          </Button>
          <Button 
            onClick={onCreatePurchaseOrder}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Purchase Order
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
                  placeholder="Search purchase orders..."
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
                <option value="PARTIAL">Partial</option>
                <option value="RECEIVED">Received</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders List */}
      <div className="space-y-4">
        {filteredPurchaseOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No purchase orders found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'ALL' 
                  ? 'No purchase orders match your current filters.'
                  : 'Get started by creating your first purchase order.'
                }
              </p>
              {(!searchTerm && statusFilter === 'ALL') && (
                <Button onClick={onCreatePurchaseOrder} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Purchase Order
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredPurchaseOrders.map((purchaseOrder) => (
            <Card key={purchaseOrder.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <ContextMenu
                  options={[
                    {
                      id: 'view',
                      label: 'View Details',
                      icon: <Eye className="w-4 h-4" />,
                      onClick: () => handleViewEdit(purchaseOrder)
                    },
                    {
                      id: 'edit',
                      label: 'Edit',
                      icon: <Edit className="w-4 h-4" />,
                      onClick: () => handleViewEdit(purchaseOrder)
                    },
                    {
                      id: 'email',
                      label: 'Email',
                      icon: <Mail className="w-4 h-4" />,
                      onClick: () => handleEmail(purchaseOrder)
                    },
                    {
                      id: 'duplicate',
                      label: 'Duplicate',
                      icon: <Copy className="w-4 h-4" />,
                      onClick: () => handleDuplicate(purchaseOrder)
                    },
                    {
                      id: 'receive',
                      label: 'Receive Inventory',
                      icon: <Package className="w-4 h-4" />,
                      onClick: () => {
                        router.push(`/inventory?receive=true&po=${purchaseOrder.id}`)
                      },
                      disabled: !['CONFIRMED', 'PARTIAL'].includes(purchaseOrder.status)
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
                      onClick: () => handleDelete(purchaseOrder)
                    }
                  ]}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {purchaseOrder.po_number}
                        </h3>
                        <Badge className={getStatusColor(purchaseOrder.status)}>
                          {purchaseOrder.status.replace('_', ' ')}
                        </Badge>
                        {purchaseOrder.source_sales_order_id && (
                          <Badge className="bg-blue-100 text-blue-800">
                            From {purchaseOrder.sales_orders?.so_number || 'Sales Order'}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Vendor</p>
                          <p className="font-medium">{purchaseOrder.vendors?.company_name || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Reference</p>
                          <p className="font-medium">
                            {purchaseOrder.vendor_reference || 'No Reference'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Order Date</p>
                          <p className="font-medium">
                            {new Date(purchaseOrder.order_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Total</p>
                          <p className="font-medium text-lg">
                            {formatCurrency(purchaseOrder.total_amount || 0)}
                          </p>
                        </div>
                      </div>

                      {purchaseOrder.vendor_reference && (
                        <div className="mt-2">
                          <p className="text-gray-500 text-sm">Vendor Reference</p>
                          <p className="font-medium">{purchaseOrder.vendor_reference}</p>
                        </div>
                      )}

                      {purchaseOrder.expected_delivery_date && (
                        <div className="mt-2">
                          <p className="text-gray-500 text-sm">Expected Delivery</p>
                          <p className="font-medium">
                            {new Date(purchaseOrder.expected_delivery_date).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEdit(purchaseOrder)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(purchaseOrder)}
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