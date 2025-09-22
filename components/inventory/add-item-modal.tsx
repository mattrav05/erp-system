'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { X } from 'lucide-react'

interface AddItemModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (item: NewInventoryItem) => void
  onUpdate?: (item: NewInventoryItem & { id: string }) => void
  onDelete?: (id: string) => void
  editingItem?: InventoryItem | null
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
  sales_price: number | null
  location: string | null
}

interface NewInventoryItem {
  sku: string
  manufacturer_part_number: string
  name: string
  description: string
  category: string
  unit_of_measure: string
  is_shippable: boolean
  reorder_point: number | null
  quantity_on_hand: number
  weighted_average_cost: number
  sales_price: number
  markup_percentage: number
  margin_percentage: number
}

export default function AddItemModal({ isOpen, onClose, onAdd, onUpdate, onDelete, editingItem }: AddItemModalProps) {
  const [formData, setFormData] = useState<NewInventoryItem>({
    sku: '',
    manufacturer_part_number: '',
    name: '',
    description: '',
    category: '',
    unit_of_measure: 'EA',
    is_shippable: true,
    reorder_point: null,
    quantity_on_hand: 0,
    weighted_average_cost: 0,
    sales_price: 0,
    markup_percentage: 0,
    margin_percentage: 0
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Calculate markup and margin from cost and sales price
  const calculateMarkupAndMargin = (cost: number, salesPrice: number) => {
    if (cost > 0 && salesPrice > 0) {
      const markupPercentage = ((salesPrice - cost) / cost) * 100
      const marginPercentage = ((salesPrice - cost) / salesPrice) * 100
      return {
        markup_percentage: markupPercentage,
        margin_percentage: marginPercentage
      }
    }
    return {
      markup_percentage: 0,
      margin_percentage: 0
    }
  }

  // Populate form when editing an item
  useEffect(() => {
    if (editingItem) {
      const cost = editingItem.weighted_average_cost
      const salesPrice = editingItem.sales_price || 0
      const calculations = calculateMarkupAndMargin(cost, salesPrice)
      
      setFormData({
        sku: editingItem.product.sku,
        manufacturer_part_number: editingItem.product.manufacturer_part_number || '',
        name: editingItem.product.name,
        description: editingItem.product.description || '',
        category: editingItem.product.category || '',
        unit_of_measure: editingItem.product.unit_of_measure,
        is_shippable: editingItem.product.is_shippable,
        reorder_point: editingItem.product.reorder_point,
        quantity_on_hand: editingItem.quantity_on_hand,
        weighted_average_cost: cost,
        sales_price: salesPrice,
        markup_percentage: calculations.markup_percentage,
        margin_percentage: calculations.margin_percentage
      })
    } else {
      // Reset form for new item
      setFormData({
        sku: '',
        manufacturer_part_number: '',
        name: '',
        description: '',
        category: '',
        unit_of_measure: 'EA',
        is_shippable: true,
        reorder_point: null,
        quantity_on_hand: 0,
        weighted_average_cost: 0,
        sales_price: 0,
        markup_percentage: 0,
        margin_percentage: 0
      })
    }
    setErrors({})
  }, [editingItem, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    const newErrors: Record<string, string> = {}
    
    if (!formData.sku.trim()) newErrors.sku = 'SKU is required'
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (formData.weighted_average_cost < 0) newErrors.weighted_average_cost = 'Cost cannot be negative'
    if (formData.quantity_on_hand < 0) newErrors.quantity_on_hand = 'Quantity cannot be negative'
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length === 0) {
      if (editingItem && onUpdate) {
        // Update existing item
        onUpdate({ ...formData, id: editingItem.id })
      } else {
        // Add new item
        onAdd(formData)
      }
      onClose()
    }
  }

  const calculatePricing = (field: string, value: number, currentData: NewInventoryItem) => {
    const newData = { ...currentData }
    
    switch (field) {
      case 'weighted_average_cost':
        newData.weighted_average_cost = value
        if (value > 0 && currentData.sales_price > 0) {
          // Recalculate markup and margin based on existing sales price
          newData.markup_percentage = ((currentData.sales_price - value) / value) * 100
          newData.margin_percentage = ((currentData.sales_price - value) / currentData.sales_price) * 100
        } else if (value > 0 && currentData.markup_percentage > 0) {
          // Calculate sales price from cost and markup
          newData.sales_price = value * (1 + currentData.markup_percentage / 100)
          newData.margin_percentage = (currentData.markup_percentage / (100 + currentData.markup_percentage)) * 100
        }
        break
        
      case 'sales_price':
        newData.sales_price = value
        if (value > 0 && currentData.weighted_average_cost > 0) {
          // Recalculate markup and margin
          newData.markup_percentage = ((value - currentData.weighted_average_cost) / currentData.weighted_average_cost) * 100
          newData.margin_percentage = ((value - currentData.weighted_average_cost) / value) * 100
        }
        break
        
      case 'markup_percentage':
        newData.markup_percentage = value
        if (currentData.weighted_average_cost > 0) {
          // Calculate sales price from cost and markup
          newData.sales_price = currentData.weighted_average_cost * (1 + value / 100)
          newData.margin_percentage = value > 0 ? (value / (100 + value)) * 100 : 0
        }
        break
        
      case 'margin_percentage':
        newData.margin_percentage = value
        if (currentData.weighted_average_cost > 0 && value > 0 && value < 100) {
          // Calculate sales price from cost and margin
          newData.sales_price = currentData.weighted_average_cost / (1 - value / 100)
          newData.markup_percentage = ((newData.sales_price - currentData.weighted_average_cost) / currentData.weighted_average_cost) * 100
        }
        break
    }
    
    return newData
  }

  const handleInputChange = (field: keyof NewInventoryItem, value: any) => {
    let newData = { ...formData, [field]: value }
    
    // If it's a pricing field, recalculate other pricing fields
    if (['weighted_average_cost', 'sales_price', 'markup_percentage', 'margin_percentage'].includes(field)) {
      newData = calculatePricing(field, typeof value === 'number' ? value : parseFloat(value) || 0, formData)
    }
    
    setFormData(newData)
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-row items-center justify-between p-6 border-b bg-white">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {editingItem ? 'Update product details and inventory levels' : 'Create a new product and set initial inventory levels'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            type="button"
          >
            <X className="h-5 w-5 text-gray-500 hover:text-gray-700" />
          </button>
        </div>
        
        <div className="p-6 bg-white">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SKU */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU *
                </label>
                <Input
                  value={formData.sku}
                  onChange={(e) => handleInputChange('sku', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder="e.g., SKU-006"
                  className={`bg-white ${errors.sku ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.sku && <p className="text-red-500 text-xs mt-1">{errors.sku}</p>}
              </div>

              {/* MFN Part # */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  MFN Part #
                </label>
                <Input
                  value={formData.manufacturer_part_number}
                  onChange={(e) => handleInputChange('manufacturer_part_number', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder="e.g., ABC-123-XYZ"
                  className="bg-white border-gray-300"
                />
                <p className="text-xs text-gray-500 mt-1">Manufacturer's part number for vendor orders</p>
              </div>

              {/* Unit of Measure */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit of Measure
                </label>
                <select
                  value={formData.unit_of_measure}
                  onChange={(e) => handleInputChange('unit_of_measure', e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="EA">Each (EA)</option>
                  <option value="LB">Pounds (LB)</option>
                  <option value="FT">Feet (FT)</option>
                  <option value="SQ FT">Square Feet (SQ FT)</option>
                  <option value="HR">Hours (HR)</option>
                  <option value="KIT">Kit (KIT)</option>
                  <option value="BOX">Box (BOX)</option>
                  <option value="CASE">Case (CASE)</option>
                </select>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder="e.g., Premium Widget XL"
                className={`bg-white ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Optional product description"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <Input
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder="e.g., Widgets, Cables, Services"
                  className="bg-white border-gray-300"
                />
              </div>

              {/* Reorder Point */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reorder Point
                </label>
                <Input
                  type="number"
                  value={formData.reorder_point || ''}
                  onChange={(e) => handleInputChange('reorder_point', e.target.value ? parseInt(e.target.value) : null)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder="Minimum stock level"
                  min="0"
                  className="bg-white border-gray-300"
                />
              </div>
            </div>

            {/* Quantity Section - Different for New vs Existing Items */}
            {editingItem ? (
              // For existing items - show read-only inventory status
              <Card className="bg-gray-50 border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-900">Current Inventory Status</CardTitle>
                  <CardDescription className="text-xs text-gray-600">
                    Quantities are managed through Purchase Orders, Sales Orders, and Adjustments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">On Hand</label>
                      <div className="h-9 px-3 border border-gray-300 rounded-md bg-gray-100 flex items-center text-sm text-gray-700">
                        {editingItem.quantity_on_hand.toFixed(2)} {editingItem.product.unit_of_measure}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Allocated</label>
                      <div className="h-9 px-3 border border-gray-300 rounded-md bg-gray-100 flex items-center text-sm text-orange-600">
                        {editingItem.quantity_allocated.toFixed(2)} {editingItem.product.unit_of_measure}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Available</label>
                      <div className={`h-9 px-3 border border-gray-300 rounded-md bg-gray-100 flex items-center text-sm font-medium ${
                        editingItem.quantity_available <= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {editingItem.quantity_available.toFixed(2)} {editingItem.product.unit_of_measure}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // For new items - show editable initial quantity
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Quantity *
                </label>
                <Input
                  type="number"
                  value={formData.quantity_on_hand}
                  onChange={(e) => handleInputChange('quantity_on_hand', parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder="Starting inventory"
                  min="0"
                  step="0.01"
                  className={`bg-white ${errors.quantity_on_hand ? 'border-red-500' : 'border-gray-300'}`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Set the starting inventory count for this new product
                </p>
                {errors.quantity_on_hand && <p className="text-red-500 text-xs mt-1">{errors.quantity_on_hand}</p>}
              </div>
            )}

            {/* Pricing Calculator Section */}
            <Card className="mt-6 border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-blue-900">Pricing Calculator</CardTitle>
                <CardDescription className="text-blue-700">
                  Enter any value and the others will calculate automatically
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Unit Cost */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Cost
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        type="number"
                        value={formData.weighted_average_cost || ''}
                        onChange={(e) => handleInputChange('weighted_average_cost', parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className={`pl-8 bg-white ${errors.weighted_average_cost ? 'border-red-500' : 'border-gray-300'}`}
                      />
                    </div>
                    {errors.weighted_average_cost && <p className="text-red-500 text-xs mt-1">{errors.weighted_average_cost}</p>}
                  </div>

                  {/* Sales Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sales Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        type="number"
                        value={formData.sales_price || ''}
                        onChange={(e) => handleInputChange('sales_price', parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="pl-8 bg-white border-gray-300"
                      />
                    </div>
                  </div>

                  {/* Markup Percentage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Markup %
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.markup_percentage ? formData.markup_percentage.toFixed(1) : ''}
                        onChange={(e) => handleInputChange('markup_percentage', parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                        placeholder="0.0"
                        min="0"
                        step="0.1"
                        className="pr-8 bg-white border-gray-300"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                    </div>
                  </div>

                  {/* Margin Percentage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Margin %
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.margin_percentage ? formData.margin_percentage.toFixed(1) : ''}
                        onChange={(e) => handleInputChange('margin_percentage', parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                        placeholder="0.0"
                        min="0"
                        max="99.9"
                        step="0.1"
                        className="pr-8 bg-white border-gray-300"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                    </div>
                  </div>
                </div>

                {/* Profit Display */}
                {(formData.weighted_average_cost > 0 || formData.sales_price > 0) && (
                  <div className="mt-4 p-3 bg-white rounded-md border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Profit per Unit:</span>
                      <span className="text-lg font-semibold text-green-600">
                        {formatCurrency(Math.max(0, formData.sales_price - formData.weighted_average_cost))}
                      </span>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>

            {/* Shippable */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_shippable"
                checked={formData.is_shippable}
                onChange={(e) => handleInputChange('is_shippable', e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="is_shippable" className="text-sm text-gray-700">
                This is a shippable product (uncheck for services or digital items)
              </label>
            </div>

            {/* Buttons */}
            <div className="flex justify-between pt-4 border-t border-gray-200">
              <div>
                {editingItem && onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this inventory item? This action cannot be undone.')) {
                        onDelete(editingItem.id)
                        onClose()
                      }
                    }}
                    className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Delete Item
                  </button>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {editingItem ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}