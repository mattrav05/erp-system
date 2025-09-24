'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'

type CompanySettings = any

export function useCompanySettings() {
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCompanySettings()
  }, [])

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('is_active', true)
        .single()

      if (error) throw error
      setCompanySettings(data)
    } catch (error) {
      console.error('Error fetching company settings:', error)
      // Set defaults if no settings found
      setCompanySettings({
        id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        company_name: 'Your Company Name',
        company_logo_url: null,
        billing_address_line_1: '123 Main Street',
        billing_address_line_2: null,
        billing_city: 'City',
        billing_state: 'ST',
        billing_zip_code: '12345',
        billing_country: 'USA',
        billing_phone: '(555) 123-4567',
        billing_email: 'billing@yourcompany.com',
        shipping_address_line_1: '123 Warehouse Drive',
        shipping_address_line_2: null,
        shipping_city: 'City',
        shipping_state: 'ST',
        shipping_zip_code: '12345',
        shipping_country: 'USA',
        shipping_phone: '(555) 123-4568',
        shipping_email: null,
        shipping_attention: 'Receiving Department',
        tax_id: null,
        business_registration_number: null,
        default_payment_terms: 'Net 30',
        is_active: true,
        created_by: null
      })
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
    if (companySettings.shipping_phone) {
      address += '\nPhone: ' + companySettings.shipping_phone
    }
    
    return address
  }

  return {
    companySettings,
    isLoading,
    getBillingAddress,
    getShippingAddress,
    refetch: fetchCompanySettings
  }
}