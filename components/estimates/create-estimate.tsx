'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Calendar, User, Building, FileText, DollarSign, Settings } from 'lucide-react'

type Customer = Database['public']['Tables']['customers']['Row']
type SalesRep = Database['public']['Tables']['sales_reps']['Row']
type EstimateTemplate = Database['public']['Tables']['estimate_templates']['Row']
type Estimate = Database['public']['Tables']['estimates']['Row']

interface CreateEstimateProps {
  onSave: (estimate: Estimate) => void
  onCancel: () => void
}

export default function CreateEstimate({ onSave, onCancel }: CreateEstimateProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [templates, setTemplates] = useState<EstimateTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedSalesRepId, setSelectedSalesRepId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [estimateNumber, setEstimateNumber] = useState('')
  const [estimateDate, setEstimateDate] = useState(new Date().toISOString().split('T')[0])
  const [expirationDate, setExpirationDate] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [termsAndConditions, setTermsAndConditions] = useState('')

  // Address state
  const [billToCompany, setBillToCompany] = useState('')
  const [billToContact, setBillToContact] = useState('')
  const [billToAddress1, setBillToAddress1] = useState('')
  const [billToAddress2, setBillToAddress2] = useState('')
  const [billToCity, setBillToCity] = useState('')
  const [billToState, setBillToState] = useState('')
  const [billToZip, setBillToZip] = useState('')
  const [billToCountry, setBillToCountry] = useState('United States')
  
  const [shipToSameAsBilling, setShipToSameAsBilling] = useState(true)
  const [shipToCompany, setShipToCompany] = useState('')
  const [shipToContact, setShipToContact] = useState('')
  const [shipToAddress1, setShipToAddress1] = useState('')
  const [shipToAddress2, setShipToAddress2] = useState('')
  const [shipToCity, setShipToCity] = useState('')
  const [shipToState, setShipToState] = useState('')
  const [shipToZip, setShipToZip] = useState('')
  const [shipToCountry, setShipToCountry] = useState('United States')

  useEffect(() => {
    fetchData()
    generateEstimateNumber()
  }, [])

  useEffect(() => {
    // Auto-populate billing address when customer is selected
    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId)
      if (customer) {
        setBillToCompany(customer.name)
        setBillToAddress1(customer.billing_address || '')
        // Could parse billing_address if it contains structured data
      }
    }
  }, [selectedCustomerId, customers])

  useEffect(() => {
    // Auto-populate terms from template
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId)
      if (template?.terms_and_conditions) {
        setTermsAndConditions(template.terms_and_conditions)
      }
    }
  }, [selectedTemplateId, templates])

  const fetchData = async () => {
    try {
      const [customersResult, salesRepsResult, templatesResult] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('sales_reps').select('*').eq('is_active', true).order('first_name'),
        supabase.from('estimate_templates').select('*').order('name')
      ])

      if (customersResult.data) setCustomers(customersResult.data)
      else if (customersResult.error?.message?.includes('does not exist')) {
        console.info('Customers table exists, but sales_reps or estimate_templates may not exist yet')
      }
      
      if (salesRepsResult.data) setSalesReps(salesRepsResult.data)
      else if (salesRepsResult.error?.message?.includes('does not exist')) {
        console.info('Sales reps table not created yet')
      }
      
      if (templatesResult.data) {
        setTemplates(templatesResult.data)
        // Auto-select default template
        const defaultTemplate = templatesResult.data.find(t => t.is_default)
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id)
        }
      } else if (templatesResult.error?.message?.includes('does not exist')) {
        console.info('Estimate templates table not created yet')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateEstimateNumber = () => {
    const today = new Date()
    const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '')
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    setEstimateNumber(`EST-${dateStr}-${randomSuffix}`)
  }

  const handleSave = async () => {
    if (!selectedCustomerId) {
      alert('Please select a customer')
      return
    }

    if (!estimateNumber.trim()) {
      alert('Please enter an estimate number')
      return
    }

    setIsSaving(true)

    try {
      const estimateData = {
        estimate_number: estimateNumber,
        customer_id: selectedCustomerId,
        sales_rep_id: selectedSalesRepId || null,
        template_id: selectedTemplateId || null,
        
        // Billing address
        bill_to_company: billToCompany,
        bill_to_contact: billToContact,
        bill_to_address_line_1: billToAddress1,
        bill_to_address_line_2: billToAddress2,
        bill_to_city: billToCity,
        bill_to_state: billToState,
        bill_to_zip: billToZip,
        bill_to_country: billToCountry,
        
        // Shipping address
        ship_to_company: shipToSameAsBilling ? billToCompany : shipToCompany,
        ship_to_contact: shipToSameAsBilling ? billToContact : shipToContact,
        ship_to_address_line_1: shipToSameAsBilling ? billToAddress1 : shipToAddress1,
        ship_to_address_line_2: shipToSameAsBilling ? billToAddress2 : shipToAddress2,
        ship_to_city: shipToSameAsBilling ? billToCity : shipToCity,
        ship_to_state: shipToSameAsBilling ? billToState : shipToState,
        ship_to_zip: shipToSameAsBilling ? billToZip : shipToZip,
        ship_to_country: shipToSameAsBilling ? billToCountry : shipToCountry,
        ship_to_same_as_billing: shipToSameAsBilling,
        
        // Estimate details
        estimate_date: estimateDate,
        expiration_date: expirationDate || null,
        reference_number: referenceNumber || null,
        job_name: jobName || null,
        
        // Notes and terms
        internal_notes: internalNotes || null,
        customer_notes: customerNotes || null,
        terms_and_conditions: termsAndConditions || null,
        
        // Default financial values
        subtotal: 0.00,
        tax_rate: 0.00,
        tax_amount: 0.00,
        shipping_amount: 0.00,
        discount_amount: 0.00,
        total_amount: 0.00,
        
        status: 'DRAFT' as const
      }

      const { data, error } = await supabase
        .from('estimates')
        .insert(estimateData)
        .select(`
          *,
          customers (name, email),
          sales_reps (first_name, last_name, employee_code),
          estimate_templates (name)
        `)
        .single()

      if (error) throw error

      onSave(data)
    } catch (error) {
      console.error('Error creating estimate:', error)
      alert('Failed to create estimate. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimate Number *
              </label>
              <Input
                value={estimateNumber}
                onChange={(e) => setEstimateNumber(e.target.value)}
                placeholder="EST-240811-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimate Date *
              </label>
              <Input
                type="date"
                value={estimateDate}
                onChange={(e) => setEstimateDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer *
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select Customer...</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sales Representative
              </label>
              <select
                value={selectedSalesRepId}
                onChange={(e) => setSelectedSalesRepId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select Sales Rep...</option>
                {salesReps.map(rep => (
                  <option key={rep.id} value={rep.id}>
                    {rep.first_name} {rep.last_name} ({rep.employee_code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select Template...</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiration Date
              </label>
              <Input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number
              </label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Customer PO, etc."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Name
            </label>
            <Input
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="Project or job description"
            />
          </div>
        </CardContent>
      </Card>

      {/* Billing Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Billing Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <Input
                value={billToCompany}
                onChange={(e) => setBillToCompany(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact
              </label>
              <Input
                value={billToContact}
                onChange={(e) => setBillToContact(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 1
            </label>
            <Input
              value={billToAddress1}
              onChange={(e) => setBillToAddress1(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 2
            </label>
            <Input
              value={billToAddress2}
              onChange={(e) => setBillToAddress2(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <Input
                value={billToCity}
                onChange={(e) => setBillToCity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <Input
                value={billToState}
                onChange={(e) => setBillToState(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP
              </label>
              <Input
                value={billToZip}
                onChange={(e) => setBillToZip(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Shipping Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sameAsBilling"
              checked={shipToSameAsBilling}
              onChange={(e) => setShipToSameAsBilling(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="sameAsBilling" className="text-sm font-medium text-gray-700">
              Same as billing address
            </label>
          </div>

          {!shipToSameAsBilling && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <Input
                    value={shipToCompany}
                    onChange={(e) => setShipToCompany(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact
                  </label>
                  <Input
                    value={shipToContact}
                    onChange={(e) => setShipToContact(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1
                </label>
                <Input
                  value={shipToAddress1}
                  onChange={(e) => setShipToAddress1(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <Input
                  value={shipToAddress2}
                  onChange={(e) => setShipToAddress2(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <Input
                    value={shipToCity}
                    onChange={(e) => setShipToCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <Input
                    value={shipToState}
                    onChange={(e) => setShipToState(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP
                  </label>
                  <Input
                    value={shipToZip}
                    onChange={(e) => setShipToZip(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notes and Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Notes and Terms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Internal Notes
            </label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Internal notes (not visible to customer)"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Notes
            </label>
            <Textarea
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Notes visible to customer"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Terms and Conditions
            </label>
            <Textarea
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Terms and conditions for this estimate"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
          {isSaving ? 'Creating...' : 'Create Estimate'}
        </Button>
      </div>
    </div>
  )
}