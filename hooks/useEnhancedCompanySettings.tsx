'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

export function useEnhancedCompanySettings() {
  const [companySettings, setCompanySettings] = useState<EnhancedCompanySettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCompanySettings()
  }, [])

  const fetchCompanySettings = async () => {
    try {
      // Try to fetch from enhanced table first
      let { data, error } = await supabase
        .from('enhanced_company_settings')
        .select('*')
        .eq('is_active', true)
        .single()

      // If enhanced table doesn't exist or has no data, fall back to old table
      if (error?.code === '42P01' || !data) {
        console.log('Enhanced table not available, falling back to legacy company_settings...')

        const { data: oldData, error: oldError } = await supabase
          .from('company_settings')
          .select('*')
          .eq('is_active', true)
          .single()

        if (oldData) {
          // Map old data structure to enhanced structure
          data = {
            ...defaultSettings,
            ...oldData,
            // Map old fields to new enhanced fields
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
        setCompanySettings({ ...defaultSettings, ...data })
      } else {
        setCompanySettings(defaultSettings)
      }
    } catch (error) {
      console.error('Error fetching company settings:', error)
      setCompanySettings(defaultSettings)
    } finally {
      setIsLoading(false)
    }
  }

  const getBillingAddress = () => {
    if (!companySettings) return ''

    let address = companySettings.company_name
    if (companySettings.billing_address_line_1) {
      address += '\n' + companySettings.billing_address_line_1
    }
    if (companySettings.billing_address_line_2) {
      address += '\n' + companySettings.billing_address_line_2
    }
    if (companySettings.billing_city || companySettings.billing_state || companySettings.billing_zip_code) {
      const cityStateZip = [
        companySettings.billing_city,
        companySettings.billing_state,
        companySettings.billing_zip_code
      ].filter(Boolean).join(', ')
      address += '\n' + cityStateZip
    }
    if (companySettings.billing_country && companySettings.billing_country !== 'USA') {
      address += '\n' + companySettings.billing_country
    }
    if (companySettings.billing_phone) {
      address += '\nPhone: ' + companySettings.billing_phone
    }
    if (companySettings.billing_email) {
      address += '\nEmail: ' + companySettings.billing_email
    }

    return address
  }

  const getShippingAddress = () => {
    if (!companySettings) return ''

    let address = companySettings.company_name
    if (companySettings.shipping_attention) {
      address += '\nAttn: ' + companySettings.shipping_attention
    }
    if (companySettings.shipping_address_line_1) {
      address += '\n' + companySettings.shipping_address_line_1
    }
    if (companySettings.shipping_address_line_2) {
      address += '\n' + companySettings.shipping_address_line_2
    }
    if (companySettings.shipping_city || companySettings.shipping_state || companySettings.shipping_zip_code) {
      const cityStateZip = [
        companySettings.shipping_city,
        companySettings.shipping_state,
        companySettings.shipping_zip_code
      ].filter(Boolean).join(', ')
      address += '\n' + cityStateZip
    }
    if (companySettings.shipping_country && companySettings.shipping_country !== 'USA') {
      address += '\n' + companySettings.shipping_country
    }
    if (companySettings.shipping_phone) {
      address += '\nPhone: ' + companySettings.shipping_phone
    }
    if (companySettings.shipping_instructions) {
      address += '\nInstructions: ' + companySettings.shipping_instructions
    }

    return address
  }

  const getBusinessAddress = () => {
    if (!companySettings) return ''

    let address = companySettings.company_name
    if (companySettings.business_address_line_1) {
      address += '\n' + companySettings.business_address_line_1
    }
    if (companySettings.business_address_line_2) {
      address += '\n' + companySettings.business_address_line_2
    }
    if (companySettings.business_city || companySettings.business_state || companySettings.business_zip_code) {
      const cityStateZip = [
        companySettings.business_city,
        companySettings.business_state,
        companySettings.business_zip_code
      ].filter(Boolean).join(', ')
      address += '\n' + cityStateZip
    }
    if (companySettings.business_country && companySettings.business_country !== 'USA') {
      address += '\n' + companySettings.business_country
    }
    if (companySettings.primary_phone) {
      address += '\nPhone: ' + companySettings.primary_phone
    }
    if (companySettings.primary_email) {
      address += '\nEmail: ' + companySettings.primary_email
    }

    return address
  }

  const getCompanyContactInfo = () => {
    if (!companySettings) return {}

    return {
      primaryPhone: companySettings.primary_phone,
      secondaryPhone: companySettings.secondary_phone,
      fax: companySettings.fax_number,
      primaryEmail: companySettings.primary_email,
      billingEmail: companySettings.billing_email,
      salesEmail: companySettings.sales_email,
      supportEmail: companySettings.support_email,
      apEmail: companySettings.accounts_payable_email,
      arEmail: companySettings.accounts_receivable_email,
      website: companySettings.company_website
    }
  }

  const getBrandingInfo = () => {
    if (!companySettings) return {}

    return {
      logoUrl: companySettings.company_logo_url,
      logoPosition: companySettings.logo_position || 'left',
      logoSize: companySettings.logo_size || 'medium',
      primaryColor: companySettings.brand_color_primary || '#1f2937',
      secondaryColor: companySettings.brand_color_secondary || '#6b7280',
      accentColor: companySettings.brand_color_accent || '#3b82f6',
      tagline: companySettings.company_tagline
    }
  }

  return {
    companySettings,
    isLoading,
    getBillingAddress,
    getShippingAddress,
    getBusinessAddress,
    getCompanyContactInfo,
    getBrandingInfo,
    refetch: fetchCompanySettings
  }
}