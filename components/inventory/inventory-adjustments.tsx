'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { X, Plus, Trash2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface InventoryAdjustmentsProps {
  isOpen: boolean
  onClose: () => void
  inventory: InventoryItem[]
  onAdjustmentComplete: () => void
}

interface InventoryItem {
  id: string
  product: {
    id: string
    sku: string
    manufacturer_part_number: string | null
    name: string
    description: string | null
    category: string | null
    unit_of_measure: string
    is_shippable: boolean
    reorder_point: number | null
  }
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  weighted_average_cost: number
  last_cost: number | null
  location: string | null
}

interface AdjustmentLine {
  id: string
  inventoryItem: InventoryItem | null
  productSearch: string
  showProductDropdown: boolean
  currentQuantity: number
  adjustmentQuantity: number
  newQuantity: number
  reasonCode: string
  notes: string
}

export default function InventoryAdjustments({ isOpen, onClose, inventory, onAdjustmentComplete }: InventoryAdjustmentsProps) {
  const [adjustmentLines, setAdjustmentLines] = useState<AdjustmentLine[]>([{
    id: '1',
    inventoryItem: null,
    productSearch: '',
    showProductDropdown: false,
    currentQuantity: 0,
    adjustmentQuantity: 0,
    newQuantity: 0,
    reasonCode: '',
    notes: ''
  }])
  const [saving, setSaving] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{[key: string]: {top: number, left: number}} | null>(null)

  const reasonCodes = [
    { value: 'physical_count', label: 'Physical Count Correction' },
    { value: 'damaged', label: 'Damaged Goods' },
    { value: 'expired', label: 'Expired/Obsolete' },
    { value: 'theft', label: 'Theft/Loss' },
    { value: 'return_vendor', label: 'Return to Vendor' },
    { value: 'sample', label: 'Sample/Promotional Use' },
    { value: 'manufacturing', label: 'Manufacturing Waste' },
    { value: 'other', label: 'Other (See Notes)' }
  ]

  const addLine = () => {
    const newId = (adjustmentLines.length + 1).toString()
    setAdjustmentLines([...adjustmentLines, {
      id: newId,
      inventoryItem: null,
      productSearch: '',
      showProductDropdown: false,
      currentQuantity: 0,
      adjustmentQuantity: 0,
      newQuantity: 0,
      reasonCode: '',
      notes: ''
    }])
  }

  // Auto-add new line when current line gets populated
  const checkAndAddNewLine = (lineId: string) => {
    const line = adjustmentLines.find(l => l.id === lineId)
    if (line && line.inventoryItem) {
      // Check if this is the last line and it has an inventory item selected
      const isLastLine = adjustmentLines[adjustmentLines.length - 1].id === lineId
      if (isLastLine) {
        addLine()
      }
    }
  }

  const removeLine = (id: string) => {
    if (adjustmentLines.length > 1) {
      setAdjustmentLines(adjustmentLines.filter(line => line.id !== id))
    }
  }

  // Show dropdown with proper positioning
  const showDropdown = (lineId: string) => {
    const inputElement = document.getElementById(`product-input-${lineId}`)
    if (inputElement) {
      const rect = inputElement.getBoundingClientRect()
      setDropdownPosition(prev => ({
        ...prev,
        [lineId]: {
          top: rect.bottom + 4,
          left: rect.left
        }
      }))
    }
    updateLine(lineId, 'showProductDropdown', true)
  }

  // Hide dropdown
  const hideDropdown = (lineId: string) => {
    updateLine(lineId, 'showProductDropdown', false)
    setDropdownPosition(prev => {
      if (!prev) return null
      const newPos = { ...prev }
      delete newPos[lineId]
      return Object.keys(newPos).length > 0 ? newPos : null
    })
  }

  // Check for duplicate inventory items in adjustment lines
  const checkForDuplicate = (inventoryItemId: string, currentLineId: string): boolean => {
    return adjustmentLines.some(line => 
      line.id !== currentLineId && 
      line.inventoryItem?.id === inventoryItemId
    )
  }

  // Handle inventory item selection with duplicate checking
  const handleInventoryItemSelection = (lineId: string, item: InventoryItem) => {
    // Check if this item is already selected in another line
    if (checkForDuplicate(item.id, lineId)) {
      alert(`"${item.product.sku} - ${item.product.name}" is already selected in another adjustment line. Each item can only be adjusted once per adjustment session.`)
      return
    }

    // Update the line with the selected item
    updateLine(lineId, 'inventoryItem', item)
    hideDropdown(lineId)
  }

  const updateLine = (id: string, field: keyof AdjustmentLine, value: any) => {
    setAdjustmentLines(prevLines => {
      const newLines = prevLines.map(line => {
        if (line.id === id) {
          const updatedLine = { ...line, [field]: value }
          
          // If inventory item changed, update current quantity and search text
          if (field === 'inventoryItem' && value) {
            updatedLine.currentQuantity = value.quantity_on_hand
            updatedLine.newQuantity = value.quantity_on_hand + updatedLine.adjustmentQuantity
            updatedLine.productSearch = `${value.product.sku} - ${value.product.name}`
            updatedLine.showProductDropdown = false
          }
          
          // If adjustment quantity changed, calculate new quantity
          if (field === 'adjustmentQuantity') {
            updatedLine.newQuantity = updatedLine.currentQuantity + value
          }
          
          // If new quantity changed, calculate adjustment quantity
          if (field === 'newQuantity') {
            updatedLine.adjustmentQuantity = value - updatedLine.currentQuantity
          }
          
          return updatedLine
        }
        return line
      })
      
      // Check if we need to add a new line after this update
      setTimeout(() => checkAndAddNewLine(id), 100)
      
      return newLines
    })
  }

  // Filter inventory based on search term
  const getFilteredInventory = (searchTerm: string): InventoryItem[] => {
    if (!searchTerm.trim()) return inventory.slice(0, 10) // Show first 10 if no search
    
    const searchLower = searchTerm.toLowerCase()
    const filtered = inventory.filter(item => 
      item.product.sku.toLowerCase().includes(searchLower) ||
      item.product.name.toLowerCase().includes(searchLower) ||
      item.product.manufacturer_part_number?.toLowerCase().includes(searchLower)
    ).slice(0, 10) // Limit to 10 results
    
    return filtered
  }

  // Check if an inventory item is already selected in any line (for visual indication)
  const isItemAlreadySelected = (itemId: string): boolean => {
    return adjustmentLines.some(line => line.inventoryItem?.id === itemId)
  }

  const validateAdjustments = (): boolean => {
    const validLines = adjustmentLines.filter(line => line.inventoryItem && line.adjustmentQuantity !== 0)
    
    if (validLines.length === 0) {
      console.log('Validation failed: No valid adjustment lines found')
      return false
    }

    const invalid = validLines.find(line => 
      !line.inventoryItem || 
      !line.reasonCode || 
      line.adjustmentQuantity === 0 ||
      line.newQuantity < 0
    )
    
    if (invalid) {
      console.log('Validation failed for line:', {
        hasInventoryItem: !!invalid.inventoryItem,
        hasReasonCode: !!invalid.reasonCode,
        adjustmentQuantity: invalid.adjustmentQuantity,
        newQuantity: invalid.newQuantity
      })
      return false
    }
    
    console.log(`Validation passed for ${validLines.length} lines`)
    return true
  }

  const saveAdjustments = async () => {
    console.log('Save button clicked, starting validation...')
    if (!validateAdjustments()) {
      alert('Please fill in all required fields and ensure no negative inventory.')
      return
    }

    console.log('Validation passed, starting save process...')
    setSaving(true)
    
    try {
      // Get current user
      console.log('Getting current user...')
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('User error:', userError)
        throw userError
      }
      console.log('User data:', userData)

      // Create adjustment header record
      console.log('Creating adjustment header...')
      const { data: adjustmentHeader, error: headerError } = await supabase
        .from('inventory_adjustments')
        .insert({
          adjustment_date: new Date().toISOString(),
          notes: 'Inventory adjustment via ERP system',
          user_id: userData.user?.id,
          status: 'draft'
        })
        .select()
        .single()

      if (headerError) {
        console.error('Header error:', headerError)
        throw headerError
      }
      console.log('Adjustment header created:', adjustmentHeader)

      // Create adjustment line records
      const adjustmentLinesData = adjustmentLines
        .filter(line => line.inventoryItem && line.adjustmentQuantity !== 0)
        .map(line => ({
          adjustment_id: adjustmentHeader.id,
          inventory_id: line.inventoryItem!.id,
          previous_quantity: line.currentQuantity,
          adjustment_quantity: line.adjustmentQuantity,
          new_quantity: line.newQuantity,
          reason_code: line.reasonCode,
          line_notes: line.notes
        }))

      if (adjustmentLinesData.length === 0) {
        alert('No adjustments to save.')
        return
      }

      const { error: linesError } = await supabase
        .from('inventory_adjustment_lines')
        .insert(adjustmentLinesData)

      if (linesError) throw linesError

      // Complete the adjustment (this will trigger inventory updates via the database trigger)
      const { error: completeError } = await supabase
        .from('inventory_adjustments')
        .update({ status: 'completed' })
        .eq('id', adjustmentHeader.id)

      if (completeError) throw completeError

      alert(`Inventory adjustment ${adjustmentHeader.adjustment_number} saved successfully!`)
      
      // Clear the form for next adjustment
      setAdjustmentLines([{
        id: '1',
        inventoryItem: null,
        productSearch: '',
        showProductDropdown: false,
        currentQuantity: 0,
        adjustmentQuantity: 0,
        newQuantity: 0,
        reasonCode: '',
        notes: ''
      }])
      
      onAdjustmentComplete()
      onClose()
      
    } catch (error) {
      console.error('Error saving adjustments:', error)
      alert(`Error saving adjustments: ${(error as any)?.message || 'Please try again.'}`)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2" style={{ overflow: 'hidden' }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[98vw] h-[98vh] flex flex-col border" style={{ overflow: 'hidden' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Inventory Adjustments</h2>
            <p className="text-sm text-gray-600 mt-1">Adjust inventory quantities with proper audit trail</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            type="button"
          >
            <X className="h-5 w-5 text-gray-500 hover:text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Adjustment Lines</CardTitle>
                  <CardDescription>Add or modify inventory quantities with reason codes</CardDescription>
                </div>
                <Button onClick={addLine} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-700 w-4"></th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700 min-w-48">Product</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700 w-24">Current</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700 w-24">Adjustment</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700 w-24">New Qty</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700 w-36">Reason</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700 min-w-48">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustmentLines.map((line, index) => (
                      <tr key={line.id} className="border-b">
                        {/* Remove Button */}
                        <td className="py-2 px-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(line.id)}
                            disabled={adjustmentLines.length === 1}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </td>

                        {/* Product Selection with Autocomplete */}
                        <td className="py-2 px-2" style={{ position: 'relative' }}>
                          <input
                            id={`product-input-${line.id}`}
                            type="text"
                            value={line.productSearch}
                            onChange={(e) => {
                              updateLine(line.id, 'productSearch', e.target.value)
                              showDropdown(line.id)
                            }}
                            onFocus={() => {
                              showDropdown(line.id)
                            }}
                            onBlur={() => {
                              // Delay hiding dropdown to allow clicks
                              setTimeout(() => hideDropdown(line.id), 150)
                            }}
                            placeholder="Type SKU or product name..."
                            className="w-full h-8 px-2 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* Current Quantity */}
                        <td className="py-2 px-2">
                          <div className="text-right text-xs text-gray-600 font-mono">
                            {line.currentQuantity.toFixed(2)}
                            {line.inventoryItem && (
                              <div className="text-xs text-gray-500">
                                {line.inventoryItem.product.unit_of_measure}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Adjustment Quantity */}
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={line.adjustmentQuantity === 0 ? '' : line.adjustmentQuantity}
                            onChange={(e) => updateLine(line.id, 'adjustmentQuantity', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            step="1"
                            className={`h-8 text-xs text-right font-mono ${
                              line.adjustmentQuantity > 0 ? 'text-green-600' : 
                              line.adjustmentQuantity < 0 ? 'text-red-600' : ''
                            }`}
                          />
                        </td>

                        {/* New Quantity */}
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={line.newQuantity === 0 ? '' : line.newQuantity}
                            onChange={(e) => updateLine(line.id, 'newQuantity', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            step="1"
                            className={`h-8 text-xs text-right font-mono ${
                              line.newQuantity < 0 ? 'text-red-600 border-red-500' : ''
                            }`}
                          />
                        </td>

                        {/* Reason Code */}
                        <td className="py-2 px-2">
                          <select
                            value={line.reasonCode}
                            onChange={(e) => updateLine(line.id, 'reasonCode', e.target.value)}
                            className="w-full h-8 px-2 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select Reason...</option>
                            {reasonCodes.map(reason => (
                              <option key={reason.value} value={reason.value}>
                                {reason.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Notes */}
                        <td className="py-2 px-2">
                          <Input
                            value={line.notes}
                            onChange={(e) => updateLine(line.id, 'notes', e.target.value)}
                            placeholder="Optional notes..."
                            className="h-8 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50 flex-shrink-0">
          <p className="text-sm text-gray-600">
            {adjustmentLines.filter(line => line.adjustmentQuantity !== 0).length} adjustments ready
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={saveAdjustments}
              disabled={saving || !validateAdjustments()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Adjustments'}
            </Button>
          </div>
        </div>

        {/* Floating Dropdowns - Rendered outside scrollable content */}
        {adjustmentLines.map(line => (
          line.showProductDropdown && dropdownPosition && dropdownPosition[line.id] && (
            <div 
              key={`floating-dropdown-${line.id}`}
              className="fixed bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-y-auto min-w-[400px]" 
              style={{
                top: dropdownPosition[line.id].top,
                left: dropdownPosition[line.id].left,
                zIndex: 10001
              }}
            >
              {getFilteredInventory(line.productSearch).map(item => {
                const isAlreadySelected = isItemAlreadySelected(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-xs border-b border-gray-100 last:border-b-0 focus:outline-none ${
                      isAlreadySelected 
                        ? 'bg-red-50 hover:bg-red-100 cursor-not-allowed' 
                        : 'hover:bg-blue-50 focus:bg-blue-50'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault() // Prevent blur
                      handleInventoryItemSelection(line.id, item)
                    }}
                  >
                    <div className={`font-medium ${isAlreadySelected ? 'text-red-700' : ''}`}>
                      {item.product.sku}
                      {isAlreadySelected && <span className="ml-2 text-red-500 text-xs">(Already Selected)</span>}
                    </div>
                    <div className={`truncate ${isAlreadySelected ? 'text-red-600' : 'text-gray-600'}`}>
                      {item.product.name}
                    </div>
                    <div className={`${isAlreadySelected ? 'text-red-500' : 'text-gray-500'}`}>
                      On Hand: {item.quantity_on_hand.toFixed(2)} {item.product.unit_of_measure}
                    </div>
                  </button>
                )
              })}
              {getFilteredInventory(line.productSearch).length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-500">No products found</div>
              )}
            </div>
          )
        ))}
      </div>
    </div>
  )
}