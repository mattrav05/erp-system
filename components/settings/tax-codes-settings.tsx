'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Edit, Receipt, Percent, FileX } from 'lucide-react'

interface TaxCode {
  id: string
  code: string
  description: string
  tax_rate: number
  is_active: boolean
  is_default: boolean
  created_at: string
}

export default function TaxCodesManagement() {
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTaxCode, setEditingTaxCode] = useState<TaxCode | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    tax_rate: 0,
    is_active: true,
    is_default: false
  })

  useEffect(() => {
    fetchTaxCodes()
  }, [])

  const fetchTaxCodes = async () => {
    try {
      const { data: existingCodes, error } = await supabase
        .from('tax_codes')
        .select('*')
        .order('code')

      if (error) {
        console.error('Error fetching tax codes:', error)
        // Fall back to default codes
        setTaxCodes(getDefaultTaxCodes())
      } else {
        setTaxCodes(existingCodes || [])
      }
    } catch (error) {
      console.error('Error fetching tax codes:', error)
      // Fall back to default codes
      setTaxCodes(getDefaultTaxCodes())
    } finally {
      setIsLoading(false)
    }
  }

  const getDefaultTaxCodes = (): TaxCode[] => [
    {
      id: '1',
      code: 'TAX',
      description: 'Standard Tax',
      tax_rate: 8.5,
      is_active: true,
      is_default: true,
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      code: 'NON',
      description: 'Non-Taxable',
      tax_rate: 0,
      is_active: true,
      is_default: false,
      created_at: new Date().toISOString()
    },
    {
      id: '3',
      code: 'EXE',
      description: 'Tax Exempt',
      tax_rate: 0,
      is_active: true,
      is_default: false,
      created_at: new Date().toISOString()
    }
  ]

  const handleAdd = () => {
    setFormData({
      code: '',
      description: '',
      tax_rate: 0,
      is_active: true,
      is_default: false
    })
    setEditingTaxCode(null)
    setShowAddModal(true)
  }

  const handleEdit = (taxCode: TaxCode) => {
    setFormData({
      code: taxCode.code,
      description: taxCode.description,
      tax_rate: taxCode.tax_rate,
      is_active: taxCode.is_active,
      is_default: taxCode.is_default
    })
    setEditingTaxCode(taxCode)
    setShowAddModal(true)
  }

  const handleSave = async () => {
    try {
      if (editingTaxCode) {
        // Update existing tax code in database
        const { data, error } = await supabase
          .from('tax_codes')
          .update(formData)
          .eq('id', editingTaxCode.id)
          .select()
          .single()

        if (error) throw error

        setTaxCodes(prev => prev.map(tc => 
          tc.id === editingTaxCode.id ? data : tc
        ))
      } else {
        // Add new tax code to database
        const { data, error } = await supabase
          .from('tax_codes')
          .insert([formData])
          .select()
          .single()

        if (error) throw error

        setTaxCodes(prev => [...prev, data])
      }
      
      setShowAddModal(false)
      setEditingTaxCode(null)
    } catch (error) {
      console.error('Error saving tax code:', error)
      alert('Failed to save tax code. Please try again.')
    }
  }

  const handleDelete = async (taxCode: TaxCode) => {
    if (!confirm(`Are you sure you want to delete tax code "${taxCode.code}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('tax_codes')
        .delete()
        .eq('id', taxCode.id)

      if (error) throw error

      setTaxCodes(prev => prev.filter(tc => tc.id !== taxCode.id))
    } catch (error) {
      console.error('Error deleting tax code:', error)
      alert('Failed to delete tax code. Please try again.')
    }
  }

  const handleSetDefault = async (taxCode: TaxCode) => {
    try {
      // First, unset all defaults
      const { error: clearError } = await supabase
        .from('tax_codes')
        .update({ is_default: false })
        .neq('id', taxCode.id)

      if (clearError) throw clearError

      // Then set the new default
      const { error: setError } = await supabase
        .from('tax_codes')
        .update({ is_default: true })
        .eq('id', taxCode.id)

      if (setError) throw setError

      setTaxCodes(prev => prev.map(tc => ({
        ...tc,
        is_default: tc.id === taxCode.id
      })))
    } catch (error) {
      console.error('Error setting default tax code:', error)
      alert('Failed to set default tax code. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading tax codes...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Tax Codes</h2>
          <p className="text-gray-600">Manage tax rates and tax categories for your line items</p>
        </div>
        <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Tax Code
        </Button>
      </div>

      {/* Tax Codes List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Rate</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {taxCodes.map((taxCode) => (
                  <tr key={taxCode.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 mr-3">
                          {taxCode.tax_rate > 0 ? (
                            <Receipt className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <FileX className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="text-sm font-medium text-gray-900">{taxCode.code}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{taxCode.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end">
                        {taxCode.tax_rate > 0 && <Percent className="w-3 h-3 text-gray-400 mr-1" />}
                        <span className="text-sm font-medium text-gray-900">
                          {taxCode.tax_rate > 0 ? taxCode.tax_rate.toFixed(2) : '0.00'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        taxCode.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {taxCode.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {taxCode.is_default ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          Default
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetDefault(taxCode)}
                          className="text-xs"
                        >
                          Set Default
                        </Button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(taxCode)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(taxCode)}
                        className="text-red-600 hover:text-red-900"
                        disabled={taxCode.is_default}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Tax Code Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">
                {editingTaxCode ? 'Edit Tax Code' : 'Add New Tax Code'}
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddModal(false)}
              >
                ×
              </Button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Code *
                </label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., TAX, NON, EXE"
                  maxLength={10}
                />
                <p className="text-xs text-gray-500 mt-1">Short code used in dropdowns (max 10 characters)</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Standard Sales Tax"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Rate (%)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="pr-8"
                  />
                  <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Enter 0 for non-taxable items</p>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Set as default tax code</span>
                </label>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={!formData.code.trim() || !formData.description.trim()}
              >
                {editingTaxCode ? 'Update' : 'Add'} Tax Code
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}