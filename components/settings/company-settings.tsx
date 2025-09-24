'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Save, Building2, MapPin, Phone, Mail, FileText, CreditCard } from 'lucide-react'
import { toast } from 'react-hot-toast'

type CompanySettings = any

export default function CompanySettings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      
      if (data) {
        setSettings(data)
      } else {
        // Create default settings if none exist
        const { data: newSettings, error: createError } = await supabase
          .from('company_settings')
          .insert({
            company_name: 'Your Company Name',
            billing_address_line_1: '123 Main Street',
            billing_city: 'City',
            billing_state: 'ST',
            billing_zip_code: '12345',
            billing_phone: '(555) 123-4567',
            billing_email: 'billing@yourcompany.com',
            shipping_address_line_1: '123 Warehouse Drive',
            shipping_city: 'City',
            shipping_state: 'ST',
            shipping_zip_code: '12345',
            shipping_phone: '(555) 123-4568',
            shipping_attention: 'Receiving Department',
            default_payment_terms: 'Net 30',
            is_active: true
          })
          .select()
          .single()

        if (createError) throw createError
        setSettings(newSettings)
      }
    } catch (error) {
      console.error('Error fetching company settings:', error)
      toast.error('Failed to load company settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          company_name: settings.company_name,
          company_logo_url: settings.company_logo_url,
          billing_address_line_1: settings.billing_address_line_1,
          billing_address_line_2: settings.billing_address_line_2,
          billing_city: settings.billing_city,
          billing_state: settings.billing_state,
          billing_zip_code: settings.billing_zip_code,
          billing_country: settings.billing_country,
          billing_phone: settings.billing_phone,
          billing_email: settings.billing_email,
          shipping_address_line_1: settings.shipping_address_line_1,
          shipping_address_line_2: settings.shipping_address_line_2,
          shipping_city: settings.shipping_city,
          shipping_state: settings.shipping_state,
          shipping_zip_code: settings.shipping_zip_code,
          shipping_country: settings.shipping_country,
          shipping_phone: settings.shipping_phone,
          shipping_email: settings.shipping_email,
          shipping_attention: settings.shipping_attention,
          tax_id: settings.tax_id,
          business_registration_number: settings.business_registration_number,
          default_payment_terms: settings.default_payment_terms
        })
        .eq('id', settings.id)

      if (error) throw error
      
      toast.success('Company settings saved successfully')
    } catch (error) {
      console.error('Error saving company settings:', error)
      toast.error('Failed to save company settings')
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (field: keyof CompanySettings, value: any) => {
    if (settings) {
      setSettings({ ...settings, [field]: value })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading company settings...</div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No company settings found</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Company Settings</h2>
        <p className="text-gray-600">Configure your company information for purchase orders and other documents</p>
      </div>

      <div className="space-y-6">
        {/* Company Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <Building2 className="w-5 h-5 mr-2 text-gray-700" />
            <h3 className="text-lg font-semibold">Company Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Company Name *</label>
              <Input
                value={settings.company_name}
                onChange={(e) => updateField('company_name', e.target.value)}
                placeholder="Your Company Name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Logo URL</label>
              <Input
                value={settings.company_logo_url || ''}
                onChange={(e) => updateField('company_logo_url', e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Tax ID</label>
              <Input
                value={settings.tax_id || ''}
                onChange={(e) => updateField('tax_id', e.target.value)}
                placeholder="XX-XXXXXXX"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Business Registration Number</label>
              <Input
                value={settings.business_registration_number || ''}
                onChange={(e) => updateField('business_registration_number', e.target.value)}
                placeholder="Registration number"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Default Payment Terms</label>
              <Input
                value={settings.default_payment_terms || ''}
                onChange={(e) => updateField('default_payment_terms', e.target.value)}
                placeholder="Net 30"
              />
            </div>
          </div>
        </div>

        {/* Billing Address */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <CreditCard className="w-5 h-5 mr-2 text-gray-700" />
            <h3 className="text-lg font-semibold">Billing Address</h3>
            <span className="ml-2 text-sm text-gray-500">(Where vendors send invoices)</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Address Line 1</label>
              <Input
                value={settings.billing_address_line_1 || ''}
                onChange={(e) => updateField('billing_address_line_1', e.target.value)}
                placeholder="123 Main Street"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Address Line 2</label>
              <Input
                value={settings.billing_address_line_2 || ''}
                onChange={(e) => updateField('billing_address_line_2', e.target.value)}
                placeholder="Suite 100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <Input
                value={settings.billing_city || ''}
                onChange={(e) => updateField('billing_city', e.target.value)}
                placeholder="City"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <Input
                value={settings.billing_state || ''}
                onChange={(e) => updateField('billing_state', e.target.value)}
                placeholder="ST"
                maxLength={2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">ZIP Code</label>
              <Input
                value={settings.billing_zip_code || ''}
                onChange={(e) => updateField('billing_zip_code', e.target.value)}
                placeholder="12345"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <Input
                value={settings.billing_country || 'USA'}
                onChange={(e) => updateField('billing_country', e.target.value)}
                placeholder="USA"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <Input
                value={settings.billing_phone || ''}
                onChange={(e) => updateField('billing_phone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                value={settings.billing_email || ''}
                onChange={(e) => updateField('billing_email', e.target.value)}
                placeholder="billing@yourcompany.com"
                type="email"
              />
            </div>
          </div>
        </div>

        {/* Shipping/Receiving Address */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <MapPin className="w-5 h-5 mr-2 text-gray-700" />
            <h3 className="text-lg font-semibold">Shipping/Receiving Address</h3>
            <span className="ml-2 text-sm text-gray-500">(Where vendors deliver goods)</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Attention To</label>
              <Input
                value={settings.shipping_attention || ''}
                onChange={(e) => updateField('shipping_attention', e.target.value)}
                placeholder="Receiving Department"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Address Line 1</label>
              <Input
                value={settings.shipping_address_line_1 || ''}
                onChange={(e) => updateField('shipping_address_line_1', e.target.value)}
                placeholder="123 Warehouse Drive"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Address Line 2</label>
              <Input
                value={settings.shipping_address_line_2 || ''}
                onChange={(e) => updateField('shipping_address_line_2', e.target.value)}
                placeholder="Building A"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <Input
                value={settings.shipping_city || ''}
                onChange={(e) => updateField('shipping_city', e.target.value)}
                placeholder="City"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <Input
                value={settings.shipping_state || ''}
                onChange={(e) => updateField('shipping_state', e.target.value)}
                placeholder="ST"
                maxLength={2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">ZIP Code</label>
              <Input
                value={settings.shipping_zip_code || ''}
                onChange={(e) => updateField('shipping_zip_code', e.target.value)}
                placeholder="12345"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <Input
                value={settings.shipping_country || 'USA'}
                onChange={(e) => updateField('shipping_country', e.target.value)}
                placeholder="USA"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <Input
                value={settings.shipping_phone || ''}
                onChange={(e) => updateField('shipping_phone', e.target.value)}
                placeholder="(555) 123-4568"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                value={settings.shipping_email || ''}
                onChange={(e) => updateField('shipping_email', e.target.value)}
                placeholder="receiving@yourcompany.com"
                type="email"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
}