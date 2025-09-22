'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import TermsSelector from '@/components/ui/terms-selector'

interface Customer {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  customer_type: 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR' | null
  payment_terms: string | null
  payment_terms_id: string | null
  credit_limit: number | null
  tax_exempt: boolean
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface NewCustomer {
  company_name: string
  contact_name: string
  email: string
  phone: string
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  zip_code: string
  country: string
  customer_type: 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR'
  payment_terms: string
  payment_terms_id: string | null
  credit_limit: number | null
  tax_exempt: boolean
  notes: string
  is_active: boolean
}

interface AddCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (customer: NewCustomer) => void
  onUpdate?: (customer: NewCustomer & { id: string }) => void
  onDelete?: (id: string) => void
  editingCustomer?: Customer | null
}

export default function AddCustomerModal({ isOpen, onClose, onAdd, onUpdate, onDelete, editingCustomer }: AddCustomerModalProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState<NewCustomer>({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'USA',
    customer_type: 'RETAIL',
    payment_terms: 'Net 30',
    payment_terms_id: null,
    credit_limit: null,
    tax_exempt: false,
    notes: '',
    is_active: true
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Handle input changes
  const handleInputChange = (field: keyof NewCustomer, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field as string]: '' }))
    }
  }

  // Handle terms selection - convert term name to ID for database storage
  const handleTermsChange = async (termsName: string) => {
    setFormData(prev => ({ ...prev, payment_terms: termsName }))
    
    // Lookup the payment_terms_id for this term name
    try {
      const { data } = await supabase
        .from('payment_terms')
        .select('id')
        .eq('name', termsName)
        .single()
      
      if (data) {
        setFormData(prev => ({ ...prev, payment_terms_id: data.id }))
      } else {
        setFormData(prev => ({ ...prev, payment_terms_id: null }))
      }
    } catch (error) {
      console.error('Error looking up payment terms:', error)
      setFormData(prev => ({ ...prev, payment_terms_id: null }))
    }
  }

  // Populate form when editing a customer
  useEffect(() => {
    if (editingCustomer) {
      setFormData({
        company_name: editingCustomer.company_name || '',
        contact_name: editingCustomer.contact_name || '',
        email: editingCustomer.email || '',
        phone: editingCustomer.phone || '',
        address_line_1: editingCustomer.address_line_1 || '',
        address_line_2: editingCustomer.address_line_2 || '',
        city: editingCustomer.city || '',
        state: editingCustomer.state || '',
        zip_code: editingCustomer.zip_code || '',
        country: editingCustomer.country || 'USA',
        customer_type: editingCustomer.customer_type || 'RETAIL',
        payment_terms: editingCustomer.payment_terms || 'Net 30',
        payment_terms_id: editingCustomer.payment_terms_id || null,
        credit_limit: editingCustomer.credit_limit || null,
        tax_exempt: editingCustomer.tax_exempt || false,
        notes: editingCustomer.notes || '',
        is_active: editingCustomer.is_active ?? true
      })
    } else {
      // Reset form for new customer
      setFormData({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        zip_code: '',
        country: 'USA',
        customer_type: 'RETAIL',
        payment_terms: 'Net 30',
        payment_terms_id: null,
        credit_limit: null,
        tax_exempt: false,
        notes: '',
        is_active: true
      })
    }
    setErrors({})
  }, [editingCustomer, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    const newErrors: Record<string, string> = {}
    
    if (!formData.company_name.trim()) newErrors.company_name = 'Company name is required'
    if (formData.email && !formData.email.includes('@')) newErrors.email = 'Valid email is required'
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length === 0) {
      if (editingCustomer && onUpdate) {
        // Update existing customer
        onUpdate({ ...formData, id: editingCustomer.id })
      } else {
        // Add new customer
        onAdd(formData)
      }
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-row items-center justify-between p-6 border-b bg-white">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {editingCustomer ? 'Update customer information' : 'Add a new customer to your database'}
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
                <CardDescription>Primary customer details and contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Company Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => handleInputChange('company_name', e.target.value)}
                      placeholder="e.g., ABC Corporation"
                      className={`bg-white ${errors.company_name ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name}</p>}
                  </div>

                  {/* Contact Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Name
                    </label>
                    <Input
                      value={formData.contact_name}
                      onChange={(e) => handleInputChange('contact_name', e.target.value)}
                      placeholder="e.g., John Smith"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="e.g., contact@company.com"
                      className={`bg-white ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="e.g., (555) 123-4567"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  {/* Customer Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Type
                    </label>
                    <select
                      value={formData.customer_type}
                      onChange={(e) => handleInputChange('customer_type', e.target.value as 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR')}
                      className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="RETAIL">Retail</option>
                      <option value="WHOLESALE">Wholesale</option>
                      <option value="DISTRIBUTOR">Distributor</option>
                    </select>
                  </div>

                  {/* Payment Terms */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Terms
                    </label>
                    <TermsSelector
                      value={formData.payment_terms}
                      onChange={handleTermsChange}
                      placeholder="Select payment terms..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Address Information</CardTitle>
                <CardDescription>Customer's billing and shipping address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Address Line 1 */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 1
                    </label>
                    <Input
                      value={formData.address_line_1}
                      onChange={(e) => handleInputChange('address_line_1', e.target.value)}
                      placeholder="e.g., 123 Main Street"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  {/* Address Line 2 */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 2
                    </label>
                    <Input
                      value={formData.address_line_2}
                      onChange={(e) => handleInputChange('address_line_2', e.target.value)}
                      placeholder="e.g., Suite 100, Apt 2B"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <Input
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="e.g., New York"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State/Province
                    </label>
                    <Input
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      placeholder="e.g., NY"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  {/* ZIP Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP/Postal Code
                    </label>
                    <Input
                      value={formData.zip_code}
                      onChange={(e) => handleInputChange('zip_code', e.target.value)}
                      placeholder="e.g., 10001"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  {/* Country */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <Input
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      placeholder="e.g., USA"
                      className="bg-white border-gray-300"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Business Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Business Information</CardTitle>
                <CardDescription>Credit limits, tax status, and additional details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Credit Limit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Credit Limit
                    </label>
                    <Input
                      type="number"
                      value={formData.credit_limit === null ? '' : formData.credit_limit}
                      onChange={(e) => handleInputChange('credit_limit', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="e.g., 50000"
                      min="0"
                      step="0.01"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    {/* Tax Exempt */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="tax_exempt"
                        checked={formData.tax_exempt}
                        onChange={(e) => handleInputChange('tax_exempt', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="tax_exempt" className="text-sm text-gray-700">
                        Tax Exempt
                      </label>
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => handleInputChange('is_active', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="is_active" className="text-sm text-gray-700">
                        Active Customer
                      </label>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes about this customer..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Buttons */}
            <div className="flex justify-between pt-4 border-t border-gray-200">
              <div>
                {editingCustomer && onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
                        onDelete(editingCustomer.id)
                        onClose()
                      }
                    }}
                    className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Delete Customer
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
                  {editingCustomer ? 'Update Customer' : 'Add Customer'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}