'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { 
  X, Plus, Trash2, Search, Building, User, Package, 
  Calculator, Save, FileText, AlertCircle, Check
} from 'lucide-react'

type Customer = Database['public']['Tables']['customers']['Row']
type SalesRep = Database['public']['Tables']['sales_reps']['Row']
type EstimateTemplate = Database['public']['Tables']['estimate_templates']['Row']
type Product = Database['public']['Tables']['products']['Row']
type Estimate = Database['public']['Tables']['estimates']['Row']

interface LineItem {
  id?: string
  line_number: number
  sku: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
  product_id?: string
  item_type: 'PRODUCT' | 'SERVICE' | 'LABOR' | 'MATERIAL' | 'MISC'
  unit_of_measure: string
  notes?: string
}

interface CreateEstimateFullscreenProps {
  onSave: (estimate: Estimate) => void
  onCancel: () => void
}

interface NewCustomerData {
  name: string
  email: string
  phone: string
  billing_address: string
}

export default function CreateEstimateFullscreen({ onSave, onCancel }: CreateEstimateFullscreenProps) {
  // Data state
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [templates, setTemplates] = useState<EstimateTemplate[]>([])
  const [products, setProducts] = useState<Product[]>([])
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

  // New customer state
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState<NewCustomerData>({
    name: '',
    email: '',
    phone: '',
    billing_address: ''
  })
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      line_number: 1,
      sku: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      line_total: 0,
      item_type: 'PRODUCT',
      unit_of_measure: 'each'
    }
  ])

  // SKU search state
  const [skuSearchTerms, setSkuSearchTerms] = useState<{ [key: number]: string }>({})
  const [showSkuDropdowns, setShowSkuDropdowns] = useState<{ [key: number]: boolean }>({})

  // Financial totals
  const [subtotal, setSubtotal] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [total, setTotal] = useState(0)

  // Terms and notes
  const [termsAndConditions, setTermsAndConditions] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')

  useEffect(() => {
    fetchData()
    generateEstimateNumber()
  }, [])

  useEffect(() => {
    // Calculate totals when line items change
    const newSubtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0)
    const newTaxAmount = newSubtotal * (taxRate / 100)
    const newTotal = newSubtotal + newTaxAmount
    
    setSubtotal(newSubtotal)
    setTaxAmount(newTaxAmount)
    setTotal(newTotal)
  }, [lineItems, taxRate])

  const fetchData = async () => {
    try {
      const [customersResult, salesRepsResult, templatesResult, productsResult] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('sales_reps').select('*').eq('is_active', true).order('first_name'),
        supabase.from('estimate_templates').select('*').order('name'),
        supabase.from('products').select('*').order('name')
      ])

      if (customersResult.data) setCustomers(customersResult.data)
      if (salesRepsResult.data) setSalesReps(salesRepsResult.data)
      if (templatesResult.data) {
        setTemplates(templatesResult.data)
        const defaultTemplate = templatesResult.data.find(t => t.is_default)
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id)
          if (defaultTemplate.terms_and_conditions) {
            setTermsAndConditions(defaultTemplate.terms_and_conditions)
          }
        }
      }
      if (productsResult.data) setProducts(productsResult.data)
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

  const handleCustomerSearch = (term: string) => {
    setCustomerSearchTerm(term)
    setShowCustomerDropdown(true)
    
    // Check if this is a new customer name
    if (term && !customers.find(c => c.name.toLowerCase().includes(term.toLowerCase()))) {
      setNewCustomer(prev => ({ ...prev, name: term }))
      setShowNewCustomer(true)
    } else {
      setShowNewCustomer(false)
    }
  }

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomerId(customer.id)
    setCustomerSearchTerm(customer.name)
    setShowCustomerDropdown(false)
    setShowNewCustomer(false)
  }

  const handleSaveNewCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.email.trim()) {
      alert('Please enter customer name and email')
      return
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: newCustomer.name,
          email: newCustomer.email,
          phone: newCustomer.phone || null,
          billing_address: newCustomer.billing_address || null,
          payment_terms: 'Net 30',
          credit_limit: 0,
          tax_exempt: false
        })
        .select()
        .single()

      if (error) throw error

      // Update customers list and select the new customer
      setCustomers(prev => [...prev, data])
      setSelectedCustomerId(data.id)
      setCustomerSearchTerm(data.name)
      setShowNewCustomer(false)
      setShowCustomerDropdown(false)
      
      // Reset new customer form
      setNewCustomer({ name: '', email: '', phone: '', billing_address: '' })
      
    } catch (error) {
      console.error('Error creating customer:', error)
      alert('Failed to create customer')
    }
  }

  const handleSkuSearch = (lineNumber: number, sku: string) => {
    setSkuSearchTerms(prev => ({ ...prev, [lineNumber]: sku }))
    setShowSkuDropdowns(prev => ({ ...prev, [lineNumber]: true }))
    
    // Update the line item SKU
    setLineItems(prev => prev.map(item => 
      item.line_number === lineNumber 
        ? { ...item, sku }
        : item
    ))
  }

  const handleProductSelect = (lineNumber: number, product: Product) => {
    setLineItems(prev => prev.map(item => {
      if (item.line_number === lineNumber) {
        const salesPrice = (product as any).unit_price || 0
        return {
          ...item,
          sku: product.sku || '',
          description: product.name,
          product_id: product.id,
          unit_of_measure: product.unit_of_measure || 'each',
          unit_price: salesPrice,
          line_total: item.quantity * salesPrice
        }
      }
      return item
    }))
    
    setSkuSearchTerms(prev => ({ ...prev, [lineNumber]: product.sku || '' }))
    setShowSkuDropdowns(prev => ({ ...prev, [lineNumber]: false }))
  }

  const updateLineItem = (lineNumber: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.line_number === lineNumber) {
        const updated = { ...item, [field]: value }
        // Recalculate line total when quantity or price changes
        if (field === 'quantity' || field === 'unit_price') {
          updated.line_total = updated.quantity * updated.unit_price
        }
        return updated
      }
      return item
    }))
  }

  const addLineItem = () => {
    const newLineNumber = Math.max(...lineItems.map(item => item.line_number)) + 1
    setLineItems(prev => [...prev, {
      line_number: newLineNumber,
      sku: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      line_total: 0,
      item_type: 'PRODUCT',
      unit_of_measure: 'each'
    }])
  }

  const removeLineItem = (lineNumber: number) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(item => item.line_number !== lineNumber))
    }
  }

  const handleSave = async () => {
    if (!selectedCustomerId && !showNewCustomer) {
      alert('Please select or create a customer')
      return
    }

    if (!estimateNumber.trim()) {
      alert('Please enter an estimate number')
      return
    }

    if (lineItems.length === 0 || lineItems.every(item => !item.description.trim())) {
      alert('Please add at least one line item')
      return
    }

    setIsSaving(true)

    try {
      let customerId = selectedCustomerId

      // Create new customer if needed
      if (showNewCustomer && !selectedCustomerId) {
        const { data: newCustomerData, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: newCustomer.name,
            email: newCustomer.email,
            phone: newCustomer.phone || null,
            billing_address: newCustomer.billing_address || null,
            payment_terms: 'Net 30',
            credit_limit: 0,
            tax_exempt: false
          })
          .select()
          .single()

        if (customerError) throw customerError
        customerId = newCustomerData.id
      }

      // Create estimate
      const estimateData = {
        estimate_number: estimateNumber,
        customer_id: customerId,
        sales_rep_id: selectedSalesRepId || null,
        template_id: selectedTemplateId || null,
        estimate_date: estimateDate,
        expiration_date: expirationDate || null,
        reference_number: referenceNumber || null,
        job_name: jobName || null,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: total,
        internal_notes: internalNotes || null,
        customer_notes: customerNotes || null,
        terms_and_conditions: termsAndConditions || null,
        status: 'DRAFT' as const
      }

      const { data: estimateResult, error: estimateError } = await supabase
        .from('estimates')
        .insert(estimateData)
        .select(`
          *,
          customers (name, email),
          sales_reps (first_name, last_name, employee_code),
          estimate_templates (name)
        `)
        .single()

      if (estimateError) throw estimateError

      // Create line items
      const lineItemsData = lineItems
        .filter(item => item.description.trim())
        .map(item => ({
          estimate_id: estimateResult.id,
          line_number: item.line_number,
          product_id: item.product_id || null,
          sku: item.sku || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          unit_of_measure: item.unit_of_measure,
          item_type: item.item_type,
          notes: item.notes || null,
          sort_order: item.line_number
        }))

      if (lineItemsData.length > 0) {
        const { error: lineItemsError } = await supabase
          .from('estimate_lines')
          .insert(lineItemsData)

        if (lineItemsError) throw lineItemsError
      }

      onSave(estimateResult)
    } catch (error) {
      console.error('Error creating estimate:', error)
      alert('Failed to create estimate. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase())
  )

  const getFilteredProducts = (lineNumber: number) => {
    const searchTerm = skuSearchTerms[lineNumber] || ''
    if (!searchTerm) return []
    
    return products.filter(product =>
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10)
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading estimate form...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Create New Estimate</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Creating...' : 'Create Estimate'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-12 h-full">
          {/* Left Panel - Form Fields */}
          <div className="col-span-4 border-r overflow-y-auto p-4 space-y-4">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Estimate Number *
                  </label>
                  <Input
                    value={estimateNumber}
                    onChange={(e) => setEstimateNumber(e.target.value)}
                    className="text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Date *
                    </label>
                    <Input
                      type="date"
                      value={estimateDate}
                      onChange={(e) => setEstimateDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Expires
                    </label>
                    <Input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Job Name
                  </label>
                  <Input
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="Project description"
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Reference #
                  </label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="PO number, etc."
                    className="text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Customer */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Customer *
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Input
                    value={customerSearchTerm}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    placeholder="Search or enter new customer name"
                    className="text-sm"
                    onFocus={() => setShowCustomerDropdown(true)}
                  />
                  
                  {showCustomerDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredCustomers.map(customer => (
                        <button
                          key={customer.id}
                          onClick={() => handleCustomerSelect(customer)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm"
                        >
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-xs text-gray-500">{customer.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {showNewCustomer && (
                  <div className="p-3 bg-blue-50 rounded-md space-y-2">
                    <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
                      <AlertCircle className="w-4 h-4" />
                      Create New Customer
                    </div>
                    
                    <Input
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Email address *"
                      type="email"
                      className="text-sm"
                    />
                    
                    <Input
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Phone number"
                      className="text-sm"
                    />
                    
                    <Textarea
                      value={newCustomer.billing_address}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, billing_address: e.target.value }))}
                      placeholder="Billing address"
                      rows={2}
                      className="text-sm"
                    />
                    
                    <Button
                      onClick={handleSaveNewCustomer}
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Save Customer
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sales Rep */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Sales Representative
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  value={selectedSalesRepId}
                  onChange={(e) => setSelectedSalesRepId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                >
                  <option value="">Select Sales Rep...</option>
                  {salesReps.map(rep => (
                    <option key={rep.id} value={rep.id}>
                      {rep.first_name} {rep.last_name}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>

            {/* Template */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Template</CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                >
                  <option value="">Select Template...</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>

            {/* Totals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Totals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tax Rate (%):</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-16 h-6 text-xs text-right"
                  />
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Tax Amount:</span>
                  <span className="font-medium">${taxAmount.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between text-base font-semibold pt-2 border-t">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes & Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Internal Notes
                  </label>
                  <Textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={2}
                    className="text-sm"
                    placeholder="Notes for internal use"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Customer Notes
                  </label>
                  <Textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    rows={2}
                    className="text-sm"
                    placeholder="Notes visible to customer"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Terms & Conditions
                  </label>
                  <Textarea
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    rows={3}
                    className="text-sm"
                    placeholder="Terms and conditions"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Line Items */}
          <div className="col-span-8 flex flex-col">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Line Items
                </h2>
                <Button
                  onClick={addLineItem}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Line
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      #
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      SKU
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Qty
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Unit
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Price
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Total
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lineItems.map((item, index) => (
                    <tr key={item.line_number} className="hover:bg-gray-50">
                      <td className="px-2 py-2 text-sm text-gray-500">
                        {item.line_number}
                      </td>
                      
                      {/* SKU with Search */}
                      <td className="px-2 py-2 relative">
                        <Input
                          value={skuSearchTerms[item.line_number] || item.sku}
                          onChange={(e) => handleSkuSearch(item.line_number, e.target.value)}
                          placeholder="SKU"
                          className="text-sm h-8"
                          onFocus={() => setShowSkuDropdowns(prev => ({ ...prev, [item.line_number]: true }))}
                        />
                        
                        {showSkuDropdowns[item.line_number] && getFilteredProducts(item.line_number).length > 0 && (
                          <div className="absolute z-10 w-64 mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {getFilteredProducts(item.line_number).map(product => (
                              <button
                                key={product.id}
                                onClick={() => handleProductSelect(item.line_number, product)}
                                className="w-full px-3 py-2 text-left hover:bg-gray-100"
                              >
                                <div className="text-sm font-medium">{product.sku}</div>
                                <div className="text-xs text-gray-500">{product.name}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      
                      {/* Description */}
                      <td className="px-2 py-2">
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.line_number, 'description', e.target.value)}
                          placeholder="Item description"
                          className="text-sm h-8"
                        />
                      </td>
                      
                      {/* Quantity */}
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.line_number, 'quantity', parseFloat(e.target.value) || 0)}
                          className="text-sm h-8 text-right"
                        />
                      </td>
                      
                      {/* Unit of Measure */}
                      <td className="px-2 py-2">
                        <Input
                          value={item.unit_of_measure}
                          onChange={(e) => updateLineItem(item.line_number, 'unit_of_measure', e.target.value)}
                          placeholder="each"
                          className="text-sm h-8"
                        />
                      </td>
                      
                      {/* Unit Price */}
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateLineItem(item.line_number, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="text-sm h-8 text-right"
                        />
                      </td>
                      
                      {/* Line Total */}
                      <td className="px-2 py-2">
                        <div className="text-sm font-medium text-right py-1">
                          ${item.line_total.toFixed(2)}
                        </div>
                      </td>
                      
                      {/* Delete */}
                      <td className="px-2 py-2">
                        {lineItems.length > 1 && (
                          <Button
                            onClick={() => removeLineItem(item.line_number)}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}