'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Eye, Edit, Trash2, Package, Calendar, User, Hash, FileText, RefreshCw } from 'lucide-react'
import ContextMenu from '@/components/ui/context-menu'

type InventoryReceipt = any & {
  products?: { name: string; sku: string }
  purchase_order_lines?: {
    purchase_orders?: { po_number: string }
  }
  users?: { email: string }
}

interface ReceivingListProps {
  onCreateReceipt: () => void
  onEditReceipt: (receipt: InventoryReceipt) => void
}

export default function ReceivingList({
  onCreateReceipt,
  onEditReceipt
}: ReceivingListProps) {
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([])
  const [filteredReceipts, setFilteredReceipts] = useState<InventoryReceipt[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<string>('ALL')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDateRange, setShowCustomDateRange] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    fetchReceipts()
  }, [])

  useEffect(() => {
    let filtered = receipts

    // Apply search filter
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase()
      filtered = filtered.filter(receipt => 
        receipt.products?.name.toLowerCase().includes(lowerSearchTerm) ||
        receipt.products?.sku.toLowerCase().includes(lowerSearchTerm) ||
        receipt.purchase_order_lines?.purchase_orders?.po_number?.toLowerCase().includes(lowerSearchTerm) ||
        receipt.reference_number?.toLowerCase().includes(lowerSearchTerm) ||
        receipt.receipt_number?.toLowerCase().includes(lowerSearchTerm) ||
        receipt.notes?.toLowerCase().includes(lowerSearchTerm)
      )
    }

    // Apply date filter
    if (dateFilter !== 'ALL') {
      if (dateFilter === 'CUSTOM') {
        // Custom date range filter
        if (customStartDate || customEndDate) {
          filtered = filtered.filter(receipt => {
            const receiptDate = new Date(receipt.receive_date)
            receiptDate.setHours(0, 0, 0, 0)
            
            let inRange = true
            
            if (customStartDate) {
              const startDate = new Date(customStartDate)
              startDate.setHours(0, 0, 0, 0)
              inRange = inRange && receiptDate >= startDate
            }
            
            if (customEndDate) {
              const endDate = new Date(customEndDate)
              endDate.setHours(23, 59, 59, 999)
              inRange = inRange && receiptDate <= endDate
            }
            
            return inRange
          })
        }
      } else {
        // Predefined date filters
        const today = new Date()
        const filterDate = new Date()
        
        switch (dateFilter) {
          case 'TODAY':
            filterDate.setHours(0, 0, 0, 0)
            filtered = filtered.filter(receipt => 
              new Date(receipt.receive_date).getTime() >= filterDate.getTime()
            )
            break
          case 'WEEK':
            filterDate.setDate(today.getDate() - 7)
            filtered = filtered.filter(receipt => 
              new Date(receipt.receive_date).getTime() >= filterDate.getTime()
            )
            break
          case 'MONTH':
            filterDate.setMonth(today.getMonth() - 1)
            filtered = filtered.filter(receipt => 
              new Date(receipt.receive_date).getTime() >= filterDate.getTime()
            )
            break
        }
      }
    }

    setFilteredReceipts(filtered)
  }, [receipts, searchTerm, dateFilter, customStartDate, customEndDate])

  const fetchReceipts = async () => {
    try {
      console.log('Fetching inventory receipts...')
      
      const { data, error } = await supabase
        .from('inventory_receipts')
        .select(`
          *,
          products (name, sku),
          purchase_order_lines (
            purchase_orders (po_number)
          )
        `)
        .order('receive_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching receipts:', error)
        setReceipts([])
      } else {
        console.log('Fetched receipts:', data?.length || 0, 'records')
        setReceipts(data || [])
      }
    } catch (error) {
      console.error('Error fetching receipts:', error)
      setReceipts([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchReceipts()
    setIsRefreshing(false)
  }

  const handleDelete = async (receipt: InventoryReceipt) => {
    if (!confirm(`Are you sure you want to delete this receipt? This will reduce inventory quantities.`)) {
      return
    }

    try {
      console.log('=== Starting receipt deletion ===')
      console.log('Deleting receipt:', receipt.id, {
        product_id: receipt.product_id,
        qty_received: receipt.qty_received
      })

      // First, reduce the inventory quantity
      console.log('Checking existing inventory for product:', receipt.product_id)
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', receipt.product_id)
        .single()

      console.log('Inventory query result:', { inventory, invError })

      if (invError) {
        console.error('Error fetching inventory:', invError)
        if (invError.code === 'PGRST116') {
          console.log('No inventory record found for product, continuing with receipt deletion...')
        } else {
          alert(`Failed to check inventory: ${invError.message}`)
          return
        }
      } else if (inventory) {
        console.log('Found existing inventory:', inventory)
        const oldQuantity = inventory.quantity_on_hand || 0
        const receiptQty = receipt.qty_received || 0
        const newQuantity = Math.max(0, oldQuantity - receiptQty)
        
        console.log(`Updating inventory: ${oldQuantity} - ${receiptQty} = ${newQuantity}`)
        
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            quantity_on_hand: newQuantity
          })
          .eq('id', inventory.id)

        if (updateError) {
          console.error('Error updating inventory:', updateError)
          console.error('Update error details:', JSON.stringify(updateError, null, 2))
          alert(`Failed to update inventory quantities: ${updateError.message}`)
          return
        }
        console.log('✓ Successfully updated inventory quantity')
      }

      // Delete the receipt
      console.log('Deleting receipt from database...')
      const { error: deleteError } = await supabase
        .from('inventory_receipts')
        .delete()
        .eq('id', receipt.id)

      if (deleteError) {
        console.error('Error deleting receipt:', deleteError)
        console.error('Delete error details:', JSON.stringify(deleteError, null, 2))
        alert(`Failed to delete receipt: ${deleteError.message}`)
        return
      }
      console.log('✓ Successfully deleted receipt from database')

      // Update PO status if needed (check if this was the last receipt for the PO)
      if (receipt.po_line_id) {
        console.log('Updating PO status for line:', receipt.po_line_id)
        await updatePOStatus(receipt.po_line_id)
      }

      // Refresh the list
      console.log('Refreshing receipt list...')
      fetchReceipts()
      console.log('=== Receipt deletion completed successfully ===')
    } catch (error) {
      console.error('=== Error during receipt deletion ===')
      console.error('Error details:', error)
      alert(`Failed to delete receipt: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const updatePOStatus = async (poLineId: string) => {
    try {
      console.log('=== Updating PO status ===')
      
      // Get the PO ID from the line
      console.log('Getting PO ID for line:', poLineId)
      const { data: poLine, error: poLineError } = await supabase
        .from('purchase_order_lines')
        .select('purchase_order_id')
        .eq('id', poLineId)
        .single()

      if (poLineError) {
        console.error('Error fetching PO line:', poLineError)
        return
      }
      if (!poLine) {
        console.log('No PO line found')
        return
      }
      console.log('Found PO ID:', poLine.purchase_order_id)

      // Get all receipts for this PO
      console.log('Getting all receipts for PO:', poLine.purchase_order_id)
      const { data: allReceipts, error: receiptsError } = await supabase
        .from('inventory_receipts')
        .select('qty_received, purchase_order_lines!inner(purchase_order_id)')
        .eq('purchase_order_lines.purchase_order_id', poLine.purchase_order_id)

      if (receiptsError) {
        console.error('Error fetching receipts:', receiptsError)
        return
      }

      // Get total ordered for this PO
      console.log('Getting total ordered for PO:', poLine.purchase_order_id)
      const { data: poLines, error: linesError } = await supabase
        .from('purchase_order_lines')
        .select('quantity')
        .eq('purchase_order_id', poLine.purchase_order_id)

      if (linesError) {
        console.error('Error fetching PO lines:', linesError)
        return
      }

      const totalOrdered = poLines?.reduce((sum, line) => sum + (line.quantity || 0), 0) || 0
      const totalReceived = allReceipts?.reduce((sum, receipt) => sum + (receipt.qty_received || 0), 0) || 0

      console.log(`PO ${poLine.purchase_order_id}: Total ordered = ${totalOrdered}, Total received = ${totalReceived}`)

      const newStatus = totalReceived >= totalOrdered ? 'RECEIVED' : 
                       totalReceived > 0 ? 'PARTIAL' : 'CONFIRMED'

      console.log(`Updating PO status to: ${newStatus}`)

      const { error: statusError } = await supabase
        .from('purchase_orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', poLine.purchase_order_id)

      if (statusError) {
        console.error('Error updating PO status:', statusError)
      } else {
        console.log('✓ Successfully updated PO status')
      }

    } catch (error) {
      console.error('Error in updatePOStatus:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
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
          <h1 className="text-2xl font-bold text-gray-900">Inventory Receiving</h1>
          <p className="text-gray-600">Manage inventory receipts and receiving transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={onCreateReceipt}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Receive Inventory
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
                  placeholder="Search receipts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value)
                  setShowCustomDateRange(e.target.value === 'CUSTOM')
                  if (e.target.value !== 'CUSTOM') {
                    setCustomStartDate('')
                    setCustomEndDate('')
                  }
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="ALL">All Dates</option>
                <option value="TODAY">Today</option>
                <option value="WEEK">Last 7 Days</option>
                <option value="MONTH">Last 30 Days</option>
                <option value="CUSTOM">Custom Range</option>
              </select>
            </div>
          </div>
          
          {/* Custom Date Range Inputs */}
          {showCustomDateRange && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <label className="text-sm font-medium text-gray-700">From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomStartDate('')
                    setCustomEndDate('')
                  }}
                  className="text-gray-600"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipts List */}
      <div className="space-y-4">
        {filteredReceipts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No receipts found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || dateFilter !== 'ALL'
                  ? 'No receipts match your current filters.'
                  : 'Get started by receiving inventory from purchase orders.'}
              </p>
              {(!searchTerm && dateFilter === 'ALL') && (
                <Button onClick={onCreateReceipt} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Receive Inventory
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredReceipts.map((receipt) => (
            <Card key={receipt.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <ContextMenu
                  options={[
                    {
                      id: 'view',
                      label: 'View Details',
                      icon: <Eye className="w-4 h-4" />,
                      onClick: () => onEditReceipt(receipt)
                    },
                    {
                      id: 'edit',
                      label: 'Edit',
                      icon: <Edit className="w-4 h-4" />,
                      onClick: () => onEditReceipt(receipt)
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
                      onClick: () => handleDelete(receipt)
                    }
                  ]}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-blue-600" />
                          <span className="font-semibold text-gray-900">
                            {receipt.products?.name || 'Unknown Product'}
                          </span>
                        </div>
                        {receipt.products?.sku && (
                          <Badge variant="outline" className="text-xs">
                            {receipt.products.sku}
                          </Badge>
                        )}
                        {receipt.purchase_order_lines?.purchase_orders?.po_number && (
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            PO: {receipt.purchase_order_lines.purchase_orders.po_number}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Quantity Received</p>
                          <p className="font-medium">{receipt.qty_received}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Receive Date</p>
                          <p className="font-medium">{formatDate(receipt.receive_date)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Receipt #</p>
                          <p className="font-medium">
                            {receipt.receipt_number || 'No Number'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Received</p>
                          <p className="font-medium">{formatDate(receipt.created_at)}</p>
                        </div>
                      </div>

                      {receipt.notes && (
                        <div className="mt-3">
                          <p className="text-gray-500 text-sm">Notes</p>
                          <p className="text-sm">{receipt.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditReceipt(receipt)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(receipt)}
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