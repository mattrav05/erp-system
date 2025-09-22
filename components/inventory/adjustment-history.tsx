'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { X, Search, ChevronLeft, ChevronRight, Trash2, Calendar, ArrowLeft, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface AdjustmentHistoryProps {
  isOpen: boolean
  onClose: () => void
}

interface InventoryAdjustment {
  id: string
  adjustment_date: string
  adjustment_number: string
  notes: string | null
  user_id: string | null
  status: string
  lines: AdjustmentLine[]
}

interface AdjustmentLine {
  id: string
  inventory_id: string
  quantity_adjustment: number
  reason_code: string
  line_notes: string | null
  previous_quantity: number
  new_quantity: number
  inventory: {
    id: string
    products: {
      sku: string
      name: string
      unit_of_measure: string
    }
  }
}

export default function AdjustmentHistory({ isOpen, onClose }: AdjustmentHistoryProps) {
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredAdjustments, setFilteredAdjustments] = useState<InventoryAdjustment[]>([])
  // Removed dataLoaded state - always reload when opened
  const [selectedAdjustment, setSelectedAdjustment] = useState<InventoryAdjustment | null>(null)
  const [view, setView] = useState<'list' | 'detail'>('list')

  const reasonCodeLabels: { [key: string]: string } = {
    'physical_count': 'Physical Count Correction',
    'damaged': 'Damaged Goods',
    'expired': 'Expired/Obsolete',
    'theft': 'Theft/Loss',
    'return_vendor': 'Return to Vendor',
    'sample': 'Sample/Promotional Use',
    'manufacturing': 'Manufacturing Waste',
    'other': 'Other (See Notes)'
  }

  // Load adjustment history only once
  useEffect(() => {
    if (isOpen) {
      console.log('Adjustment history opened, loading data...')
      loadAdjustmentHistory()
    }
  }, [isOpen])

  // Filter adjustments based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredAdjustments(adjustments)
    } else {
      const searchLower = searchTerm.toLowerCase()
      const filtered = adjustments.filter(adj => 
        adj.notes?.toLowerCase().includes(searchLower) ||
        adj.adjustment_number?.toLowerCase().includes(searchLower) ||
        adj.lines.some(line => 
          line.inventory.products.sku.toLowerCase().includes(searchLower) ||
          line.inventory.products.name.toLowerCase().includes(searchLower) ||
          reasonCodeLabels[line.reason_code]?.toLowerCase().includes(searchLower)
        )
      )
      setFilteredAdjustments(filtered)
    }
  }, [searchTerm, adjustments])

  const loadAdjustmentHistory = async () => {
    setLoading(true)
    try {
      // Load adjustments with their lines and related inventory/product data
      const { data: adjustmentsData, error } = await supabase
        .from('inventory_adjustments')
        .select(`
          id,
          adjustment_date,
          adjustment_number,
          notes,
          user_id,
          status,
          inventory_adjustment_lines (
            id,
            inventory_id,
            previous_quantity,
            adjustment_quantity,
            new_quantity,
            reason_code,
            line_notes,
            inventory (
              id,
              products (
                sku,
                name,
                unit_of_measure
              )
            )
          )
        `)
        .order('adjustment_date', { ascending: false })

      if (error) throw error

      // Transform the data to match our interface
      const formattedAdjustments: InventoryAdjustment[] = adjustmentsData.map(adj => ({
        id: adj.id,
        adjustment_date: adj.adjustment_date,
        adjustment_number: adj.adjustment_number,
        notes: adj.notes,
        user_id: adj.user_id,
        status: adj.status,
        lines: (adj.inventory_adjustment_lines as any[]).map((line: any) => ({
          id: line.id,
          inventory_id: line.inventory_id,
          quantity_adjustment: line.adjustment_quantity,
          reason_code: line.reason_code,
          line_notes: line.line_notes,
          previous_quantity: line.previous_quantity,
          new_quantity: line.new_quantity,
          inventory: {
            id: line.inventory?.id,
            products: {
              sku: line.inventory?.products?.sku,
              name: line.inventory?.products?.name,
              unit_of_measure: line.inventory?.products?.unit_of_measure
            }
          }
        }))
      }))
      
      setAdjustments(formattedAdjustments)
    } catch (error) {
      console.error('Error loading adjustment history:', error)
      setAdjustments([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const openAdjustmentDetail = (adjustment: InventoryAdjustment) => {
    setSelectedAdjustment(adjustment)
    setView('detail')
  }

  const closeAdjustmentDetail = () => {
    setSelectedAdjustment(null)
    setView('list')
  }

  const navigateAdjustment = (direction: 'prev' | 'next') => {
    if (!selectedAdjustment) return
    
    const currentIndex = filteredAdjustments.findIndex(adj => adj.id === selectedAdjustment.id)
    let newIndex = currentIndex
    
    if (direction === 'prev' && currentIndex > 0) {
      newIndex = currentIndex - 1
    } else if (direction === 'next' && currentIndex < filteredAdjustments.length - 1) {
      newIndex = currentIndex + 1
    }
    
    if (newIndex !== currentIndex) {
      setSelectedAdjustment(filteredAdjustments[newIndex])
    }
  }

  const deleteCurrentAdjustment = async () => {
    if (!selectedAdjustment) return
    
    if (!window.confirm('Are you sure you want to delete this adjustment? This action cannot be undone and will reverse inventory changes.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('inventory_adjustments')
        .delete()
        .eq('id', selectedAdjustment.id)

      if (error) throw error
      
      // Remove from local state
      setAdjustments(prev => prev.filter(adj => adj.id !== selectedAdjustment.id))
      
      alert('Adjustment deleted successfully!')
      closeAdjustmentDetail()
    } catch (error) {
      console.error('Error deleting adjustment:', error)
      alert(`Error deleting adjustment: ${(error as any)?.message || 'Please try again.'}`)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2" style={{ overflow: 'hidden' }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] h-[95vh] flex flex-col border" style={{ overflow: 'hidden' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            {view === 'detail' && (
              <button 
                onClick={closeAdjustmentDetail}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                type="button"
              >
                <ArrowLeft className="h-4 w-4 text-gray-600" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {view === 'list' ? 'Adjustment History' : selectedAdjustment?.adjustment_number}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {view === 'list' 
                  ? 'View and manage inventory adjustment records' 
                  : `${new Date(selectedAdjustment?.adjustment_date || '').toLocaleDateString()} • ${selectedAdjustment?.status.toUpperCase()}`
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {view === 'detail' && selectedAdjustment && (
              <>
                {/* Navigation arrows */}
                <button 
                  onClick={() => navigateAdjustment('prev')}
                  disabled={filteredAdjustments.findIndex(adj => adj.id === selectedAdjustment.id) === 0}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="text-sm text-gray-500 px-2">
                  {filteredAdjustments.findIndex(adj => adj.id === selectedAdjustment.id) + 1} of {filteredAdjustments.length}
                </span>
                <button 
                  onClick={() => navigateAdjustment('next')}
                  disabled={filteredAdjustments.findIndex(adj => adj.id === selectedAdjustment.id) === filteredAdjustments.length - 1}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
                
                {/* Delete button */}
                <Button 
                  onClick={deleteCurrentAdjustment}
                  variant="destructive" 
                  size="sm"
                  className="ml-2"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
            
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              type="button"
            >
              <X className="h-5 w-5 text-gray-500 hover:text-gray-700" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {view === 'list' ? (
            <div className="p-4">
              {/* Search */}
              <div className="mb-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search adjustments by number, notes, or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Loading state */}
              {loading && (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading adjustments...</p>
                </div>
              )}

              {/* Empty state */}
              {!loading && filteredAdjustments.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No adjustments found</p>
                </div>
              )}

              {/* Adjustment List */}
              {!loading && filteredAdjustments.length > 0 && (
                <div className="space-y-3">
                  {filteredAdjustments.map((adjustment) => (
                    <Card 
                      key={adjustment.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                      onClick={() => openAdjustmentDetail(adjustment)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium text-lg text-gray-900">
                                {adjustment.adjustment_number}
                              </h3>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                adjustment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                adjustment.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {adjustment.status.toUpperCase()}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {new Date(adjustment.adjustment_date).toLocaleDateString()}
                              </div>
                              <div>
                                {adjustment.lines.length} line{adjustment.lines.length !== 1 ? 's' : ''}
                              </div>
                            </div>

                            {adjustment.notes && (
                              <p className="text-sm text-gray-700 truncate">
                                {adjustment.notes}
                              </p>
                            )}

                            {/* Summary of affected items */}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {adjustment.lines.slice(0, 3).map((line) => (
                                <span 
                                  key={line.id}
                                  className="px-2 py-1 bg-gray-100 text-xs rounded"
                                >
                                  {line.inventory.products.sku}: {line.quantity_adjustment > 0 ? '+' : ''}{line.quantity_adjustment}
                                </span>
                              ))}
                              {adjustment.lines.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-xs rounded">
                                  +{adjustment.lines.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <Eye className="h-5 w-5 text-gray-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Detail View */
            selectedAdjustment && (
              <div className="p-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Adjustment Details</CardTitle>
                        <CardDescription>
                          {selectedAdjustment.notes || 'No additional notes'}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Adjustment Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Date</label>
                        <p className="text-sm text-gray-900">
                          {new Date(selectedAdjustment.adjustment_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Status</label>
                        <p className="text-sm text-gray-900 capitalize">
                          {selectedAdjustment.status}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Total Lines</label>
                        <p className="text-sm text-gray-900">
                          {selectedAdjustment.lines.length}
                        </p>
                      </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 bg-gray-50">
                            <th className="text-left py-3 px-3 font-medium text-gray-700">Product</th>
                            <th className="text-right py-3 px-3 font-medium text-gray-700">Previous</th>
                            <th className="text-right py-3 px-3 font-medium text-gray-700">Adjustment</th>
                            <th className="text-right py-3 px-3 font-medium text-gray-700">New Qty</th>
                            <th className="text-left py-3 px-3 font-medium text-gray-700">Reason</th>
                            <th className="text-left py-3 px-3 font-medium text-gray-700">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAdjustment.lines.map((line) => (
                            <tr key={line.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-3">
                                <div>
                                  <div className="font-medium text-sm">{line.inventory.products.sku}</div>
                                  <div className="text-gray-600 text-sm">{line.inventory.products.name}</div>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-sm">
                                {line.previous_quantity.toFixed(2)} {line.inventory.products.unit_of_measure}
                              </td>
                              <td className={`py-3 px-3 text-right font-mono text-sm font-medium ${
                                line.quantity_adjustment > 0 ? 'text-green-600' : 
                                line.quantity_adjustment < 0 ? 'text-red-600' : ''
                              }`}>
                                {line.quantity_adjustment > 0 ? '+' : ''}{line.quantity_adjustment.toFixed(2)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-sm">
                                {line.new_quantity.toFixed(2)} {line.inventory.products.unit_of_measure}
                              </td>
                              <td className="py-3 px-3 text-sm">
                                {reasonCodeLabels[line.reason_code] || line.reason_code}
                              </td>
                              <td className="py-3 px-3 text-sm text-gray-600">
                                {line.line_notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50 flex-shrink-0">
          <p className="text-sm text-gray-600">
            {view === 'list' 
              ? `${filteredAdjustments.length} adjustment${filteredAdjustments.length !== 1 ? 's' : ''} found`
              : selectedAdjustment ? `Adjustment ${selectedAdjustment.adjustment_number}` : ''
            }
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}