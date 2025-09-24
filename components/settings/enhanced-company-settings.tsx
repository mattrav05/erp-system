'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import {
  Save, Building2, MapPin, Phone, Mail, FileText, CreditCard,
  Globe, Shield, Palette, Settings, Users, Truck, DollarSign,
  Award, Link, Calendar, Clock
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface EnhancedCompanySettings {
  id?: string
  created_at?: string
  updated_at?: string
  created_by?: string
  is_active?: boolean

  // Basic Company Information
  company_name: string
  legal_business_name?: string
  dba_name?: string
  company_logo_url?: string
  company_tagline?: string
  company_website?: string

  // Business Registration & Tax Information
  business_registration_number?: string
  tax_id?: string
  state_tax_id?: string
  sales_tax_license?: string
  reseller_permit?: string
  duns_number?: string

  // Industry & Business Type
  industry?: string
  business_type?: string
  sic_code?: string
  naics_code?: string

  // Primary Business Address (Legal/Mailing)
  business_address_line_1?: string
  business_address_line_2?: string
  business_city?: string
  business_state?: string
  business_zip_code?: string
  business_country?: string

  // Billing Address
  billing_address_line_1?: string
  billing_address_line_2?: string
  billing_city?: string
  billing_state?: string
  billing_zip_code?: string
  billing_country?: string
  billing_phone?: string
  billing_email?: string

  // Shipping/Receiving Address
  shipping_address_line_1?: string
  shipping_address_line_2?: string
  shipping_city?: string
  shipping_state?: string
  shipping_zip_code?: string
  shipping_country?: string
  shipping_phone?: string
  shipping_email?: string
  shipping_attention?: string
  shipping_instructions?: string

  // Contact Information
  primary_phone?: string
  secondary_phone?: string
  fax_number?: string
  primary_email?: string
  accounts_payable_email?: string
  accounts_receivable_email?: string
  sales_email?: string
  support_email?: string

  // Financial Settings
  default_payment_terms?: string
  default_currency?: string
  fiscal_year_start?: number
  credit_limit?: number

  // Banking Information
  primary_bank_name?: string
  primary_bank_routing_number?: string
  primary_bank_account_number?: string
  primary_bank_account_type?: string

  // Branding
  logo_position?: string
  logo_size?: string
  brand_color_primary?: string
  brand_color_secondary?: string
  brand_color_accent?: string

  // Terms & Conditions
  default_terms_and_conditions?: string
  default_warranty_terms?: string
  default_return_policy?: string

  // Shipping & Handling
  default_shipping_method?: string
  default_shipping_terms?: string
  handling_fee_percentage?: number

  // Insurance Information
  general_liability_carrier?: string
  general_liability_policy?: string
  workers_comp_carrier?: string
  workers_comp_policy?: string

  // Social Media & Marketing
  linkedin_url?: string
  facebook_url?: string
  twitter_url?: string
  instagram_url?: string

  // System Settings
  time_zone?: string
  date_format?: string
  number_format?: string

  // Custom Fields
  custom_field_1_label?: string
  custom_field_1_value?: string
  custom_field_2_label?: string
  custom_field_2_value?: string
  custom_field_3_label?: string
  custom_field_3_value?: string

  // Notes
  internal_notes?: string
}

const defaultSettings: EnhancedCompanySettings = {
  company_name: 'Your Company Name',
  legal_business_name: '',
  primary_email: 'info@yourcompany.com',
  primary_phone: '(555) 123-4567',
  business_address_line_1: '123 Business Ave',
  business_city: 'Business City',
  business_state: 'ST',
  business_zip_code: '12345',
  business_country: 'USA',
  billing_address_line_1: '123 Business Ave',
  billing_city: 'Business City',
  billing_state: 'ST',
  billing_zip_code: '12345',
  billing_country: 'USA',
  billing_phone: '(555) 123-4567',
  billing_email: 'billing@yourcompany.com',
  shipping_address_line_1: '123 Warehouse Dr',
  shipping_city: 'Business City',
  shipping_state: 'ST',
  shipping_zip_code: '12345',
  shipping_country: 'USA',
  shipping_phone: '(555) 123-4568',
  shipping_attention: 'Receiving Department',
  default_payment_terms: 'Net 30',
  default_currency: 'USD',
  fiscal_year_start: 1,
  logo_position: 'left',
  logo_size: 'medium',
  brand_color_primary: '#1f2937',
  brand_color_secondary: '#6b7280',
  brand_color_accent: '#3b82f6',
  time_zone: 'America/New_York',
  date_format: 'MM/DD/YYYY',
  number_format: 'US',
  is_active: true
}

export default function EnhancedCompanySettings() {
  const [settings, setSettings] = useState<EnhancedCompanySettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      // Try to fetch from the new enhanced table first, fallback to old table
      let { data, error } = await supabase
        .from('enhanced_company_settings')
        .select('*')
        .eq('is_active', true)
        .single()

      // If new table doesn't exist or has no data, try old table
      if (error?.code === '42P01' || !data) {
        const { data: oldData, error: oldError } = await supabase
          .from('company_settings')
          .select('*')
          .eq('is_active', true)
          .single()

        if (oldData) {
          // Map old data to new structure
          data = {
            ...defaultSettings,
            ...oldData,
            business_address_line_1: oldData.billing_address_line_1,
            business_address_line_2: oldData.billing_address_line_2,
            business_city: oldData.billing_city,
            business_state: oldData.billing_state,
            business_zip_code: oldData.billing_zip_code,
            business_country: oldData.billing_country,
            primary_phone: oldData.billing_phone,
            primary_email: oldData.billing_email
          }
        }
      }

      if (data) {
        setSettings({ ...defaultSettings, ...data })
      } else {
        setSettings(defaultSettings)
      }
    } catch (error) {
      console.error('Error fetching company settings:', error)
      toast.error('Failed to load company settings')
      setSettings(defaultSettings)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings.company_name?.trim()) {
      toast.error('Company name is required')
      return
    }

    setIsSaving(true)
    try {
      // Try to save to enhanced table first
      let { error } = await supabase
        .from('enhanced_company_settings')
        .upsert({
          ...settings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })

      // If enhanced table doesn't exist, create it first
      if (error?.code === '42P01') {
        toast.error('Enhanced company profile table not yet created. Please run database migration first.')
        return
      }

      if (error) throw error

      toast.success('Company settings saved successfully')
    } catch (error) {
      console.error('Error saving company settings:', error)
      toast.error('Failed to save company settings')
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (field: keyof EnhancedCompanySettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enhanced Company Profile</h1>
          <p className="text-gray-600">Complete business information for documents, templates, and operations</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={settings.company_name || ''}
                    onChange={(e) => updateField('company_name', e.target.value)}
                    placeholder="Your Company Name"
                  />
                </div>
                <div>
                  <Label htmlFor="legal_business_name">Legal Business Name</Label>
                  <Input
                    id="legal_business_name"
                    value={settings.legal_business_name || ''}
                    onChange={(e) => updateField('legal_business_name', e.target.value)}
                    placeholder="Your Company Name, LLC"
                  />
                </div>
                <div>
                  <Label htmlFor="dba_name">DBA Name</Label>
                  <Input
                    id="dba_name"
                    value={settings.dba_name || ''}
                    onChange={(e) => updateField('dba_name', e.target.value)}
                    placeholder="Doing Business As"
                  />
                </div>
                <div>
                  <Label htmlFor="company_website">Website</Label>
                  <Input
                    id="company_website"
                    value={settings.company_website || ''}
                    onChange={(e) => updateField('company_website', e.target.value)}
                    placeholder="https://yourcompany.com"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="company_tagline">Company Tagline</Label>
                <Input
                  id="company_tagline"
                  value={settings.company_tagline || ''}
                  onChange={(e) => updateField('company_tagline', e.target.value)}
                  placeholder="Your company's mission or tagline"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Business Registration & Tax
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business_type">Business Type</Label>
                  <Input
                    id="business_type"
                    value={settings.business_type || ''}
                    onChange={(e) => updateField('business_type', e.target.value)}
                    placeholder="LLC, Corp, Partnership, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={settings.industry || ''}
                    onChange={(e) => updateField('industry', e.target.value)}
                    placeholder="Manufacturing, Retail, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="tax_id">Federal Tax ID (EIN)</Label>
                  <Input
                    id="tax_id"
                    value={settings.tax_id || ''}
                    onChange={(e) => updateField('tax_id', e.target.value)}
                    placeholder="XX-XXXXXXX"
                  />
                </div>
                <div>
                  <Label htmlFor="state_tax_id">State Tax ID</Label>
                  <Input
                    id="state_tax_id"
                    value={settings.state_tax_id || ''}
                    onChange={(e) => updateField('state_tax_id', e.target.value)}
                    placeholder="State Tax ID Number"
                  />
                </div>
                <div>
                  <Label htmlFor="business_registration_number">Business Registration Number</Label>
                  <Input
                    id="business_registration_number"
                    value={settings.business_registration_number || ''}
                    onChange={(e) => updateField('business_registration_number', e.target.value)}
                    placeholder="State Registration Number"
                  />
                </div>
                <div>
                  <Label htmlFor="sales_tax_license">Sales Tax License</Label>
                  <Input
                    id="sales_tax_license"
                    value={settings.sales_tax_license || ''}
                    onChange={(e) => updateField('sales_tax_license', e.target.value)}
                    placeholder="Sales Tax License Number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addresses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Primary Business Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="business_address_line_1">Address Line 1</Label>
                  <Input
                    id="business_address_line_1"
                    value={settings.business_address_line_1 || ''}
                    onChange={(e) => updateField('business_address_line_1', e.target.value)}
                    placeholder="123 Business Avenue"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="business_address_line_2">Address Line 2</Label>
                  <Input
                    id="business_address_line_2"
                    value={settings.business_address_line_2 || ''}
                    onChange={(e) => updateField('business_address_line_2', e.target.value)}
                    placeholder="Suite 100 (optional)"
                  />
                </div>
                <div>
                  <Label htmlFor="business_city">City</Label>
                  <Input
                    id="business_city"
                    value={settings.business_city || ''}
                    onChange={(e) => updateField('business_city', e.target.value)}
                    placeholder="Business City"
                  />
                </div>
                <div>
                  <Label htmlFor="business_state">State</Label>
                  <Input
                    id="business_state"
                    value={settings.business_state || ''}
                    onChange={(e) => updateField('business_state', e.target.value)}
                    placeholder="ST"
                  />
                </div>
                <div>
                  <Label htmlFor="business_zip_code">ZIP Code</Label>
                  <Input
                    id="business_zip_code"
                    value={settings.business_zip_code || ''}
                    onChange={(e) => updateField('business_zip_code', e.target.value)}
                    placeholder="12345"
                  />
                </div>
                <div>
                  <Label htmlFor="business_country">Country</Label>
                  <Input
                    id="business_country"
                    value={settings.business_country || 'USA'}
                    onChange={(e) => updateField('business_country', e.target.value)}
                    placeholder="USA"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Billing Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="billing_address_line_1">Address Line 1</Label>
                  <Input
                    id="billing_address_line_1"
                    value={settings.billing_address_line_1 || ''}
                    onChange={(e) => updateField('billing_address_line_1', e.target.value)}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="billing_address_line_2">Address Line 2</Label>
                  <Input
                    id="billing_address_line_2"
                    value={settings.billing_address_line_2 || ''}
                    onChange={(e) => updateField('billing_address_line_2', e.target.value)}
                    placeholder="Suite 100 (optional)"
                  />
                </div>
                <div>
                  <Label htmlFor="billing_city">City</Label>
                  <Input
                    id="billing_city"
                    value={settings.billing_city || ''}
                    onChange={(e) => updateField('billing_city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="billing_state">State</Label>
                  <Input
                    id="billing_state"
                    value={settings.billing_state || ''}
                    onChange={(e) => updateField('billing_state', e.target.value)}
                    placeholder="ST"
                  />
                </div>
                <div>
                  <Label htmlFor="billing_zip_code">ZIP Code</Label>
                  <Input
                    id="billing_zip_code"
                    value={settings.billing_zip_code || ''}
                    onChange={(e) => updateField('billing_zip_code', e.target.value)}
                    placeholder="12345"
                  />
                </div>
                <div>
                  <Label htmlFor="billing_country">Country</Label>
                  <Input
                    id="billing_country"
                    value={settings.billing_country || 'USA'}
                    onChange={(e) => updateField('billing_country', e.target.value)}
                    placeholder="USA"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Shipping/Receiving Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="shipping_attention">Attention/Contact Person</Label>
                <Input
                  id="shipping_attention"
                  value={settings.shipping_attention || ''}
                  onChange={(e) => updateField('shipping_attention', e.target.value)}
                  placeholder="Receiving Department"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="shipping_address_line_1">Address Line 1</Label>
                  <Input
                    id="shipping_address_line_1"
                    value={settings.shipping_address_line_1 || ''}
                    onChange={(e) => updateField('shipping_address_line_1', e.target.value)}
                    placeholder="123 Warehouse Drive"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="shipping_address_line_2">Address Line 2</Label>
                  <Input
                    id="shipping_address_line_2"
                    value={settings.shipping_address_line_2 || ''}
                    onChange={(e) => updateField('shipping_address_line_2', e.target.value)}
                    placeholder="Loading Dock A (optional)"
                  />
                </div>
                <div>
                  <Label htmlFor="shipping_city">City</Label>
                  <Input
                    id="shipping_city"
                    value={settings.shipping_city || ''}
                    onChange={(e) => updateField('shipping_city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="shipping_state">State</Label>
                  <Input
                    id="shipping_state"
                    value={settings.shipping_state || ''}
                    onChange={(e) => updateField('shipping_state', e.target.value)}
                    placeholder="ST"
                  />
                </div>
                <div>
                  <Label htmlFor="shipping_zip_code">ZIP Code</Label>
                  <Input
                    id="shipping_zip_code"
                    value={settings.shipping_zip_code || ''}
                    onChange={(e) => updateField('shipping_zip_code', e.target.value)}
                    placeholder="12345"
                  />
                </div>
                <div>
                  <Label htmlFor="shipping_country">Country</Label>
                  <Input
                    id="shipping_country"
                    value={settings.shipping_country || 'USA'}
                    onChange={(e) => updateField('shipping_country', e.target.value)}
                    placeholder="USA"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="shipping_instructions">Special Shipping Instructions</Label>
                <Textarea
                  id="shipping_instructions"
                  value={settings.shipping_instructions || ''}
                  onChange={(e) => updateField('shipping_instructions', e.target.value)}
                  placeholder="Special delivery instructions, loading dock hours, etc."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Phone Numbers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary_phone">Primary Phone</Label>
                  <Input
                    id="primary_phone"
                    value={settings.primary_phone || ''}
                    onChange={(e) => updateField('primary_phone', e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="secondary_phone">Secondary Phone</Label>
                  <Input
                    id="secondary_phone"
                    value={settings.secondary_phone || ''}
                    onChange={(e) => updateField('secondary_phone', e.target.value)}
                    placeholder="(555) 123-4568"
                  />
                </div>
                <div>
                  <Label htmlFor="fax_number">Fax Number</Label>
                  <Input
                    id="fax_number"
                    value={settings.fax_number || ''}
                    onChange={(e) => updateField('fax_number', e.target.value)}
                    placeholder="(555) 123-4569"
                  />
                </div>
                <div>
                  <Label htmlFor="billing_phone">Billing Phone</Label>
                  <Input
                    id="billing_phone"
                    value={settings.billing_phone || ''}
                    onChange={(e) => updateField('billing_phone', e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="shipping_phone">Shipping/Receiving Phone</Label>
                  <Input
                    id="shipping_phone"
                    value={settings.shipping_phone || ''}
                    onChange={(e) => updateField('shipping_phone', e.target.value)}
                    placeholder="(555) 123-4568"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Addresses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary_email">Primary Email</Label>
                  <Input
                    id="primary_email"
                    type="email"
                    value={settings.primary_email || ''}
                    onChange={(e) => updateField('primary_email', e.target.value)}
                    placeholder="info@yourcompany.com"
                  />
                </div>
                <div>
                  <Label htmlFor="billing_email">Billing Email</Label>
                  <Input
                    id="billing_email"
                    type="email"
                    value={settings.billing_email || ''}
                    onChange={(e) => updateField('billing_email', e.target.value)}
                    placeholder="billing@yourcompany.com"
                  />
                </div>
                <div>
                  <Label htmlFor="accounts_payable_email">Accounts Payable</Label>
                  <Input
                    id="accounts_payable_email"
                    type="email"
                    value={settings.accounts_payable_email || ''}
                    onChange={(e) => updateField('accounts_payable_email', e.target.value)}
                    placeholder="ap@yourcompany.com"
                  />
                </div>
                <div>
                  <Label htmlFor="accounts_receivable_email">Accounts Receivable</Label>
                  <Input
                    id="accounts_receivable_email"
                    type="email"
                    value={settings.accounts_receivable_email || ''}
                    onChange={(e) => updateField('accounts_receivable_email', e.target.value)}
                    placeholder="ar@yourcompany.com"
                  />
                </div>
                <div>
                  <Label htmlFor="sales_email">Sales Email</Label>
                  <Input
                    id="sales_email"
                    type="email"
                    value={settings.sales_email || ''}
                    onChange={(e) => updateField('sales_email', e.target.value)}
                    placeholder="sales@yourcompany.com"
                  />
                </div>
                <div>
                  <Label htmlFor="support_email">Support Email</Label>
                  <Input
                    id="support_email"
                    type="email"
                    value={settings.support_email || ''}
                    onChange={(e) => updateField('support_email', e.target.value)}
                    placeholder="support@yourcompany.com"
                  />
                </div>
                <div>
                  <Label htmlFor="shipping_email">Shipping Email</Label>
                  <Input
                    id="shipping_email"
                    type="email"
                    value={settings.shipping_email || ''}
                    onChange={(e) => updateField('shipping_email', e.target.value)}
                    placeholder="shipping@yourcompany.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="default_payment_terms">Default Payment Terms</Label>
                  <Input
                    id="default_payment_terms"
                    value={settings.default_payment_terms || ''}
                    onChange={(e) => updateField('default_payment_terms', e.target.value)}
                    placeholder="Net 30"
                  />
                </div>
                <div>
                  <Label htmlFor="default_currency">Default Currency</Label>
                  <Input
                    id="default_currency"
                    value={settings.default_currency || ''}
                    onChange={(e) => updateField('default_currency', e.target.value)}
                    placeholder="USD"
                  />
                </div>
                <div>
                  <Label htmlFor="fiscal_year_start">Fiscal Year Start Month</Label>
                  <Input
                    id="fiscal_year_start"
                    type="number"
                    min="1"
                    max="12"
                    value={settings.fiscal_year_start || ''}
                    onChange={(e) => updateField('fiscal_year_start', parseInt(e.target.value))}
                    placeholder="1 (January)"
                  />
                </div>
                <div>
                  <Label htmlFor="credit_limit">Credit Limit</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    step="0.01"
                    value={settings.credit_limit || ''}
                    onChange={(e) => updateField('credit_limit', parseFloat(e.target.value))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="default_terms_and_conditions">Default Terms & Conditions</Label>
                <Textarea
                  id="default_terms_and_conditions"
                  value={settings.default_terms_and_conditions || ''}
                  onChange={(e) => updateField('default_terms_and_conditions', e.target.value)}
                  placeholder="Payment is due within 30 days of invoice date..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Banking Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary_bank_name">Primary Bank Name</Label>
                  <Input
                    id="primary_bank_name"
                    value={settings.primary_bank_name || ''}
                    onChange={(e) => updateField('primary_bank_name', e.target.value)}
                    placeholder="First National Bank"
                  />
                </div>
                <div>
                  <Label htmlFor="primary_bank_account_type">Account Type</Label>
                  <Input
                    id="primary_bank_account_type"
                    value={settings.primary_bank_account_type || ''}
                    onChange={(e) => updateField('primary_bank_account_type', e.target.value)}
                    placeholder="Checking"
                  />
                </div>
                <div>
                  <Label htmlFor="primary_bank_routing_number">Routing Number</Label>
                  <Input
                    id="primary_bank_routing_number"
                    value={settings.primary_bank_routing_number || ''}
                    onChange={(e) => updateField('primary_bank_routing_number', e.target.value)}
                    placeholder="123456789"
                  />
                </div>
                <div>
                  <Label htmlFor="primary_bank_account_number">Account Number</Label>
                  <Input
                    id="primary_bank_account_number"
                    type="password"
                    value={settings.primary_bank_account_number || ''}
                    onChange={(e) => updateField('primary_bank_account_number', e.target.value)}
                    placeholder="**** **** ****"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Logo & Visual Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="company_logo_url">Company Logo URL</Label>
                <Input
                  id="company_logo_url"
                  value={settings.company_logo_url || ''}
                  onChange={(e) => updateField('company_logo_url', e.target.value)}
                  placeholder="https://yourcompany.com/logo.png"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="logo_position">Logo Position</Label>
                  <Input
                    id="logo_position"
                    value={settings.logo_position || ''}
                    onChange={(e) => updateField('logo_position', e.target.value)}
                    placeholder="left, center, right"
                  />
                </div>
                <div>
                  <Label htmlFor="logo_size">Logo Size</Label>
                  <Input
                    id="logo_size"
                    value={settings.logo_size || ''}
                    onChange={(e) => updateField('logo_size', e.target.value)}
                    placeholder="small, medium, large"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brand Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="brand_color_primary">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="brand_color_primary"
                      value={settings.brand_color_primary || ''}
                      onChange={(e) => updateField('brand_color_primary', e.target.value)}
                      placeholder="#1f2937"
                    />
                    <input
                      type="color"
                      value={settings.brand_color_primary || '#1f2937'}
                      onChange={(e) => updateField('brand_color_primary', e.target.value)}
                      className="w-12 h-10 border rounded cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="brand_color_secondary">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="brand_color_secondary"
                      value={settings.brand_color_secondary || ''}
                      onChange={(e) => updateField('brand_color_secondary', e.target.value)}
                      placeholder="#6b7280"
                    />
                    <input
                      type="color"
                      value={settings.brand_color_secondary || '#6b7280'}
                      onChange={(e) => updateField('brand_color_secondary', e.target.value)}
                      className="w-12 h-10 border rounded cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="brand_color_accent">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="brand_color_accent"
                      value={settings.brand_color_accent || ''}
                      onChange={(e) => updateField('brand_color_accent', e.target.value)}
                      placeholder="#3b82f6"
                    />
                    <input
                      type="color"
                      value={settings.brand_color_accent || '#3b82f6'}
                      onChange={(e) => updateField('brand_color_accent', e.target.value)}
                      className="w-12 h-10 border rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Social Media
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="linkedin_url">LinkedIn</Label>
                  <Input
                    id="linkedin_url"
                    value={settings.linkedin_url || ''}
                    onChange={(e) => updateField('linkedin_url', e.target.value)}
                    placeholder="https://linkedin.com/company/yourcompany"
                  />
                </div>
                <div>
                  <Label htmlFor="facebook_url">Facebook</Label>
                  <Input
                    id="facebook_url"
                    value={settings.facebook_url || ''}
                    onChange={(e) => updateField('facebook_url', e.target.value)}
                    placeholder="https://facebook.com/yourcompany"
                  />
                </div>
                <div>
                  <Label htmlFor="twitter_url">Twitter/X</Label>
                  <Input
                    id="twitter_url"
                    value={settings.twitter_url || ''}
                    onChange={(e) => updateField('twitter_url', e.target.value)}
                    placeholder="https://twitter.com/yourcompany"
                  />
                </div>
                <div>
                  <Label htmlFor="instagram_url">Instagram</Label>
                  <Input
                    id="instagram_url"
                    value={settings.instagram_url || ''}
                    onChange={(e) => updateField('instagram_url', e.target.value)}
                    placeholder="https://instagram.com/yourcompany"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="time_zone">Time Zone</Label>
                  <Input
                    id="time_zone"
                    value={settings.time_zone || ''}
                    onChange={(e) => updateField('time_zone', e.target.value)}
                    placeholder="America/New_York"
                  />
                </div>
                <div>
                  <Label htmlFor="date_format">Date Format</Label>
                  <Input
                    id="date_format"
                    value={settings.date_format || ''}
                    onChange={(e) => updateField('date_format', e.target.value)}
                    placeholder="MM/DD/YYYY"
                  />
                </div>
                <div>
                  <Label htmlFor="number_format">Number Format</Label>
                  <Input
                    id="number_format"
                    value={settings.number_format || ''}
                    onChange={(e) => updateField('number_format', e.target.value)}
                    placeholder="US, EU, etc."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="custom_field_1_label">Custom Field 1 Label</Label>
                    <Input
                      id="custom_field_1_label"
                      value={settings.custom_field_1_label || ''}
                      onChange={(e) => updateField('custom_field_1_label', e.target.value)}
                      placeholder="e.g., Certification Number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom_field_1_value">Custom Field 1 Value</Label>
                    <Input
                      id="custom_field_1_value"
                      value={settings.custom_field_1_value || ''}
                      onChange={(e) => updateField('custom_field_1_value', e.target.value)}
                      placeholder="Value"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="custom_field_2_label">Custom Field 2 Label</Label>
                    <Input
                      id="custom_field_2_label"
                      value={settings.custom_field_2_label || ''}
                      onChange={(e) => updateField('custom_field_2_label', e.target.value)}
                      placeholder="e.g., License Expiry"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom_field_2_value">Custom Field 2 Value</Label>
                    <Input
                      id="custom_field_2_value"
                      value={settings.custom_field_2_value || ''}
                      onChange={(e) => updateField('custom_field_2_value', e.target.value)}
                      placeholder="Value"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="custom_field_3_label">Custom Field 3 Label</Label>
                    <Input
                      id="custom_field_3_label"
                      value={settings.custom_field_3_label || ''}
                      onChange={(e) => updateField('custom_field_3_label', e.target.value)}
                      placeholder="e.g., Industry Code"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom_field_3_value">Custom Field 3 Value</Label>
                    <Input
                      id="custom_field_3_value"
                      value={settings.custom_field_3_value || ''}
                      onChange={(e) => updateField('custom_field_3_value', e.target.value)}
                      placeholder="Value"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Internal Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="internal_notes">Internal Company Notes</Label>
                <Textarea
                  id="internal_notes"
                  value={settings.internal_notes || ''}
                  onChange={(e) => updateField('internal_notes', e.target.value)}
                  placeholder="Internal notes about the company profile, reminders, etc."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}