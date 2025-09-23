'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Package, CheckCircle, AlertTriangle, Truck, Calendar, Hash, Save, Search, Building2, DollarSign, Clock } from 'lucide-react'

type PurchaseOrder = any & {
  vendors?: { company_name: string }
  purchase_order_lines?: PurchaseOrderLine[]
}

type PurchaseOrderLine = any & {
  products?: { name: string; sku: string }
}

type InventoryReceipt = any & {
  products?: { name: string; sku: string }
  purchase_order_lines?: {
    purchase_orders?: { po_number: string }
  }
}

interface CreateReceivingProps {
  receipt?: InventoryReceipt | null
  preSelectedPO?: PurchaseOrder | null
  onBack: () => void
  onSuccess: () => void
}

interface ReceivingLine {
  id: string
  po_line_id: string
  po_number: string
  product_id: string
  product_name: string
  product_sku: string
  qty_ordered: number
  qty_received: number
  qty_to_receive: number
  unit_price: number
  line_total: number
}

export default function CreateReceiving({ receipt, preSelectedPO, onBack, onSuccess }: CreateReceivingProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [selectedPOs, setSelectedPOs] = useState<string[]>([])
  const [receivingLines, setReceivingLines] = useState<ReceivingLine[]>([])
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0])
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingLines, setIsLoadingLines] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const isEditMode = !!receipt

  useEffect(() => {
    if (isEditMode && receipt) {
      // Load existing receipt data for editing
      setReceiveDate(receipt.receive_date)
      setReferenceNumber(receipt.reference_number || '')
      setNotes(receipt.notes || '')
      
      // Create a receiving line from the receipt
      const line: ReceivingLine = {
        id: receipt.id,
        po_line_id: receipt.po_line_id || '',
        po_number: receipt.purchase_order_lines?.purchase_orders?.po_number || '',
        product_id: receipt.product_id,
        product_name: receipt.products?.name || '',
        product_sku: receipt.products?.sku || '',
        qty_ordered: 0, // We'll need to fetch this
        qty_received: 0, // Previous receipts
        qty_to_receive: receipt.qty_received || 0,
        unit_price: 0, // We'll need to fetch this
        line_total: 0
      }
      setReceivingLines([line])
    } else if (preSelectedPO) {
      // Pre-selected PO mode - set up for immediate receiving
      console.log('Pre-selected PO mode:', preSelectedPO)
      setPurchaseOrders([preSelectedPO])
      setSelectedPOs([preSelectedPO.id])
      // Load lines will be triggered by the other useEffect
    } else {
      // Create mode - fetch available POs
      fetchPurchaseOrders()
    }
  }, [isEditMode, receipt, preSelectedPO])

  useEffect(() => {
    if (!isEditMode && selectedPOs.length > 0 && purchaseOrders.length > 0) {
      loadPOLines()
    } else if (!isEditMode && selectedPOs.length === 0) {
      setReceivingLines([])
    }
  }, [selectedPOs, purchaseOrders, isEditMode])

  const fetchPurchaseOrders = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (company_name),
          purchase_order_lines (
            *,
            products (name, sku)
          )
        `)
        .in('status', ['CONFIRMED', 'PARTIAL'])
        .order('order_date', { ascending: false })

      if (error) throw error
      setPurchaseOrders(data || [])
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPOLines = async () => {
    setIsLoadingLines(true)
    try {
      const lines: ReceivingLine[] = []
      
      for (const poId of selectedPOs) {
        const po = purchaseOrders.find(p => p.id === poId)
        if (!po) continue

        // Fetch full PO data with lines
        const { data: fullPO, error } = await supabase
          .from('purchase_orders')
          .select(`
            *,
            vendors (company_name),
            purchase_order_lines (
              *,
              products (name, sku)
            )
          `)
          .eq('id', poId)
          .single()

        if (error || !fullPO.purchase_order_lines) continue

        for (const line of fullPO.purchase_order_lines) {
          if (!line.product_id) continue

          // Calculate already received quantity
          const { data: previousReceipts } = await supabase
            .from('inventory_receipts')
            .select('qty_received')
            .eq('po_line_id', line.id)

          const totalReceived = previousReceipts?.reduce((sum, r) => sum + (r.qty_received || 0), 0) || 0
          const remainingQty = (line.quantity || 0) - totalReceived

          // Include all items, even if fully received (but with 0 to receive)
          lines.push({
            id: `${poId}-${line.id}`,
            po_line_id: line.id,
            po_number: fullPO.po_number || '',
            product_id: line.product_id,
            product_name: line.products?.name || '',
            product_sku: line.products?.sku || '',
            qty_ordered: line.quantity || 0,
            qty_received: totalReceived,
            qty_to_receive: Math.max(0, remainingQty),
            unit_price: line.unit_price || 0,
            line_total: Math.max(0, remainingQty) * (line.unit_price || 0)
          })
        }
      }

      setReceivingLines(lines)
    } catch (error) {
      console.error('Error loading PO lines:', error)
    } finally {
      setIsLoadingLines(false)
    }
  }

  const handleQtyChange = (lineId: string, newQty: number) => {
    setReceivingLines(prev => prev.map(line => {
      if (line.id === lineId) {
        const qty = Math.max(0, Math.min(newQty, line.qty_ordered - line.qty_received))
        return {
          ...line,
          qty_to_receive: qty,
          line_total: qty * line.unit_price
        }
      }
      return line
    }))
  }

  const handleReceiveAll = () => {
    setReceivingLines(prev => prev.map(line => ({
      ...line,
      qty_to_receive: line.qty_ordered - line.qty_received,
      line_total: (line.qty_ordered - line.qty_received) * line.unit_price
    })))
  }

  const handleSave = async () => {
    if (isEditMode) {
      await handleUpdateReceipt()
    } else {
      await handleCreateReceipts()
    }
  }

  const handleUpdateReceipt = async () => {
    if (!receipt || receivingLines.length === 0) return

    const line = receivingLines[0]
    if (line.qty_to_receive <= 0) {
      alert('Please enter a quantity to receive')
      return
    }

    setIsSaving(true)
    try {
      // Calculate the difference in quantity
      const oldQty = receipt.qty_received || 0
      const newQty = line.qty_to_receive
      const qtyDiff = newQty - oldQty

      // Update the receipt
      const { error: updateError } = await supabase
        .from('inventory_receipts')
        .update({
          qty_received: newQty,
          receive_date: receiveDate,
          reference_number: referenceNumber || null,
          notes: notes || null
        })
        .eq('id', receipt.id)

      if (updateError) throw updateError

      // Update inventory quantity
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', receipt.product_id)
        .single()

      if (inventory) {
        const { error: invError } = await supabase
          .from('inventory')
          .update({
            quantity_on_hand: (inventory.quantity_on_hand || 0) + qtyDiff
          })
          .eq('id', inventory.id)

        if (invError) throw invError
      }

      alert('Receipt updated successfully!')
      onSuccess()
    } catch (error) {
      console.error('Error updating receipt:', error)
      alert('Failed to update receipt. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateReceipts = async () => {
    if (receivingLines.filter(l => l.qty_to_receive > 0).length === 0) {
      alert('Please enter quantities to receive')
      return
    }

    setIsSaving(true)
    try {
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError

      // Process each receiving line
      for (const line of receivingLines) {
        if (line.qty_to_receive === 0) continue

        // Create inventory receipt record
        const { error: receiptError } = await supabase
          .from('inventory_receipts')
          .insert({
            po_line_id: line.po_line_id,
            product_id: line.product_id,
            qty_received: line.qty_to_receive,
            receive_date: receiveDate,
            reference_number: referenceNumber || null,
            notes: notes || null,
            received_by: userData?.user?.id
          })

        if (receiptError) throw receiptError

        // Update inventory quantity
        const { data: existingInventory, error: invSelectError } = await supabase
          .from('inventory')
          .select('*')
          .eq('product_id', line.product_id)
          .single()

        if (invSelectError && invSelectError.code !== 'PGRST116') {
          throw invSelectError
        }

        if (existingInventory) {
          // Update existing inventory
          const { error: invError } = await supabase
            .from('inventory')
            .update({
              quantity_on_hand: (existingInventory.quantity_on_hand || 0) + line.qty_to_receive
            })
            .eq('id', existingInventory.id)

          if (invError) throw invError
        } else {
          // Create new inventory record
          const { error: invError } = await supabase
            .from('inventory')
            .insert({
              product_id: line.product_id,
              quantity_on_hand: line.qty_to_receive,
              quantity_allocated: 0,
              reorder_point: 0,
              reorder_quantity: 0
            })

          if (invError) throw invError
        }
      }

      // Update PO statuses
      await updatePOStatuses()

      alert('Inventory received successfully!')
      onSuccess()
    } catch (error) {
      console.error('Error receiving inventory:', error)
      alert('Failed to receive inventory. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const updatePOStatuses = async () => {
    const processedPOs = new Set<string>()

    for (const line of receivingLines) {
      if (line.qty_to_receive === 0) continue

      // Get PO ID from the line
      const { data: poLine } = await supabase
        .from('purchase_order_lines')
        .select('purchase_order_id')
        .eq('id', line.po_line_id)
        .single()

      if (!poLine || processedPOs.has(poLine.purchase_order_id)) continue
      processedPOs.add(poLine.purchase_order_id)

      // Calculate total ordered and received for this PO
      const { data: allLines } = await supabase
        .from('purchase_order_lines')
        .select('quantity')
        .eq('purchase_order_id', poLine.purchase_order_id)

      const { data: allReceipts } = await supabase
        .from('inventory_receipts')
        .select('qty_received, purchase_order_lines!inner(purchase_order_id)')
        .eq('purchase_order_lines.purchase_order_id', poLine.purchase_order_id)

      const totalOrdered = allLines?.reduce((sum, l) => sum + (l.quantity || 0), 0) || 0
      const totalReceived = allReceipts?.reduce((sum, r) => sum + (r.qty_received || 0), 0) || 0

      const newStatus = totalReceived >= totalOrdered ? 'RECEIVED' : 
                       totalReceived > 0 ? 'PARTIAL' : 'CONFIRMED'

      await supabase
        .from('purchase_orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', poLine.purchase_order_id)
    }
  }

  const totalValue = receivingLines.reduce((sum, line) => sum + line.line_total, 0)
  const totalItems = receivingLines.reduce((sum, line) => sum + line.qty_to_receive, 0)

  // Filter purchase orders based on search query
  const filteredPurchaseOrders = purchaseOrders.filter(po => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    
    // Search in basic PO fields
    const basicMatch = (
      po.po_number?.toLowerCase().includes(query) ||
      po.vendors?.company_name?.toLowerCase().includes(query) ||
      po.vendor_reference?.toLowerCase().includes(query)
    )
    
    // Search in line item SKUs and product names
    const lineItemMatch = po.purchase_order_lines?.some((line: any) =>
      line.products?.sku?.toLowerCase().includes(query) ||
      line.products?.name?.toLowerCase().includes(query)
    )
    
    return basicMatch || lineItemMatch
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Receipts
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? 'Edit Receipt' : 'Receive Inventory'}
            </h1>
            <p className="text-gray-600">
              {isEditMode ? 'Modify an existing inventory receipt' : 'Create new inventory receipts from purchase orders'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-800">
            {totalItems} items | {formatCurrency(totalValue)}
          </Badge>
        </div>
      </div>

      {/* PO Selection - Only in create mode */}
      {!isEditMode && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {preSelectedPO ? 'Purchase Order' : 'Select Purchase Orders'}
          </h3>
          {preSelectedPO ? (
            /* Show the preselected PO as read-only */
            <div className="border rounded-lg p-3 bg-blue-50">
              <div className="flex items-center gap-3 p-3">
                <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded"></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{preSelectedPO.po_number}</span>
                    <Badge className={preSelectedPO.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}>
                      {preSelectedPO.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {preSelectedPO.vendors?.company_name} • {formatDate(preSelectedPO.order_date)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatCurrency(preSelectedPO.total_amount || 0)}</div>
                  <div className="text-xs text-gray-500">
                    {preSelectedPO.purchase_order_lines?.length || 0} items
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Multiple PO selection for normal create mode */
            <div className="border rounded-lg">
              {/* Search bar */}
              <div className="p-3 border-b bg-gray-50">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search by PO number, vendor, reference, SKU, or product name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-8 text-sm"
                  />
                </div>
              </div>
              
              {/* PO List */}
              <div className="max-h-80 overflow-auto">
                {isLoading ? (
                  <div className="text-center py-6 text-gray-500">Loading purchase orders...</div>
                ) : filteredPurchaseOrders.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    {searchQuery ? 'No purchase orders match your search' : 'No purchase orders ready to receive'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredPurchaseOrders.map(po => {
                      const daysOld = po.order_date ? Math.floor((new Date().getTime() - new Date(po.order_date).getTime()) / (1000 * 60 * 60 * 24)) : 0
                      const hasReference = po.vendor_reference && po.vendor_reference.trim() !== ''
                      const isOverdue = po.expected_delivery_date && new Date(po.expected_delivery_date) < new Date()
                      
                      // Check if this PO was matched by SKU/product search
                      const query = searchQuery.toLowerCase()
                      const matchedBySKU = searchQuery && po.purchase_order_lines?.some((line: any) =>
                        line.products?.sku?.toLowerCase().includes(query) ||
                        line.products?.name?.toLowerCase().includes(query)
                      )
                      const matchedProducts = searchQuery ? po.purchase_order_lines?.filter((line: any) =>
                        line.products?.sku?.toLowerCase().includes(query) ||
                        line.products?.name?.toLowerCase().includes(query)
                      ) : []
                      
                      return (
                        <label key={po.id} className="flex items-center gap-3 p-4 hover:bg-blue-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedPOs.includes(po.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPOs(prev => [...prev, po.id])
                              } else {
                                setSelectedPOs(prev => prev.filter(id => id !== po.id))
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          
                          <div className="flex-1 min-w-0">
                            {/* Header row with PO number and status */}
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-900">{po.po_number}</span>
                              <Badge className={po.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}>
                                {po.status}
                              </Badge>
                              {daysOld > 30 && (
                                <Badge className="bg-orange-100 text-orange-800">
                                  {daysOld}d old
                                </Badge>
                              )}
                              {isOverdue && (
                                <Badge className="bg-red-100 text-red-800">
                                  Overdue
                                </Badge>
                              )}
                            </div>
                            
                            {/* Vendor and reference */}
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                              <div className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                <span className="truncate">{po.vendors?.company_name || 'Unknown Vendor'}</span>
                              </div>
                              {hasReference && (
                                <div className="flex items-center gap-1">
                                  <Hash className="w-3 h-3" />
                                  <span className="truncate">Ref: {po.vendor_reference}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Date and expected delivery */}
                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-1">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>Ordered {formatDate(po.order_date)}</span>
                              </div>
                              {po.expected_delivery_date && (
                                <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
                                  <Truck className="w-3 h-3" />
                                  <span>Expected {formatDate(po.expected_delivery_date)}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Show matched products when search finds SKUs */}
                            {matchedBySKU && matchedProducts && matchedProducts.length > 0 && (
                              <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                                <div className="font-medium text-green-800 mb-1">
                                  Contains searched items:
                                </div>
                                <div className="space-y-1">
                                  {matchedProducts.slice(0, 3).map((line: any, idx: number) => (
                                    <div key={idx} className="text-green-700">
                                      <span className="font-medium">{line.products?.sku}</span>
                                      {line.products?.name && (
                                        <span className="text-green-600"> - {line.products.name}</span>
                                      )}
                                    </div>
                                  ))}
                                  {matchedProducts.length > 3 && (
                                    <div className="text-green-600">
                                      +{matchedProducts.length - 3} more items...
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Right side - Amount and items */}
                          <div className="text-right flex-shrink-0">
                            <div className="flex items-center gap-1 justify-end text-lg font-semibold text-gray-900 mb-1">
                              <DollarSign className="w-4 h-4" />
                              <span>{formatCurrency(po.total_amount || 0)}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {po.purchase_order_lines?.length || 0} line items
                            </div>
                            {po.terms && (
                              <div className="text-xs text-gray-500 mt-1">
                                Terms: {po.terms}
                              </div>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Receiving Details */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Receiving Details</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Receive Date
            </label>
            <Input
              type="date"
              value={receiveDate}
              onChange={(e) => setReceiveDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Hash className="w-4 h-4 inline mr-1" />
              Reference Number (Optional)
            </label>
            <Input
              placeholder="e.g., Packing slip #"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <Input
              placeholder="Any notes about this receipt"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      {isLoadingLines ? (
        <div className="text-center py-8 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-pulse" />
          <p>Loading items to receive...</p>
        </div>
      ) : receivingLines.length > 0 ? (
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Items to Receive</h3>
              {!isEditMode && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReceiveAll}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Receive All
                </Button>
              )}
            </div>
          </div>
          
          <div className="overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ordered</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Previously Received</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">To Receive</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {receivingLines.map(line => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{line.po_number}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{line.product_name}</div>
                      <div className="text-xs text-gray-500">{line.product_sku}</div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm">{line.qty_ordered}</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">{line.qty_received}</td>
                    <td className="px-6 py-4 text-center">
                      <Input
                        type="number"
                        min="0"
                        max={line.qty_ordered - line.qty_received}
                        value={line.qty_to_receive}
                        onChange={(e) => handleQtyChange(line.id, parseInt(e.target.value) || 0)}
                        className="w-20 text-center"
                      />
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      {formatCurrency(line.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-sm font-medium text-gray-700">Total</td>
                  <td className="px-6 py-4 text-center text-sm font-bold">{totalItems}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold">{formatCurrency(totalValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>
            {isEditMode 
              ? 'No items available for this receipt'
              : selectedPOs.length === 0 
                ? 'Select purchase orders to begin receiving inventory'
                : 'No items available to receive from selected purchase orders'
            }
          </p>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span>
            {isEditMode 
              ? 'Editing will update inventory quantities and PO status'
              : 'Receiving will update inventory quantities and PO status'
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || receivingLines.filter(l => l.qty_to_receive > 0).length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving 
              ? (isEditMode ? 'Updating...' : 'Receiving...') 
              : (isEditMode ? 'Update Receipt' : 'Receive Inventory')
            }
          </Button>
        </div>
      </div>
    </div>
  )
}