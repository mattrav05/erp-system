'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { X } from 'lucide-react'

interface Vendor {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  vendor_type: 'SUPPLIER' | 'SERVICE_PROVIDER' | 'CONTRACTOR' | null
  payment_terms: string | null
  tax_id: string | null
  preferred_currency: string | null
  lead_time_days: number | null
  minimum_order: number | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface NewVendor {
  company_name: string
  contact_name: string
  email: string
  phone: string
  website: string
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  zip_code: string
  country: string
  vendor_type: 'SUPPLIER' | 'SERVICE_PROVIDER' | 'CONTRACTOR'
  payment_terms: string
  tax_id: string
  preferred_currency: string
  lead_time_days: number | null
  minimum_order: number | null
  notes: string
  is_active: boolean
}

interface AddVendorModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (vendor: NewVendor) => void
  onUpdate?: (vendor: NewVendor & { id: string }) => void
  onDelete?: (id: string) => void
  editingVendor?: Vendor | null
}

export default function AddVendorModal({ isOpen, onClose, onAdd, onUpdate, onDelete, editingVendor }: AddVendorModalProps) {
  const [formData, setFormData] = useState<NewVendor>({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'USA',
    vendor_type: 'SUPPLIER',
    payment_terms: 'NET30',
    tax_id: '',
    preferred_currency: 'USD',
    lead_time_days: null,
    minimum_order: null,
    notes: '',
    is_active: true
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Populate form when editing a vendor
  useEffect(() => {
    if (editingVendor) {
      setFormData({
        company_name: editingVendor.company_name,
        contact_name: editingVendor.contact_name || '',
        email: editingVendor.email || '',
        phone: editingVendor.phone || '',
        website: editingVendor.website || '',
        address_line_1: editingVendor.address_line_1 || '',
        address_line_2: editingVendor.address_line_2 || '',
        city: editingVendor.city || '',
        state: editingVendor.state || '',
        zip_code: editingVendor.zip_code || '',
        country: editingVendor.country || 'USA',
        vendor_type: editingVendor.vendor_type || 'SUPPLIER',
        payment_terms: editingVendor.payment_terms || 'NET30',
        tax_id: editingVendor.tax_id || '',
        preferred_currency: editingVendor.preferred_currency || 'USD',
        lead_time_days: editingVendor.lead_time_days,
        minimum_order: editingVendor.minimum_order,
        notes: editingVendor.notes || '',
        is_active: editingVendor.is_active
      })
    } else {
      // Reset form for new vendor
      setFormData({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        website: '',
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        zip_code: '',
        country: 'USA',
        vendor_type: 'SUPPLIER',
        payment_terms: 'NET30',
        tax_id: '',
        preferred_currency: 'USD',
        lead_time_days: null,
        minimum_order: null,
        notes: '',
        is_active: true
      })
    }
    setErrors({})
  }, [editingVendor, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    const newErrors: Record<string, string> = {}
    
    if (!formData.company_name.trim()) newErrors.company_name = 'Company name is required'
    if (formData.email && !formData.email.includes('@')) newErrors.email = 'Valid email is required'
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length === 0) {
      if (editingVendor && onUpdate) {
        // Update existing vendor
        onUpdate({ ...formData, id: editingVendor.id })
      } else {
        // Add new vendor
        onAdd(formData)
      }
      onClose()
    }
  }

  const handleInputChange = (field: keyof NewVendor, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-row items-center justify-between p-6 border-b bg-white">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {editingVendor ? 'Update vendor information' : 'Add a new vendor to your database'}
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
                <CardDescription>Primary vendor details and contact information</CardDescription>
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
                      placeholder="e.g., ACME Suppliers Inc."
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
                      placeholder="e.g., contact@vendor.com"
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

                  {/* Website */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <Input
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      placeholder="e.g., www.vendor.com"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  {/* Vendor Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor Type
                    </label>
                    <select
                      value={formData.vendor_type}
                      onChange={(e) => handleInputChange('vendor_type', e.target.value as 'SUPPLIER' | 'SERVICE_PROVIDER' | 'CONTRACTOR')}
                      className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="SUPPLIER">Supplier</option>
                      <option value="SERVICE_PROVIDER">Service Provider</option>
                      <option value="CONTRACTOR">Contractor</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Address Information</CardTitle>
                <CardDescription>Vendor's business address</CardDescription>
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
                      placeholder="e.g., 123 Industrial Blvd"
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
                      placeholder="e.g., Building C, Unit 5"
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
                      placeholder="e.g., Manufacturing City"
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
                      placeholder="e.g., CA"
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
                      placeholder="e.g., 12345"
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
                <CardDescription>Payment terms, lead times, and business details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Payment Terms */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Terms
                    </label>
                    <select
                      value={formData.payment_terms}
                      onChange={(e) => handleInputChange('payment_terms', e.target.value)}
                      className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="COD">Cash on Delivery (COD)</option>
                      <option value="NET15">Net 15 days</option>
                      <option value="NET30">Net 30 days</option>
                      <option value="NET45">Net 45 days</option>
                      <option value="NET60">Net 60 days</option>
                      <option value="PREPAID">Prepaid</option>
                    </select>
                  </div>

                  {/* Tax ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax ID / EIN
                    </label>
                    <Input
                      value={formData.tax_id}
                      onChange={(e) => handleInputChange('tax_id', e.target.value)}
                      placeholder="e.g., 12-3456789"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  {/* Preferred Currency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preferred Currency
                    </label>
                    <select
                      value={formData.preferred_currency}
                      onChange={(e) => handleInputChange('preferred_currency', e.target.value)}
                      className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                    </select>
                  </div>

                  {/* Lead Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lead Time (Days)
                    </label>
                    <Input
                      type="number"
                      value={formData.lead_time_days || ''}
                      onChange={(e) => handleInputChange('lead_time_days', e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="e.g., 14"
                      min="0"
                      className="bg-white border-gray-300"
                    />
                  </div>

                  {/* Minimum Order */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Order Amount
                    </label>
                    <Input
                      type="number"
                      value={formData.minimum_order || ''}
                      onChange={(e) => handleInputChange('minimum_order', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="e.g., 1000"
                      min="0"
                      step="0.01"
                      className="bg-white border-gray-300"
                    />
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
                      Active Vendor
                    </label>
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
                    placeholder="Additional notes about this vendor..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Buttons */}
            <div className="flex justify-between pt-4 border-t border-gray-200">
              <div>
                {editingVendor && onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this vendor? This action cannot be undone.')) {
                        onDelete(editingVendor.id)
                        onClose()
                      }
                    }}
                    className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Delete Vendor
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
                  {editingVendor ? 'Update Vendor' : 'Add Vendor'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}