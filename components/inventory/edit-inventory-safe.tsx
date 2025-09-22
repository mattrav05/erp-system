/**
 * SAFE INVENTORY EDIT MODAL
 * 
 * Enhanced version with full multi-user support:
 * - Optimistic locking
 * - Conflict resolution
 * - Real-time collaboration awareness
 * - Auto-save capability
 */

'use client'

import { useEffect, useState } from 'react'
import { useSafeForm } from '@/hooks/use-safe-form-simple'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import CollaborationIndicator from '@/components/ui/collaboration-indicator'
import SimpleConflictResolver from '@/components/ui/simple-conflict-resolver'
import { Badge } from '@/components/ui/badge'
import { Save, X, AlertCircle, Clock, Shield, Package, DollarSign, Receipt } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import TaxCodeDropdown from '@/components/ui/tax-code-dropdown'

interface InventoryItem {
  id: string
  product_id: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  weighted_average_cost: number
  last_cost: number | null
  sales_price: number | null
  margin_percent: number | null
  markup_percent: number | null
  location: string | null
  default_tax_code?: string | null
  default_tax_rate?: number | null
  is_active: boolean
  reorder_point?: number | null
  version?: number
  last_modified_by?: string | null
  created_at: string
  updated_at: string
}

interface EditInventorySafeProps {
  inventoryItem: InventoryItem
  isOpen: boolean
  onClose: () => void
  onSave: (item: InventoryItem) => void
  currentUserId?: string
  productName?: string // Optional product name for display
}

export default function EditInventorySafe({
  inventoryItem,
  isOpen,
  onClose,
  onSave,
  currentUserId,
  productName
}: EditInventorySafeProps) {
  const [showConflictDetails, setShowConflictDetails] = useState(false)
  const [reorderPoint, setReorderPoint] = useState<number | null>(inventoryItem.reorder_point || null)
  
  // Create inventory item without reorder_point for the safe form
  const inventoryDataOnly = {
    ...inventoryItem,
    reorder_point: undefined // Remove from inventory form data
  }
  
  // Initialize the safe form with multi-user support (inventory table only)
  const form = useSafeForm<InventoryItem>({
    table: 'inventory',
    record: inventoryDataOnly,
    onSaveSuccess: async (savedItem) => {
      // After inventory is saved, update the product's reorder point
      try {
        if (reorderPoint !== inventoryItem.reorder_point) {
          const { error } = await supabase
            .from('products')
            .update({ reorder_point: reorderPoint })
            .eq('id', inventoryItem.product_id)
            
          if (error) {
            console.error('Error updating reorder point:', error)
            // Still continue with the save since inventory was updated successfully
          }
        }
        
        // Include reorder point in the saved item for the callback
        onSave({ ...savedItem, reorder_point: reorderPoint })
        onClose()
      } catch (error) {
        console.error('Error updating product reorder point:', error)
        // Still continue with the save since inventory was updated successfully
        onSave({ ...savedItem, reorder_point: reorderPoint })
        onClose()
      }
    },
    autoSave: false // Can be enabled for auto-save
  })

  // Start editing session when modal opens
  useEffect(() => {
    if (isOpen) {
      form.startEditing()
      
      // Auto-calculate margin/markup if values are missing but we have price and cost
      const { sales_price, weighted_average_cost, margin_percent, markup_percent } = form.data
      
      if (sales_price && weighted_average_cost && sales_price > weighted_average_cost) {
        if (!margin_percent) {
          const margin = ((sales_price - weighted_average_cost) / sales_price) * 100
          form.updateField('margin_percent', Math.round(margin * 100) / 100)
        }
        
        if (!markup_percent) {
          const markup = ((sales_price - weighted_average_cost) / weighted_average_cost) * 100
          form.updateField('markup_percent', Math.round(markup * 100) / 100)
        }
      }
    }
    return () => {
      if (isOpen) {
        form.stopEditing()
      }
    }
  }, [isOpen, form.data.sales_price, form.data.weighted_average_cost])

  if (!isOpen) return null

  const handleSave = async () => {
    const success = await form.save()
    if (success) {
      // Success handled by onSaveSuccess callback
    }
  }

  const handleCancel = () => {
    form.stopEditing()
    form.reset()
    setReorderPoint(inventoryItem.reorder_point || null)
    onClose()
  }

  // Calculate available quantity when on-hand or allocated changes
  useEffect(() => {
    const onHand = form.data.quantity_on_hand || 0
    const allocated = form.data.quantity_allocated || 0
    const available = Math.max(0, onHand - allocated)
    
    if (available !== form.data.quantity_available) {
      form.updateField('quantity_available', available)
    }
  }, [form.data.quantity_on_hand, form.data.quantity_allocated])

  // Other users currently viewing/editing
  const otherUsers = form.activeUsers.filter(u => u.user_id !== currentUserId)
  const hasOtherEditors = otherUsers.some(u => u.action === 'editing')

  // Format values for display
  const avgCost = form.data.weighted_average_cost ? formatCurrency(form.data.weighted_average_cost) : '$0.00'
  const lastCost = form.data.last_cost ? formatCurrency(form.data.last_cost) : 'N/A'
  const salesPrice = form.data.sales_price ? formatCurrency(form.data.sales_price) : 'Not set'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white">
        {/* Header with Collaboration Indicator */}
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-white">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">Edit Inventory</CardTitle>
              {productName && (
                <p className="text-sm text-gray-600 mt-1">{productName}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {/* Version Badge */}
                <Badge variant="outline" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Version {form.data.version || 1}
                </Badge>
                
                {/* Last Modified */}
                {form.data.updated_at && (
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    Updated {formatDistanceToNow(new Date(form.data.updated_at))} ago
                  </Badge>
                )}
                
                {/* Dirty Indicator */}
                {(form.isDirty || reorderPoint !== inventoryItem.reorder_point) && (
                  <Badge className="bg-orange-500 text-xs">
                    Unsaved Changes
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Collaboration Indicator */}
            <div className="flex items-center gap-3">
              {otherUsers.length > 0 && (
                <CollaborationIndicator 
                  activeUsers={form.activeUsers}
                  currentUserId={currentUserId}
                />
              )}
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Warning if others are editing */}
          {hasOtherEditors && (
            <div className="mt-3 p-2 bg-orange-100 border border-orange-300 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-orange-800">
                Other users are currently editing this inventory item
              </span>
            </div>
          )}
        </CardHeader>

        {/* Conflict Resolution UI */}
        {form.currentConflict && (
          <SimpleConflictResolver
            conflict={form.currentConflict}
            onResolve={form.resolveConflict}
            onCancel={form.dismissConflict}
          />
        )}

        {/* Form Content */}
        <CardContent className="p-6 space-y-6 overflow-y-auto bg-white flex-1 min-h-0">
          {/* Quantity Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Quantity Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity_on_hand">Quantity On Hand *</Label>
                <Input
                  id="quantity_on_hand"
                  type="number"
                  value={form.data.quantity_on_hand || 0}
                  onChange={(e) => form.updateField('quantity_on_hand', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  step="1"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quantity_allocated">Quantity Allocated</Label>
                <Input
                  id="quantity_allocated"
                  type="number"
                  value={form.data.quantity_allocated || 0}
                  onChange={(e) => form.updateField('quantity_allocated', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  step="1"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quantity_available">Quantity Available</Label>
                <Input
                  id="quantity_available"
                  type="number"
                  value={form.data.quantity_available || 0}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500">
                  Auto-calculated: On Hand - Allocated
                </p>
              </div>
            </div>
          </div>

          {/* Reorder Point */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Reorder Management
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reorder_point">Reorder Point</Label>
                <Input
                  id="reorder_point"
                  type="number"
                  value={reorderPoint || ''}
                  onChange={(e) => setReorderPoint(parseFloat(e.target.value) || null)}
                  placeholder="0"
                  min="0"
                  step="1"
                />
                <p className="text-xs text-gray-500">
                  Alert when available quantity falls below this level
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Current Stock Status</Label>
                <div className="p-2 rounded border">
                  {reorderPoint && form.data.quantity_available <= reorderPoint ? (
                    <span className="text-orange-600 font-medium text-sm">
                      ⚠️ Below reorder point ({form.data.quantity_available} ≤ {reorderPoint})
                    </span>
                  ) : form.data.quantity_available <= 0 ? (
                    <span className="text-red-600 font-medium text-sm">
                      🚨 Out of stock
                    </span>
                  ) : (
                    <span className="text-green-600 font-medium text-sm">
                      ✅ In stock
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cost Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cost Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weighted_average_cost">Weighted Average Cost *</Label>
                <Input
                  id="weighted_average_cost"
                  type="number"
                  value={form.data.weighted_average_cost || 0}
                  onChange={(e) => form.updateField('weighted_average_cost', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
                <p className="text-xs text-gray-500">
                  Current: {avgCost}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="last_cost">Last Cost</Label>
                <Input
                  id="last_cost"
                  type="number"
                  value={form.data.last_cost || ''}
                  onChange={(e) => form.updateField('last_cost', parseFloat(e.target.value) || null)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500">
                  Last recorded: {lastCost}
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Pricing & Margins</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sales_price">Sales Price</Label>
                <Input
                  id="sales_price"
                  type="number"
                  value={form.data.sales_price || ''}
                  onChange={(e) => {
                    const price = parseFloat(e.target.value) || null
                    form.updateField('sales_price', price)
                    
                    // Auto-calculate margin when sales price changes
                    if (price && form.data.weighted_average_cost) {
                      const margin = ((price - form.data.weighted_average_cost) / price) * 100
                      form.updateField('margin_percent', Math.round(margin * 100) / 100)
                      
                      const markup = ((price - form.data.weighted_average_cost) / form.data.weighted_average_cost) * 100
                      form.updateField('markup_percent', Math.round(markup * 100) / 100)
                    }
                  }}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500">
                  Current: {salesPrice}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="margin_percent">Margin %</Label>
                <Input
                  id="margin_percent"
                  type="number"
                  value={form.data.margin_percent || ''}
                  onChange={(e) => {
                    const margin = parseFloat(e.target.value) || null
                    form.updateField('margin_percent', margin)
                    
                    // Auto-calculate sales price from margin
                    if (margin && form.data.weighted_average_cost) {
                      const price = form.data.weighted_average_cost / (1 - margin / 100)
                      form.updateField('sales_price', Math.round(price * 100) / 100)
                      
                      const markup = ((price - form.data.weighted_average_cost) / form.data.weighted_average_cost) * 100
                      form.updateField('markup_percent', Math.round(markup * 100) / 100)
                    }
                  }}
                  placeholder="0.00"
                  min="0"
                  max="100"
                  step="0.01"
                />
                <p className="text-xs text-gray-500">
                  Profit as % of sales price
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="markup_percent">Markup %</Label>
                <Input
                  id="markup_percent"
                  type="number"
                  value={form.data.markup_percent || ''}
                  onChange={(e) => {
                    const markup = parseFloat(e.target.value) || null
                    form.updateField('markup_percent', markup)
                    
                    // Auto-calculate sales price from markup
                    if (markup && form.data.weighted_average_cost) {
                      const price = form.data.weighted_average_cost * (1 + markup / 100)
                      form.updateField('sales_price', Math.round(price * 100) / 100)
                      
                      const margin = ((price - form.data.weighted_average_cost) / price) * 100
                      form.updateField('margin_percent', Math.round(margin * 100) / 100)
                    }
                  }}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500">
                  Profit as % of cost
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Storage Location</Label>
                <Input
                  id="location"
                  value={form.data.location || ''}
                  onChange={(e) => form.updateField('location', e.target.value)}
                  placeholder="e.g., Warehouse A, Bin 1-2-3"
                />
              </div>
            </div>
          </div>

          {/* Tax Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Default Tax Settings
            </h3>
            <p className="text-sm text-gray-600">
              This tax code will be automatically applied when this item is added to estimates, invoices, or sales orders.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_tax_code">Default Tax Code</Label>
                <TaxCodeDropdown
                  value={form.data.default_tax_code || ''}
                  onChange={(taxCode) => {
                    form.updateField('default_tax_code', taxCode?.code || null)
                    form.updateField('default_tax_rate', taxCode?.tax_rate || null)
                  }}
                  placeholder="Select default tax code..."
                />
                <p className="text-xs text-gray-500">
                  This tax code will be auto-selected in line items
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="default_tax_rate">Default Tax Rate (%)</Label>
                <Input
                  id="default_tax_rate"
                  type="number"
                  value={form.data.default_tax_rate || ''}
                  disabled
                  className="bg-gray-100"
                  placeholder="Auto-filled from tax code"
                />
                <p className="text-xs text-gray-500">
                  Current rate: {form.data.default_tax_rate ? `${form.data.default_tax_rate}%` : 'No tax code selected'}
                </p>
              </div>
            </div>
          </div>

          {/* Value Summary */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Inventory Value Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Value (Avg Cost):</span>
                <div className="font-semibold">
                  {formatCurrency((form.data.quantity_on_hand || 0) * (form.data.weighted_average_cost || 0))}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Available Value:</span>
                <div className="font-semibold">
                  {formatCurrency((form.data.quantity_available || 0) * (form.data.weighted_average_cost || 0))}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Potential Sales Value:</span>
                <div className="font-semibold">
                  {form.data.sales_price 
                    ? formatCurrency((form.data.quantity_available || 0) * form.data.sales_price)
                    : 'Price not set'
                  }
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        {/* Footer with Actions */}
        <div className="border-t border-t-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Save Status */}
            <div className="text-sm text-gray-600">
              {form.isSaving && (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                  Saving...
                </span>
              )}
              {!form.isSaving && (form.isDirty || reorderPoint !== inventoryItem.reorder_point) && (
                <span className="text-orange-600">• Unsaved changes</span>
              )}
              {!form.isSaving && !form.isDirty && reorderPoint === inventoryItem.reorder_point && (
                <span className="text-green-600">✓ All changes saved</span>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={form.isSaving || (!form.isDirty && reorderPoint === inventoryItem.reorder_point)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}