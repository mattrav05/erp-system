'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Package, CheckCircle, AlertTriangle, Truck, Calendar, Hash, Search, Building2, DollarSign, Clock } from 'lucide-react'

type PurchaseOrder = any & {
  vendors?: { company_name: string }
  purchase_order_lines?: PurchaseOrderLine[]
}

type PurchaseOrderLine = Database['public']['Tables']['purchase_order_lines']['Row'] & {
  products?: { name: string; sku: string }
}

type InventoryItem = Database['public']['Tables']['inventory']['Row']

interface ReceiveInventoryModalProps {
  isOpen: boolean
  onClose: () => void
  preSelectedPO?: PurchaseOrder | null
  onSuccess?: () => void
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

export default function ReceiveInventoryModal({ 
  isOpen, 
  onClose, 
  preSelectedPO = null,
  onSuccess 
}: ReceiveInventoryModalProps) {
  const { user } = useAuth()
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

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setReceivingLines([])
      setReferenceNumber('')
      setNotes('')
      setSearchQuery('')
      
      if (preSelectedPO) {
        // If we have a pre-selected PO, use it directly
        setPurchaseOrders([preSelectedPO])
        setSelectedPOs([preSelectedPO.id])
        // Load its lines immediately
        loadPOLinesForSinglePO(preSelectedPO)
      } else {
        // Otherwise fetch all available POs
        fetchPurchaseOrders()
        setSelectedPOs([])
      }
    }
  }, [isOpen, preSelectedPO])

  useEffect(() => {
    // Only load lines when selecting from list (not for preselected)
    if (!preSelectedPO && selectedPOs.length > 0 && purchaseOrders.length > 0) {
      loadPOLines()
    } else if (!preSelectedPO && selectedPOs.length === 0) {
      setReceivingLines([])
    }
  }, [selectedPOs, purchaseOrders])

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

  const loadPOLinesForSinglePO = async (po: PurchaseOrder) => {
    setIsLoadingLines(true)
    try {
      // Fetch full PO data with lines if not already loaded
      let fullPO = po
      if (!po.purchase_order_lines || po.purchase_order_lines.length === 0) {
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
          .eq('id', po.id)
          .single()
        
        if (error) throw error
        fullPO = data
      }

      const lines: ReceivingLine[] = []
      
      if (fullPO.purchase_order_lines) {
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
            id: `${fullPO.id}-${line.id}`,
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
    console.log('=== Starting handleSave ===')
    console.log('Receiving lines:', receivingLines)
    
    if (receivingLines.filter(l => l.qty_to_receive > 0).length === 0) {
      console.log('No quantities to receive')
      alert('Please enter quantities to receive')
      return
    }

    setIsSaving(true)
    try {
      console.log('=== Processing receiving lines ===')
      // Group lines by PO for status updates
      const poUpdates = new Map<string, { total: number, received: number }>()

      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('Error getting user:', userError)
        throw new Error(`User authentication error: ${userError.message}`)
      }
      console.log('Current user:', userData?.user?.id)

      // Process each receiving line
      for (const line of receivingLines) {
        if (line.qty_to_receive === 0) {
          console.log(`Skipping line ${line.id} - zero quantity`)
          continue
        }

        console.log(`Processing line ${line.id}:`, {
          po_line_id: line.po_line_id,
          product_id: line.product_id,
          qty_to_receive: line.qty_to_receive,
          receive_date: receiveDate
        })

        // Create inventory receipt record
        const receiptData = {
          po_line_id: line.po_line_id,
          product_id: line.product_id,
          qty_received: line.qty_to_receive,
          unit_cost: line.unit_price,
          total_cost: line.qty_to_receive * line.unit_price,
          receive_date: receiveDate,
          reference_number: referenceNumber || null,
          notes: notes || null,
          received_by: userData?.user?.id
        }
        console.log('Inserting receipt:', receiptData)

        const { error: receiptError } = await supabase
          .from('inventory_receipts')
          .insert(receiptData)

        if (receiptError) {
          console.error('Receipt insert error:', receiptError)
          throw new Error(`Failed to create receipt: ${receiptError.message}`)
        }
        console.log(`✓ Receipt created for line ${line.id}`)

        // Update inventory quantity
        console.log(`Checking inventory for product ${line.product_id}`)
        const { data: existingInventory, error: invSelectError } = await supabase
          .from('inventory')
          .select('*')
          .eq('product_id', line.product_id)
          .single()

        if (invSelectError && invSelectError.code !== 'PGRST116') {
          console.error('Error checking inventory:', invSelectError)
          throw new Error(`Failed to check inventory: ${invSelectError.message}`)
        }

        if (existingInventory) {
          console.log('Existing inventory found:', existingInventory)
          // Update existing inventory
          const newQuantity = (existingInventory.quantity_on_hand || 0) + line.qty_to_receive
          console.log(`Updating inventory: ${existingInventory.quantity_on_hand} + ${line.qty_to_receive} = ${newQuantity}`)
          
          const { error: invError } = await supabase
            .from('inventory')
            .update({
              quantity_on_hand: newQuantity
            })
            .eq('id', existingInventory.id)

          if (invError) {
            console.error('Inventory update error:', invError)
            throw new Error(`Failed to update inventory: ${invError.message}`)
          }
          console.log(`✓ Updated existing inventory for product ${line.product_id}`)
        } else {
          console.log('No existing inventory, creating new record')
          // Create new inventory record
          const newInventoryData = {
            product_id: line.product_id,
            quantity_on_hand: line.qty_to_receive,
            quantity_allocated: 0,
            reorder_point: 0,
            reorder_quantity: 0
          }
          console.log('Creating new inventory:', newInventoryData)

          const { error: invError } = await supabase
            .from('inventory')
            .insert(newInventoryData)

          if (invError) {
            console.error('Inventory create error:', invError)
            throw new Error(`Failed to create inventory: ${invError.message}`)
          }
          console.log(`✓ Created new inventory for product ${line.product_id}`)
        }

        // Track PO totals for status update
        console.log(`Looking for PO for line ${line.po_line_id}`)
        const po = purchaseOrders.find(p => p.purchase_order_lines?.some(l => l.id === line.po_line_id))
        if (po) {
          console.log(`Found PO ${po.id} for line ${line.po_line_id}`)
          if (!poUpdates.has(po.id)) {
            const totalOrdered = po.purchase_order_lines?.reduce((sum, l) => sum + (l.quantity || 0), 0) || 0
            poUpdates.set(po.id, { total: totalOrdered, received: 0 })
            console.log(`Initialized PO ${po.id} totals:`, { total: totalOrdered, received: 0 })
          }
          const current = poUpdates.get(po.id)!
          current.received += line.qty_to_receive
          console.log(`Updated PO ${po.id} received:`, current.received)
        } else {
          console.warn(`Could not find PO for line ${line.po_line_id}`)
        }
      }

      console.log('=== Updating PO statuses ===')
      console.log('PO updates:', poUpdates)

      // Update PO statuses
      for (const [poId, counts] of poUpdates.entries()) {
        console.log(`Processing PO status update for ${poId}`)
        
        // Get total received including previous receipts
        const { data: allReceipts, error: receiptsError } = await supabase
          .from('inventory_receipts')
          .select('qty_received, purchase_order_lines!inner(purchase_order_id)')
          .eq('purchase_order_lines.purchase_order_id', poId)

        if (receiptsError) {
          console.error('Error fetching receipts for PO status update:', receiptsError)
          // Don't fail the whole operation for status update errors
          continue
        }

        const totalReceived = allReceipts?.reduce((sum, r) => sum + (r.qty_received || 0), 0) || 0
        console.log(`PO ${poId}: Total received = ${totalReceived}, Total ordered = ${counts.total}`)
        
        const newStatus = totalReceived >= counts.total ? 'RECEIVED' : 
                         totalReceived > 0 ? 'PARTIAL' : 'CONFIRMED'
        console.log(`PO ${poId}: New status = ${newStatus}`)

        const { error: poError } = await supabase
          .from('purchase_orders')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', poId)

        if (poError) {
          console.error(`Error updating PO ${poId} status:`, poError)
          // Don't fail the whole operation for status update errors
        } else {
          console.log(`✓ Updated PO ${poId} status to ${newStatus}`)
        }
      }

      console.log('=== Receiving completed successfully ===')
      alert('Inventory received successfully!')
      onSuccess?.()
      handleClose()
    } catch (error) {
      console.error('=== Error receiving inventory ===')
      console.error('Error details:', error)
      alert(`Failed to receive inventory: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setSelectedPOs([])
    setReceivingLines([])
    setReferenceNumber('')
    setNotes('')
    setSearchQuery('')
    onClose()
  }

  // Filter purchase orders based on search query
  const filteredPurchaseOrders = purchaseOrders.filter(po => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      po.po_number?.toLowerCase().includes(query) ||
      po.vendors?.company_name?.toLowerCase().includes(query) ||
      po.vendor_reference?.toLowerCase().includes(query)
    )
  })

  if (!isOpen) return null

  const totalValue = receivingLines.reduce((sum, line) => sum + line.line_total, 0)
  const totalItems = receivingLines.reduce((sum, line) => sum + line.qty_to_receive, 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-100 px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">Receive Inventory</h2>
            <Badge className="bg-blue-100 text-blue-800">
              {totalItems} items | {formatCurrency(totalValue)}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* PO Selection - Show for both cases but make it read-only for preselected */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {preSelectedPO ? 'Purchase Order' : 'Select Purchase Orders to Receive'}
            </label>
            
            {preSelectedPO ? (
              /* Show the preselected PO as read-only */
              <div className="border rounded-lg p-3 bg-blue-50">
                <div className="flex items-center gap-3 p-2">
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
              /* Multiple PO selection for list mode */
              <div className="border rounded-lg">
                {/* Search bar */}
                <div className="p-3 border-b bg-gray-50">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search by PO number, vendor, or reference..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-8 text-sm"
                    />
                  </div>
                </div>
                
                {/* PO List */}
                <div className="max-h-64 overflow-auto">
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
                        
                        return (
                          <label key={po.id} className="flex items-center gap-3 p-3 hover:bg-blue-50 cursor-pointer transition-colors">
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
                              </div>
                              
                              {/* Vendor and reference */}
                              <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
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
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>Ordered {formatDate(po.order_date)}</span>
                                </div>
                                {po.expected_delivery_date && (
                                  <div className="flex items-center gap-1">
                                    <Truck className="w-3 h-3" />
                                    <span>Expected {formatDate(po.expected_delivery_date)}</span>
                                  </div>
                                )}
                              </div>
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

          {/* Receiving Details */}
          <div className="grid grid-cols-3 gap-4 mb-6">
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

          {/* Line Items */}
          {isLoadingLines ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-pulse" />
              <p>Loading items to receive...</p>
            </div>
          ) : receivingLines.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-700">Items to Receive</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReceiveAll}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Receive All
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ordered</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Previously Received</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">To Receive</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {receivingLines.map(line => (
                      <tr key={line.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{line.po_number}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{line.product_name}</div>
                          <div className="text-xs text-gray-500">{line.product_sku}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">{line.qty_ordered}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-500">{line.qty_received}</td>
                        <td className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            min="0"
                            max={line.qty_ordered - line.qty_received}
                            value={line.qty_to_receive}
                            onChange={(e) => handleQtyChange(line.id, parseInt(e.target.value) || 0)}
                            className="w-20 text-center"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          {formatCurrency(line.unit_price)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          {formatCurrency(line.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-700">Total</td>
                      <td className="px-4 py-3 text-center text-sm font-bold">{totalItems}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">—</td>
                      <td className="px-4 py-3 text-right text-sm font-bold">{formatCurrency(totalValue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            // Show appropriate empty state
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              {preSelectedPO ? (
                <p>No items available to receive from this purchase order</p>
              ) : selectedPOs.length === 0 ? (
                <p>Select purchase orders to begin receiving inventory</p>
              ) : (
                <p>No items available to receive from selected purchase orders</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span>Receiving will update inventory quantities and PO status</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || receivingLines.filter(l => l.qty_to_receive > 0).length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? 'Receiving...' : 'Receive Inventory'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString()
}