'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { X, Plus, Edit, Trash2, Save, Check, AlertTriangle, DollarSign, Calendar } from 'lucide-react'

interface PaymentTerm {
  id: string
  name: string
  description: string
  net_days: number
  discount_percent: number
  discount_days: number
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

interface TermsEditorProps {
  onClose: () => void
  onTermCreated?: (term: PaymentTerm) => void
}

export default function TermsEditor({ onClose, onTermCreated }: TermsEditorProps) {
  const [terms, setTerms] = useState<PaymentTerm[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingTerm, setEditingTerm] = useState<PaymentTerm | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    net_days: 30,
    discount_percent: 0,
    discount_days: 0,
    is_active: true,
    is_default: false
  })

  useEffect(() => {
    fetchTerms()
  }, [])

  const fetchTerms = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .order('name')

      if (error) throw error
      setTerms(data || [])
    } catch (error) {
      console.error('Error fetching payment terms:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      net_days: 30,
      discount_percent: 0,
      discount_days: 0,
      is_active: true,
      is_default: false
    })
    setEditingTerm(null)
    setIsCreating(false)
  }

  const handleEdit = (term: PaymentTerm) => {
    setEditingTerm(term)
    setFormData({
      name: term.name,
      description: term.description || '',
      net_days: term.net_days,
      discount_percent: term.discount_percent || 0,
      discount_days: term.discount_days || 0,
      is_active: term.is_active,
      is_default: term.is_default
    })
    setIsCreating(false)
  }

  const handleCreate = () => {
    resetForm()
    setIsCreating(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a name for the payment terms')
      return
    }

    setIsSaving(true)
    try {
      if (editingTerm) {
        // Update existing term
        const { error } = await supabase
          .from('payment_terms')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim(),
            net_days: formData.net_days,
            discount_percent: formData.discount_percent,
            discount_days: formData.discount_days,
            is_active: formData.is_active,
            is_default: formData.is_default,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTerm.id)

        if (error) throw error
      } else {
        // Create new term
        const { data, error } = await supabase
          .from('payment_terms')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim(),
            net_days: formData.net_days,
            discount_percent: formData.discount_percent,
            discount_days: formData.discount_days,
            is_active: formData.is_active,
            is_default: formData.is_default
          })
          .select()
          .single()

        if (error) throw error
        
        if (data && onTermCreated) {
          onTermCreated(data)
        }
      }

      await fetchTerms()
      resetForm()
    } catch (error: any) {
      console.error('Error saving payment terms:', error)
      alert(`Error saving payment terms: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (term: PaymentTerm) => {
    if (!confirm(`Are you sure you want to delete "${term.name}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('payment_terms')
        .delete()
        .eq('id', term.id)

      if (error) throw error
      await fetchTerms()
    } catch (error: any) {
      console.error('Error deleting payment terms:', error)
      alert(`Error deleting payment terms: ${error.message}`)
    }
  }

  const handleToggleActive = async (term: PaymentTerm) => {
    try {
      const { error } = await supabase
        .from('payment_terms')
        .update({ 
          is_active: !term.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', term.id)

      if (error) throw error
      await fetchTerms()
    } catch (error: any) {
      console.error('Error updating payment terms:', error)
      alert(`Error updating payment terms: ${error.message}`)
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment terms...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold">Payment Terms Manager</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleCreate} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add New Terms
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Terms List */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Existing Terms</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {terms.map(term => (
                  <Card key={term.id} className={`${!term.is_active ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{term.name}</h4>
                            {term.is_default && (
                              <Badge variant="outline" className="text-xs">Default</Badge>
                            )}
                            {!term.is_active && (
                              <Badge variant="outline" className="text-xs bg-gray-100">Inactive</Badge>
                            )}
                          </div>
                          {term.description && (
                            <p className="text-sm text-gray-600 mb-2">{term.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {term.net_days} days
                            </span>
                            {term.discount_percent > 0 && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                {term.discount_percent}% / {term.discount_days}d
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleEdit(term)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleToggleActive(term)}
                            className="h-8 w-8 p-0"
                          >
                            {term.is_active ? 
                              <Check className="w-3 h-3 text-green-600" /> : 
                              <AlertTriangle className="w-3 h-3 text-gray-400" />
                            }
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleDelete(term)}
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Form */}
            {(isCreating || editingTerm) && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">
                  {editingTerm ? 'Edit Payment Terms' : 'Create New Payment Terms'}
                </h3>
                
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name *
                      </label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Net 30, 2/10 Net 30"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Full description of the payment terms"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Net Days *
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.net_days}
                          onChange={(e) => setFormData(prev => ({ ...prev, net_days: parseInt(e.target.value) || 0 }))}
                        />
                        <p className="text-xs text-gray-500 mt-1">Days customer has to pay</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Discount %
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={formData.discount_percent}
                          onChange={(e) => setFormData(prev => ({ ...prev, discount_percent: parseFloat(e.target.value) || 0 }))}
                        />
                        <p className="text-xs text-gray-500 mt-1">Early payment discount</p>
                      </div>
                    </div>

                    {formData.discount_percent > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Discount Days
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.discount_days}
                          onChange={(e) => setFormData(prev => ({ ...prev, discount_days: parseInt(e.target.value) || 0 }))}
                        />
                        <p className="text-xs text-gray-500 mt-1">Days within which discount applies</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                          className="rounded"
                        />
                        <span className="text-sm">Active</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.is_default}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                          className="rounded"
                        />
                        <span className="text-sm">Default terms</span>
                      </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={isSaving}>
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}