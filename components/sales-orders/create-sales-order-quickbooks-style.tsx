'use client'

import { useState, useEffect, useRef } from 'react'
import { useDefaultTaxRate } from '@/hooks/useDefaultTaxRate'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import { useAuth } from '@/components/providers/auth-provider'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { X, Save, Plus, Trash2, Package, FileText, ChevronLeft, ChevronRight, Printer, Mail, Copy, Settings2, Calculator, Receipt, ArrowLeft, ArrowRight, Search, FileCheck, AlertTriangle, Eye } from 'lucide-react'
import TaxCodeDropdown from '@/components/ui/tax-code-dropdown'
import ContextMenu from '@/components/ui/context-menu'
import TemplateEditor from '@/components/templates/template-editor'

type Customer = Database['public']['Tables']['customers']['Row']
type SalesRep = Database['public']['Tables']['sales_reps']['Row']
type Product = Database['public']['Tables']['products']['Row']
type SalesOrder = Database['public']['Tables']['sales_orders']['Row']
type SOTemplate = any

interface LineItem {
  id: string
  item: string
  description: string
  qty: number
  rate: number
  amount: number
  product_id?: string
  unit_of_measure: string
  is_taxable?: boolean  // Simple taxable flag instead of complex tax codes
  tax_code?: string
  tax_rate?: number
  tax_amount?: number
}

interface NewCustomerModal {
  show: boolean
  name: string
  email: string
  phone: string
  address: string
}

interface CreateSalesOrderQuickBooksStyleProps {
  onSave: (salesOrder: SalesOrder) => void
  onCancel: () => void
  salesOrders?: SalesOrder[]
  onNavigate?: (salesOrder: SalesOrder) => void
}

export default function CreateSalesOrderQuickBooksStyle({ 
  onSave, 
  onCancel, 
  salesOrders = [],
  onNavigate 
}: CreateSalesOrderQuickBooksStyleProps) {
  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [templates, setTemplates] = useState<SOTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Header fields
  const [customer, setCustomer] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerDropdown, setCustomerDropdown] = useState(false)
  const [soNumber, setSoNumber] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [shipDate, setShipDate] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [salesRep, setSalesRep] = useState('')
  const [terms, setTerms] = useState('')

  // Address fields
  const [billTo, setBillTo] = useState('')
  const [shipTo, setShipTo] = useState('')
  const [shipSameAsBill, setShipSameAsBill] = useState(true)

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', item: '', description: '', qty: 1, rate: 0, amount: 0, unit_of_measure: 'ea', tax_code: '', tax_rate: 0, tax_amount: 0 }
  ])
  const [activeItemDropdowns, setActiveItemDropdowns] = useState<{[key: string]: boolean}>({})

  // Column widths for resizable headers
  const [columnWidths, setColumnWidths] = useState({
    item: 120,
    description: 300,
    qty: 100,
    rate: 90,
    tax: 120,
    amount: 90
  })
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)

  // Totals
  const [subtotal, setSubtotal] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [total, setTotal] = useState(0)
  
  // Get backend-controlled tax rate from settings
  const { defaultTaxRate } = useDefaultTaxRate()
  
  // Get current authenticated user
  const { user } = useAuth()

  // Notes
  const [memo, setMemo] = useState('')
  const [customerMessage, setCustomerMessage] = useState('')

  // New customer modal
  const [newCustomerModal, setNewCustomerModal] = useState<NewCustomerModal>({
    show: false,
    name: '',
    email: '',
    phone: '',
    address: ''
  })

  // UI state
  const [showPreview, setShowPreview] = useState(false)
  const [showProfitCalculator, setShowProfitCalculator] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  
  // Add browser-level unsaved changes warning
  useUnsavedChangesWarning(hasUnsavedChanges, 'You have unsaved changes to this sales order. Are you sure you want to leave?')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  // Profit calculations
  const [totalCost, setTotalCost] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [profitMargin, setProfitMargin] = useState(0)

  // Refs for click outside handling
  const customerDropdownRef = useRef<HTMLDivElement>(null)
  const itemDropdownRefs = useRef<{[key: string]: HTMLDivElement | null}>({})

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setCustomerDropdown(false)
      }

      Object.keys(activeItemDropdowns).forEach(key => {
        if (activeItemDropdowns[key] && 
            itemDropdownRefs.current[key] && 
            !itemDropdownRefs.current[key]?.contains(event.target as Node)) {
          setActiveItemDropdowns(prev => ({ ...prev, [key]: false }))
        }
      })
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [customerDropdown, activeItemDropdowns])

  useEffect(() => {
    fetchData()
    generateSONumber()
  }, [])

  // Column resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !tableRef.current) return
      
      const table = tableRef.current
      const rect = table.getBoundingClientRect()
      const x = e.clientX - rect.left
      
      let cumulativeWidth = 0
      const columns = ['item', 'description', 'qty', 'rate', 'tax', 'amount'] as const
      
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]
        cumulativeWidth += columnWidths[col]
        
        if (col === isResizing) {
          const newWidth = Math.max(60, x - (cumulativeWidth - columnWidths[col]))
          setColumnWidths(prev => ({
            ...prev,
            [col]: newWidth
          }))
          break
        }
      }
    }

    const handleMouseUp = () => {
      setIsResizing(null)
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, columnWidths])

  const handleStartResize = (column: string) => {
    setIsResizing(column)
  }

  useEffect(() => {
    // Calculate totals using backend tax rate
    const newSubtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const taxableSubtotal = lineItems
      .filter(item => item.is_taxable)
      .reduce((sum, item) => sum + (item.amount || 0), 0)
    const newTaxAmount = (taxableSubtotal * defaultTaxRate) / 100
    const newTotal = newSubtotal + newTaxAmount
    
    // Calculate profit
    const newTotalCost = lineItems.reduce((sum, item) => {
      const inventoryItem = inventory.find(inv => inv.product_id === item.product_id)
      const product = products.find(p => p.id === item.product_id)
      const itemCost = ((inventoryItem as any)?.weighted_average_cost || (product as any)?.cost || 0) * item.qty
      return sum + itemCost
    }, 0)
    
    const newTotalProfit = newSubtotal - newTotalCost
    const newProfitMargin = newSubtotal > 0 ? (newTotalProfit / newSubtotal) * 100 : 0
    
    setSubtotal(newSubtotal)
    setTaxAmount(newTaxAmount)
    setTotal(newTotal)
    setTotalCost(newTotalCost)
    setTotalProfit(newTotalProfit)
    setProfitMargin(newProfitMargin)
  }, [lineItems, defaultTaxRate, products, inventory])

  const fetchData = async () => {
    try {
      const [customersRes, salesRepsRes, productsRes, inventoryRes, templatesRes] = await Promise.all([
        supabase.from('customers').select('*').order('company_name'),
        supabase.from('sales_reps').select('*').order('first_name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('inventory').select('*, products(*)').order('products(name)'),
        supabase.from('so_templates').select('*').order('name')
      ])

      if (customersRes.data) setCustomers(customersRes.data)
      if (salesRepsRes.data) setSalesReps(salesRepsRes.data)
      if (productsRes.data) setProducts(productsRes.data)
      if (inventoryRes.data) setInventory(inventoryRes.data)
      if (templatesRes.data) {
        setTemplates(templatesRes.data)
        const defaultTemplate = templatesRes.data.find(t => t.is_default)
        if (defaultTemplate?.terms_and_conditions) {
          setCustomerMessage(defaultTemplate.terms_and_conditions)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateSONumber = () => {
    const lastSO = salesOrders
      .map(so => so.so_number)
      .filter(num => num?.match(/^SO-\d{6}$/))
      .sort()
      .pop()

    const lastNum = lastSO ? parseInt(lastSO.split('-')[1]) : 0
    const newSONumber = `SO-${String(lastNum + 1).padStart(6, '0')}`
    setSoNumber(newSONumber)
    return newSONumber
  }

  const updateLineItem = (lineId: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        const updated = { ...item, [field]: value }
        if (field === 'qty' || field === 'rate') {
          updated.amount = updated.qty * updated.rate
        }
        return updated
      }
      return item
    }))
  }

  const addLineItem = () => {
    const newId = Math.random().toString(36).substr(2, 9)
    setLineItems(prev => [...prev, {
      id: newId,
      item: '',
      description: '',
      qty: 1,
      rate: 0,
      amount: 0,
      unit_of_measure: 'ea',
      tax_code: '',
      tax_rate: 0,
      tax_amount: 0
    }])
  }

  const removeLineItem = (lineId: string) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(item => item.id !== lineId))
    }
  }

  const insertLineAfter = (lineId: string) => {
    const newId = Math.random().toString(36).substr(2, 9)
    const currentIndex = lineItems.findIndex(item => item.id === lineId)
    const newLineItem = {
      id: newId,
      item: '',
      description: '',
      qty: 1,
      rate: 0,
      amount: 0,
      unit_of_measure: 'ea',
      tax_code: '',
      tax_rate: 0,
      tax_amount: 0
    }
    
    setLineItems(prev => {
      const newItems = [...prev]
      newItems.splice(currentIndex + 1, 0, newLineItem)
      return newItems
    })
  }

  const getFilteredProducts = (lineId: string) => {
    const currentItem = lineItems.find(item => item.id === lineId)
    if (!currentItem?.item) return []
    
    return products.filter(product =>
      product.name.toLowerCase().includes(currentItem.item.toLowerCase()) ||
      product.sku?.toLowerCase().includes(currentItem.item.toLowerCase())
    ).slice(0, 10)
  }

  const selectProduct = (lineId: string, product: Product) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        // Find the inventory item for this product to get the actual sales price and tax info
        const inventoryItem = inventory.find(inv => inv.product_id === product.id)
        
        // Use sales price from inventory if available, otherwise from product, otherwise 0
        const salesPrice = inventoryItem?.sales_price || 0
        const defaultQty = item.qty || 1 // Use current qty or default to 1
        
        // Get tax code from product defaults - ensure it's a valid tax code
        const defaultTaxCode = product.default_tax_code || 'TAX' // Default to 'TAX' if none set
        const defaultTaxRate = product.default_tax_rate || 8.5   // Default to 8.5% if none set
        
        const lineAmount = defaultQty * salesPrice
        const taxAmount = lineAmount * (defaultTaxRate / 100)
        
        return {
          ...item,
          item: product.sku || product.name,
          description: product.description || product.name,
          product_id: product.id,
          unit_of_measure: product.unit_of_measure || 'ea',
          rate: salesPrice,
          amount: lineAmount,
          tax_code: defaultTaxCode,
          tax_rate: defaultTaxRate,
          tax_amount: taxAmount
        }
      }
      return item
    }))
    
    setActiveItemDropdowns(prev => ({ ...prev, [lineId]: false }))
  }

  const handleItemSearch = (lineId: string, value: string) => {
    updateLineItem(lineId, 'item', value)
    setActiveItemDropdowns(prev => ({ ...prev, [lineId]: value.length > 0 }))
  }

  // Navigation functions
  const handleNavigateToSalesOrder = (direction: 'previous' | 'next') => {
    if (hasUnsavedChanges) {
      const shouldLeave = window.confirm('You have unsaved changes to this sales order. Are you sure you want to leave?')
      if (!shouldLeave) {
        return
      }
    }
    if (!onNavigate || salesOrders.length === 0) return
    
    const currentIndex = -1 // We're in create mode, no current SO
    const targetSalesOrder = direction === 'previous' 
      ? salesOrders[0] // Go to first SO
      : salesOrders[salesOrders.length - 1] // Go to last SO
    
    if (targetSalesOrder) {
      onNavigate(targetSalesOrder)
    }
  }

  const handlePrevious = () => handleNavigateToSalesOrder('previous')
  const handleNext = () => handleNavigateToSalesOrder('next')
  
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const shouldLeave = window.confirm('You have unsaved changes to this sales order. Are you sure you want to leave?')
      if (!shouldLeave) {
        return
      }
    }
    onCancel()
  }

  const handleQuickAddCustomer = () => {
    setNewCustomerModal({
      show: true,
      name: customer,
      email: '',
      phone: '',
      address: ''
    })
  }

  const saveNewCustomer = async () => {
    console.log('=== QUICK ADD CUSTOMER DEBUG ===');
    console.log('Modal data:', newCustomerModal);
    console.log('Current user:', user);
    
    try {
      const customerData = {
        name: newCustomerModal.name,  // Add name field for database compatibility
        company_name: newCustomerModal.name,
        email: newCustomerModal.email || null,
        phone: newCustomerModal.phone || null,
        address_line_1: newCustomerModal.address || null,
        payment_terms: 'NET30',  // Fixed: uppercase to match database constraint
        credit_limit: 0,
        tax_exempt: false,
        is_active: true,
        last_edited_by: user?.id || null
      }

      console.log('Customer data to save:', customerData);
      
      const { data, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Customer saved successfully:', data);

      // Update customers list and select the new customer
      setCustomers(prev => [...prev, data])
      setCustomer(data.company_name || data.name)
      setCustomerId(data.id)
      setCustomerDropdown(false)
      setNewCustomerModal({ show: false, name: '', email: '', phone: '', address: '' })
      
      alert('Customer added successfully!')
    } catch (error: any) {
      console.error('Error saving customer:', error);
      alert(`Failed to save customer: ${error.message || 'Unknown error'}`);
    }
  }

  // Action handlers
  const handlePrint = () => {
    window.print()
  }

  const handleEmail = () => {
    // TODO: Implement email functionality
    console.log('Email sales order')
  }

  const handleDuplicate = () => {
    // TODO: Implement duplicate functionality
    console.log('Duplicate sales order')
  }

  const handleCreatePO = () => {
    // TODO: Implement create PO functionality
    console.log('Create PO from sales order')
    alert('Create PO functionality will be implemented when PO module is ready')
  }

  const handleSaveAndNew = async () => {
    await handleSave()
    // Clear form for new sales order
    setSoNumber(generateSONumber())
    setCustomer('')
    setCustomerId('')
    setShipDate('')
    setPoNumber('')
    setSalesRep('')
    setTerms('')
    setBillTo('')
    setShipTo('')
    setLineItems([{
      id: '1',
      item: '',
      description: '',
      qty: 1,
      rate: 0,
      amount: 0,
      unit_of_measure: 'ea',
      tax_code: '',
      tax_rate: 0,
      tax_amount: 0
    }])
    setMemo('')
    setCustomerMessage('')
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)

    try {
      // Parse address data for structured storage
      const billToLines = billTo.split('\n').filter(line => line.trim())
      const shipToLines = shipTo.split('\n').filter(line => line.trim())

      // Create sales order with all required fields from database schema
      const salesOrderData = {
        so_number: soNumber,
        customer_id: customerId,
        sales_rep_id: salesReps.find(rep => `${rep.first_name} ${rep.last_name}` === salesRep)?.id || null,
        source_estimate_id: null, // Will be set if converting from estimate
        estimate_number: null, // Will be set if converting from estimate
        bill_to_company: billToLines[0] || null,
        bill_to_contact: null, // Not captured in current form
        bill_to_address_line_1: billToLines[1] || null,
        bill_to_address_line_2: billToLines[2] || null,
        bill_to_city: null, // Parse from address if needed
        bill_to_state: null, // Parse from address if needed
        bill_to_zip: null, // Parse from address if needed
        bill_to_country: 'US', // Default to US
        ship_to_company: shipToLines[0] || null,
        ship_to_contact: null, // Not captured in current form
        ship_to_address_line_1: shipToLines[1] || null,
        ship_to_address_line_2: shipToLines[2] || null,
        ship_to_city: null, // Parse from address if needed
        ship_to_state: null, // Parse from address if needed
        ship_to_zip: null, // Parse from address if needed
        ship_to_country: 'US', // Default to US
        ship_to_same_as_billing: shipSameAsBill,
        order_date: date,
        ship_date: shipDate || null,
        due_date: null, // Not captured in current form
        reference_number: poNumber || null,
        job_name: null, // Not captured in current form
        subtotal,
        tax_rate: defaultTaxRate,
        tax_amount: taxAmount,
        shipping_amount: 0, // Default to 0
        discount_amount: 0, // Default to 0
        discount_percent: 0, // Default to 0
        total_amount: total,
        status: 'PENDING' as const,
        converted_to_invoice_id: null,
        invoiced_at: null,
        has_purchase_orders: false,
        internal_notes: memo || null,
        customer_notes: customerMessage || null,
        terms_and_conditions: terms || null,
        version: 1,
        last_modified_by: user?.id || null
      }

      const { data: salesOrder, error: soError } = await supabase
        .from('sales_orders')
        .insert([salesOrderData])
        .select(`
          *,
          customers (name, email),
          sales_reps (first_name, last_name, employee_code)
        `)
        .single()

      if (soError) throw soError

      // Create sales order lines
      const salesOrderLines = lineItems
        .filter(item => item.description.trim())
        .map((item, index) => ({
          sales_order_id: salesOrder.id,
          line_number: index + 1,
          product_id: item.product_id || null,
          item_code: item.item || null,
          description: item.description || null,
          quantity: item.qty || 1,
          quantity_shipped: 0,
          quantity_invoiced: 0,
          quantity_reserved: 0,
          unit_price: item.rate || 0,
          unit_of_measure: item.unit_of_measure || 'each',
          discount_percent: 0,
          discount_amount: 0,
          tax_code: item.is_taxable ? 'TAX' : null,
          tax_rate: item.tax_rate || 0,
          tax_amount: item.tax_amount || 0,
          line_total: item.amount || ((item.qty || 1) * (item.rate || 0)),
          fulfillment_status: 'PENDING' as const,
          source_estimate_line_id: null
        }))

      if (salesOrderLines.length > 0) {
        const { error: linesError } = await supabase
          .from('sales_order_lines')
          .insert(salesOrderLines)

        if (linesError) throw linesError
      }

      // Update customer address if it was modified in the sales order
      try {
        const billToLines = billTo.split('\n').filter(line => line.trim())
        const shipToLines = shipTo.split('\n').filter(line => line.trim())

        // Extract address from billTo (skip company name on first line)
        const billingAddress = billToLines.slice(1).join('\n').trim()
        const shippingAddress = shipSameAsBill ? billingAddress : shipToLines.slice(1).join('\n').trim()

        if (billingAddress || shippingAddress) {
          const { error: customerUpdateError } = await supabase
            .from('customers')
            .update({
              billing_address: billingAddress || null,
              shipping_address: shippingAddress || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', customerId)

          if (customerUpdateError) {
            console.warn('Failed to update customer address:', customerUpdateError)
            // Don't throw - sales order was saved successfully
          }
        }
      } catch (addressUpdateError) {
        console.warn('Error updating customer address:', addressUpdateError)
        // Don't throw - sales order was saved successfully
      }

      // Clear unsaved changes flag since we just saved successfully
      setHasUnsavedChanges(false)

      onSave(salesOrder)
    } catch (error) {
      console.error('Error saving sales order:', error)
      alert('Error saving sales order. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header Bar - Matching Estimates Structure */}
      <div className="bg-gray-100 border-b">
        {/* Top Row - Navigation and Title */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {/* Navigation Controls */}
            <div className="flex items-center gap-1">
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0" 
                disabled={salesOrders.length === 0}
                onClick={handlePrevious}
                title="Navigate to last sales order"
              >
                <ArrowLeft className={`w-4 h-4 ${salesOrders.length > 0 ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0" 
                disabled={salesOrders.length === 0}
                onClick={handleNext}
                title="Navigate to first sales order"
              >
                <ArrowRight className={`w-4 h-4 ${salesOrders.length > 0 ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled>
                <Search className="w-4 h-4 text-gray-400" />
              </Button>
            </div>

            {/* Title with unsaved indicator */}
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-gray-800">Create Sales Order</h1>
              {hasUnsavedChanges && (
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-xs">Unsaved</span>
                </div>
              )}
            </div>
          </div>

          {/* Template Selection */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Template:</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs min-w-24"
            >
              <option value="">Default</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bottom Row - Action Buttons */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1">
            {/* Conversion Actions */}
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleCreatePO}>
              <FileCheck className="w-3 h-3 mr-1" /> Create PO
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" disabled>
              <Receipt className="w-3 h-3 mr-1" /> Create Invoice
            </Button>
            
            {/* Divider */}
            <div className="h-4 w-px bg-gray-300 mx-1" />
            
            {/* View Actions */}
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowPreview(true)}>
              <Eye className="w-3 h-3 mr-1" /> Preview
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowProfitCalculator(true)}>
              <Calculator className="w-3 h-3 mr-1" /> Profit
            </Button>
            
            {/* Divider */}
            <div className="h-4 w-px bg-gray-300 mx-1" />
            
            {/* Communication Actions */}
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={handlePrint}>
              <Printer className="w-3 h-3 mr-1" /> Print
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleEmail}>
              <Mail className="w-3 h-3 mr-1" /> Email
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleDuplicate}>
              <Copy className="w-3 h-3 mr-1" /> Duplicate
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {/* Template Settings */}
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowTemplateEditor(true)}>
              <Settings2 className="w-3 h-3 mr-1" /> Template
            </Button>
            
            {/* Divider */}
            <div className="h-4 w-px bg-gray-300 mx-1" />
            
            {/* Primary Actions */}
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-xs h-7">
              <Save className="w-3 h-3 mr-1" /> {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} className="text-xs h-7">
              <X className="w-3 h-3 mr-1" /> Close
            </Button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-auto p-6 bg-white">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Customer and SO Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer *</label>
            <div className="relative" ref={customerDropdownRef}>
              <Input
                value={customer}
                onChange={(e) => {
                  setCustomer(e.target.value)
                  setCustomerDropdown(e.target.value.length > 0)
                }}
                placeholder="Select or search customer..."
                className="pr-10"
                onFocus={() => setCustomerDropdown(true)}
              />
              {customerDropdown && (
                <div className="absolute z-20 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                  {customers
                    .filter(c => ((c as any).company_name || c.name || '').toLowerCase().includes(customer.toLowerCase()))
                    .map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCustomer((c as any).company_name || c.name || '')
                          setCustomerId(c.id)
                          setCustomerDropdown(false)

                          // Auto-populate address from customer record
                          let billToText = (c as any).company_name || c.name || ''
                          if (c.billing_address) {
                            billToText += '\n' + c.billing_address
                          }
                          if (c.phone) {
                            billToText += '\nPhone: ' + c.phone
                          }
                          if (c.email) {
                            billToText += '\nEmail: ' + c.email
                          }
                          setBillTo(billToText)

                          // Set shipping address if different
                          if (c.shipping_address && c.shipping_address !== c.billing_address) {
                            setShipTo(((c as any).company_name || c.name || '') + '\n' + c.shipping_address)
                            setShipSameAsBill(false)
                          } else {
                            setShipTo(billToText)
                            setShipSameAsBill(true)
                          }
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm"
                      >
                        <div className="font-medium">{(c as any).company_name || c.name}</div>
                        {c.email && <div className="text-xs text-gray-500">{c.email}</div>}
                      </button>
                    ))}
                    
                    {customer && !customers.find(c => ((c as any).company_name || c.name || '').toLowerCase() === customer.toLowerCase()) && (
                      <button
                        onClick={handleQuickAddCustomer}
                        className="w-full px-3 py-2 text-left bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100"
                      >
                        <Plus className="w-3 h-3 inline mr-1" />
                        Quick Add: {customer}
                      </button>
                    )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">SO Number</label>
            <Input
              value={soNumber}
              onChange={(e) => setSoNumber(e.target.value)}
              placeholder="SO-000001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Order Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ship Date</label>
            <Input
              type="date"
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Line Items</h3>
            <Button onClick={addLineItem} size="sm" className="flex items-center gap-2">
              <Plus className="w-3 h-3" />
              Add Line
            </Button>
          </div>
          
          <table className="w-full" ref={tableRef}>
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase relative group" style={{width: `${columnWidths.item}px`, minWidth: '60px'}}>
                  Item
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={() => handleStartResize('item')}
                  ></div>
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase relative group" style={{width: `${columnWidths.description}px`, minWidth: '100px'}}>
                  Description
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={() => handleStartResize('description')}
                  ></div>
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase relative group" style={{width: `${columnWidths.qty}px`, minWidth: '60px'}}>
                  Qty
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={() => handleStartResize('qty')}
                  ></div>
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase relative group" style={{width: `${columnWidths.rate}px`, minWidth: '60px'}}>
                  Rate
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={() => handleStartResize('rate')}
                  ></div>
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase relative group" style={{width: `${columnWidths.tax}px`, minWidth: '60px'}}>
                  Tax
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={() => handleStartResize('tax')}
                  ></div>
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 uppercase relative group" style={{width: `${columnWidths.amount}px`, minWidth: '60px'}}>
                  Amount
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={() => handleStartResize('amount')}
                  ></div>
                </th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <ContextMenu
                  key={item.id}
                  options={[
                    {
                      id: 'insert',
                      label: 'Insert Line After',
                      icon: <Plus className="w-4 h-4" />,
                      onClick: () => insertLineAfter(item.id)
                    },
                    {
                      id: 'delete',
                      label: 'Delete Line',
                      icon: <Trash2 className="w-4 h-4" />,
                      onClick: () => removeLineItem(item.id),
                      disabled: lineItems.length <= 1
                    }
                  ]}
                >
                  <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 relative" style={{width: `${columnWidths.item}px`}}>
                      <div ref={el => { if (el) itemDropdownRefs.current[item.id] = el }}>
                        <Input
                          value={item.item}
                          onChange={(e) => handleItemSearch(item.id, e.target.value)}
                          placeholder="Item/SKU"
                          className="text-sm border-0 bg-transparent focus:bg-white focus:border focus:shadow-sm"
                          onFocus={() => setActiveItemDropdowns(prev => ({ ...prev, [item.id]: true }))}
                        />
                        
                        {activeItemDropdowns[item.id] && getFilteredProducts(item.id).length > 0 && (
                          <div className="absolute z-10 w-64 mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-auto">
                            {getFilteredProducts(item.id).map(product => (
                              <button
                                key={product.id}
                                onClick={() => selectProduct(item.id, product)}
                                className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm"
                              >
                                <div className="font-medium">{product.sku || product.name}</div>
                                <div className="text-xs text-gray-500">{product.name}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  
                  <td className="px-3 py-2" style={{width: `${columnWidths.description}px`}}>
                    <Textarea
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      placeholder="Description"
                      rows={1}
                      className="text-sm border-0 bg-transparent focus:bg-white focus:border focus:shadow-sm resize-y min-h-[32px]"
                    />
                  </td>
                  
                  <td className="px-3 py-2" style={{width: `${columnWidths.qty}px`}}>
                    <Input
                      type="number"
                      step="any"
                      value={item.qty}
                      onChange={(e) => updateLineItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                      className="text-sm text-right border-0 bg-transparent focus:bg-white focus:border focus:shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>
                  
                  <td className="px-3 py-2" style={{width: `${columnWidths.rate}px`}}>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                      className="text-sm text-right border-0 bg-transparent focus:bg-white focus:border focus:shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>
                  
                  <td className="px-2 py-2" style={{width: `${columnWidths.tax}px`}}>
                    <TaxCodeDropdown
                      value={item.tax_code}
                      onChange={(taxCode: any) => {
                        updateLineItem(item.id, 'tax_code', taxCode?.code || '')
                        updateLineItem(item.id, 'tax_rate', taxCode?.tax_rate || 0)
                        const taxAmount = (item.rate * item.qty) * ((taxCode?.tax_rate || 0) / 100)
                        updateLineItem(item.id, 'tax_amount', taxAmount)
                      }}
                      placeholder="Tax"
                      className="text-xs"
                      compact={true}
                    />
                  </td>
                  
                  <td className="px-3 py-2 text-right text-sm font-medium" style={{width: `${columnWidths.amount}px`}}>
                    ${item.amount.toFixed(2)}
                  </td>
                  
                  <td className="px-2 py-2">
                    {lineItems.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeLineItem(item.id)}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </td>
                </tr>
                </ContextMenu>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end">
          <div className="w-80 bg-gray-50 border rounded p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax ({defaultTaxRate}%):</span>
                <span>${taxAmount.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between text-base font-semibold pt-2 border-t">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Memo (Internal)</label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              placeholder="Internal notes..."
              className="text-sm resize-y"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer Message</label>
            <Textarea
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              rows={3}
              placeholder="Message to customer..."
              className="text-sm resize-y"
            />
          </div>
        </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col">
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Sales Order Preview</h2>
                <span className="text-sm text-gray-500">
                  {selectedTemplateId ? templates.find(t => t.id === selectedTemplateId)?.name || 'Custom Template' : 'Default Template'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-1" /> Print
                </Button>
                <Button size="sm" variant="outline" onClick={handleEmail}>
                  <Mail className="w-4 h-4 mr-1" /> Email
                </Button>
                <Button size="sm" variant="outline" onClick={handleDuplicate}>
                  <Copy className="w-4 h-4 mr-1" /> Duplicate
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowPreview(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              <div className="bg-white shadow-lg max-w-2xl mx-auto" style={{ minHeight: '11in', aspectRatio: '8.5/11' }}>
                {/* Document Header */}
                <div className="p-8 border-b">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">SALES ORDER</h1>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><strong>SO #:</strong> {soNumber}</p>
                        <p><strong>Date:</strong> {new Date(date).toLocaleDateString()}</p>
                        {shipDate && <p><strong>Ship Date:</strong> {new Date(shipDate).toLocaleDateString()}</p>}
                        {poNumber && <p><strong>P.O. #:</strong> {poNumber}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="w-24 h-24 bg-gray-200 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-500 mb-2">
                        LOGO
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold">Your Company Name</p>
                        <p>123 Business Street</p>
                        <p>City, ST 12345</p>
                        <p>(555) 123-4567</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="p-8 border-b">
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Customer:</h3>
                    <div className="text-sm text-gray-600">
                      {customer || 'Customer Name'}
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div className="p-8">
                  <table className="w-full mb-6">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-2 text-sm font-semibold text-gray-700">ITEM</th>
                        <th className="text-left py-2 text-sm font-semibold text-gray-700">DESCRIPTION</th>
                        <th className="text-right py-2 text-sm font-semibold text-gray-700">QTY</th>
                        <th className="text-right py-2 text-sm font-semibold text-gray-700">RATE</th>
                        <th className="text-right py-2 text-sm font-semibold text-gray-700">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.filter(item => item.description.trim()).map((item, index) => (
                        <tr key={item.id} className="border-b border-gray-200">
                          <td className="py-3 text-sm">{item.item}</td>
                          <td className="py-3 text-sm">{item.description}</td>
                          <td className="py-3 text-sm text-right">{item.qty}</td>
                          <td className="py-3 text-sm text-right">${item.rate.toFixed(2)}</td>
                          <td className="py-3 text-sm text-right font-medium">${item.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                      {lineItems.filter(item => item.description.trim()).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                            No line items added yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      {taxAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Tax ({defaultTaxRate}%):</span>
                          <span>${taxAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-semibold border-t pt-2">
                        <span>Total:</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {(customerMessage || terms) && (
                    <div className="mt-8 space-y-4">
                      {customerMessage && (
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Notes:</h4>
                          <p className="text-sm text-gray-600 whitespace-pre-line">{customerMessage}</p>
                        </div>
                      )}
                      {terms && (
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Terms:</h4>
                          <p className="text-sm text-gray-600">{terms}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profit Calculator Modal */}
      {showProfitCalculator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col">
            {/* Profit Calculator Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <Calculator className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold">Profit Calculator</h2>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowProfitCalculator(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Profit Calculator Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">${subtotal.toFixed(2)}</div>
                  <div className="text-sm text-blue-800">Total Revenue</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-600">${totalCost.toFixed(2)}</div>
                  <div className="text-sm text-red-800">Total Cost</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">${totalProfit.toFixed(2)}</div>
                  <div className="text-sm text-green-800">Total Profit</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">{profitMargin.toFixed(1)}%</div>
                  <div className="text-sm text-purple-800">Profit Margin</div>
                </div>
              </div>

              {/* Line Item Breakdown */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Line Item Breakdown</h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full min-w-[1000px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost Each</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate Each</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Revenue</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Profit</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {lineItems.filter(item => item.description.trim()).map((item, index) => {
                        const inventoryItem = inventory.find(inv => inv.product_id === item.product_id)
                        const product = products.find(p => p.id === item.product_id)
                        const costEach = (inventoryItem as any)?.weighted_average_cost || (product as any)?.cost || 0
                        const totalItemCost = costEach * item.qty
                        const totalItemRevenue = item.amount
                        const itemProfit = totalItemRevenue - totalItemCost
                        const itemMargin = totalItemRevenue > 0 ? (itemProfit / totalItemRevenue) * 100 : 0

                        return (
                          <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 text-sm">
                              <div className="font-medium">{item.item || 'N/A'}</div>
                              <div className="text-xs text-gray-500 truncate">{item.description}</div>
                            </td>
                            <td className="px-4 py-2 text-sm text-right">{item.qty}</td>
                            <td className="px-4 py-2 text-sm text-right">
                              <span className={costEach === 0 ? 'text-amber-600' : ''}>
                                ${costEach.toFixed(2)}
                                {costEach === 0 && <span className="text-xs ml-1">(No Cost)</span>}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-right">${item.rate.toFixed(2)}</td>
                            <td className="px-4 py-2 text-sm text-right">${totalItemCost.toFixed(2)}</td>
                            <td className="px-4 py-2 text-sm text-right font-medium">${totalItemRevenue.toFixed(2)}</td>
                            <td className="px-4 py-2 text-sm text-right">
                              <span className={itemProfit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                ${itemProfit.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              <span className={itemMargin >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {itemMargin.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                      {lineItems.filter(item => item.description.trim()).length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                            No line items to analyze
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {newCustomerModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 space-y-4">
            <h3 className="text-lg font-semibold">Quick Add Customer</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <Input
                value={newCustomerModal.name}
                onChange={(e) => setNewCustomerModal(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                value={newCustomerModal.email}
                onChange={(e) => setNewCustomerModal(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input
                value={newCustomerModal.phone}
                onChange={(e) => setNewCustomerModal(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <Textarea
                value={newCustomerModal.address}
                onChange={(e) => setNewCustomerModal(prev => ({ ...prev, address: e.target.value }))}
                rows={2}
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setNewCustomerModal({ show: false, name: '', email: '', phone: '', address: '' })}
              >
                Cancel
              </Button>
              <Button
                onClick={saveNewCustomer}
                className="bg-green-600 hover:bg-green-700"
              >
                Save & Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor */}
      {showTemplateEditor && (
        <TemplateEditor
          onClose={() => setShowTemplateEditor(false)}
          templateType="sales_order"
          currentTemplateId={selectedTemplateId}
        />
      )}
    </div>
  )
}