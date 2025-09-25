'use client'

import { useState, useEffect, useRef } from 'react'
import { useDefaultTaxRate } from '@/hooks/useDefaultTaxRate'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { X, Save, Printer, Mail, Copy, Plus, Trash2, Settings2, Eye, FileText, Calculator, Users, ArrowLeft, ArrowRight, Search, FileCheck, Receipt, AlertTriangle } from 'lucide-react'
import TemplateEditor from '@/components/templates/template-editor'
import CollaborationIndicator from '@/components/ui/collaboration-indicator'
// import TaxCodeDropdown from '@/components/ui/tax-code-dropdown' // No longer needed - using simple taxable checkbox
import ContextMenu from '@/components/ui/context-menu'
import DocumentFlowTracker, { DocumentRelationship } from '@/components/ui/document-flow-tracker'
import TermsSelector from '@/components/ui/terms-selector'
import AuditInfo from '@/components/ui/audit-info'

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
  payment_terms_relation?: { name: string } | null
}
type SalesRep = Database['public']['Tables']['sales_reps']['Row']
type EstimateTemplate = Database['public']['Tables']['estimate_templates']['Row']
type Product = Database['public']['Tables']['products']['Row']
type Estimate = Database['public']['Tables']['estimates']['Row'] & {
  customers?: { name: string; email: string | null }
  sales_reps?: { first_name: string; last_name: string; employee_code: string }
  estimate_templates?: { name: string }
}
type EstimateLine = Database['public']['Tables']['estimate_lines']['Row']

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

interface EditEstimateQuickBooksStyleProps {
  estimate: Estimate
  onSave: (estimate: Estimate) => void
  onCancel: () => void
  onDelete?: (estimate: Estimate) => void
  estimates?: Estimate[]
  onNavigate?: (estimate: Estimate) => void
}

interface NewCustomerModal {
  show: boolean
  name: string
  email: string
  phone: string
  address: string
}

export default function EditEstimateQuickBooksStyle({ estimate, onSave, onCancel, onDelete, estimates = [], onNavigate }: EditEstimateQuickBooksStyleProps) {
  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [templates, setTemplates] = useState<EstimateTemplate[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [estimateLines, setEstimateLines] = useState<EstimateLine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Header fields
  const [customer, setCustomer] = useState(estimate.customers?.name || '')
  const [customerId, setCustomerId] = useState(estimate.customer_id)
  const [customerDropdown, setCustomerDropdown] = useState(false)
  const [estimateNumber, setEstimateNumber] = useState(estimate.estimate_number)
  const [date, setDate] = useState(estimate.estimate_date)
  const [expirationDate, setExpirationDate] = useState(estimate.expiration_date || '')
  const [poNumber, setPoNumber] = useState(estimate.reference_number || '')
  const [salesRep, setSalesRep] = useState('')
  const [terms, setTerms] = useState(estimate.terms_and_conditions || '')

  // Address fields
  const [billTo, setBillTo] = useState('')
  const [shipTo, setShipTo] = useState('')
  const [shipSameAsBill, setShipSameAsBill] = useState<boolean>(estimate.ship_to_same_as_billing ?? true)

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [activeItemDropdowns, setActiveItemDropdowns] = useState<{[key: string]: boolean}>({})

  // Totals
  const [subtotal, setSubtotal] = useState(estimate.subtotal)
  const [taxAmount, setTaxAmount] = useState(estimate.tax_amount)
  const [total, setTotal] = useState(estimate.total_amount)
  
  // Get backend-controlled tax rate from settings
  const { defaultTaxRate } = useDefaultTaxRate()
  const { user } = useAuth()
  
  // Profit calculations
  const [totalCost, setTotalCost] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [profitMargin, setProfitMargin] = useState(0)
  const [showProfitCalculator, setShowProfitCalculator] = useState(false)

  // Notes
  const [memo, setMemo] = useState(estimate.internal_notes || '')
  const [customerMessage, setCustomerMessage] = useState(estimate.customer_notes || '')

  // New customer modal
  const [newCustomerModal, setNewCustomerModal] = useState<NewCustomerModal>({
    show: false,
    name: '',
    email: '',
    phone: '',
    address: ''
  })

  // Refs for click outside handling
  const customerDropdownRef = useRef<HTMLDivElement>(null)
  const itemDropdownRefs = useRef<{[key: string]: HTMLDivElement | null}>({})
  
  // Template editor state
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState(estimate.template_id || '')
  const [showPreview, setShowPreview] = useState(false)

  // Collaboration state
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [currentUserId] = useState('current-user') // This would come from auth context
  
  // Navigation and change tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Add browser-level unsaved changes warning
  useUnsavedChangesWarning(hasUnsavedChanges, 'You have unsaved changes to this estimate. Are you sure you want to leave?')

  // Calculate totals from line items with simplified tax
  useEffect(() => {
    const newSubtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)
    
    // Calculate taxable subtotal (only items marked as taxable)
    const taxableSubtotal = lineItems
      .filter(item => item.is_taxable)
      .reduce((sum, item) => sum + (item.amount || 0), 0)
    
    // Use the backend-controlled tax rate
    const newTaxAmount = (taxableSubtotal * defaultTaxRate) / 100
    const newTotal = newSubtotal + newTaxAmount

    setSubtotal(newSubtotal)
    setTaxAmount(newTaxAmount)
    setTotal(newTotal)
  }, [lineItems])
  const [showFindEstimate, setShowFindEstimate] = useState(false)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  
  // Document relationships
  const [documentRelationships, setDocumentRelationships] = useState<DocumentRelationship>({})

  // Load document relationships
  const loadDocumentRelationships = async () => {
    try {
      const relationships: DocumentRelationship = {
        estimate: {
          id: estimate.id,
          number: estimate.estimate_number,
          status: estimate.status,
          date: estimate.estimate_date,
          amount: estimate.total_amount
        }
      }

      // Check for related sales order
      if (estimate.converted_to_sales_order_id) {
        const { data: salesOrder, error: soError } = await supabase
          .from('sales_orders')
          .select('*')
          .eq('id', estimate.converted_to_sales_order_id)
          .single()

        if (!soError && salesOrder) {
          relationships.salesOrder = {
            id: salesOrder.id,
            number: salesOrder.so_number,
            status: salesOrder.status,
            date: salesOrder.order_date,
            amount: salesOrder.total_amount
          }

          // Check for related invoices through the sales order (multi-invoice model)
          const { data: invoices, error: invError } = await supabase
            .from('invoices')
            .select('*')
            .eq('sales_order_id', salesOrder.id)
            .order('created_at', { ascending: false })
          
          if (!invError && invoices && invoices.length > 0) {
            if (invoices.length === 1) {
              // Single invoice - use legacy format
              const invoice = invoices[0] 
              relationships.invoice = {
                id: invoice.id,
                number: invoice.invoice_number,
                status: invoice.status,
                date: invoice.invoice_date,
                amount: invoice.total_amount
              }
            } else {
              // Multiple invoices - use array format
              relationships.invoices = invoices.map(invoice => ({
                id: invoice.id,
                number: invoice.invoice_number,
                status: invoice.status,
                date: invoice.invoice_date,
                amount: invoice.total_amount,
                sequence: invoice.invoice_sequence || 1,
                isPartial: invoice.is_partial_invoice || false,
                isFinal: invoice.is_final_invoice || false
              }))
            }
          }
          
          // Legacy code block (converted_to_invoice_id no longer exists):
          if (false) { // salesOrder.converted_to_invoice_id) {
            const { data: invoice, error: invError } = await supabase
              .from('invoices')
              .select('*')
              .eq('id', (salesOrder as any).converted_to_invoice_id)
              .single()
            if (!invError && invoice) {
              relationships.invoice = {
                id: invoice.id,
                number: invoice.invoice_number,
                status: invoice.status,
                date: invoice.invoice_date,
                amount: invoice.total_amount || 0
              }
            }
          }

          // Check for related purchase orders through the sales order source reference
          const { data: purchaseOrders, error: poError } = await supabase
            .from('purchase_orders')
            .select('*')
            .eq('source_sales_order_id', salesOrder.id)

          if (!poError && purchaseOrders && purchaseOrders.length > 0) {
            if (purchaseOrders.length === 1) {
              // Single purchase order - use legacy format
              const po = purchaseOrders[0]
              relationships.purchaseOrder = {
                id: po.id,
                number: po.po_number,
                status: po.status,
                date: po.order_date,
                amount: po.total_amount || 0
              }
            } else {
              // Multiple purchase orders - use array format
              relationships.purchaseOrders = purchaseOrders.map(po => ({
                id: po.id,
                number: po.po_number,
                status: po.status,
                date: po.order_date,
                amount: po.total_amount || 0
              }))
            }
          }
        } else if (soError && soError.code === 'PGRST116') {
          // SO was deleted, clear the reference in the estimate
          console.log('Referenced SO no longer exists, clearing estimate reference')
          await supabase
            .from('estimates')
            .update({ converted_to_sales_order_id: null })
            .eq('id', estimate.id)
        }
      }

      // Also check for direct invoice reference (when invoice is created directly from estimate)
      // Multi-invoice model - estimates don't have direct converted_to_invoice_id references
      if (false && !relationships.invoice) { // Legacy: estimate.converted_to_invoice_id
        const { data: directInvoice, error: directInvError } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', (estimate as any).converted_to_invoice_id)
          .single()

        if (!directInvError && directInvoice) {
          relationships.invoice = {
            id: directInvoice.id,
            number: directInvoice.invoice_number,
            status: directInvoice.status,
            date: directInvoice.invoice_date,
            amount: directInvoice.total_amount || 0
          }
        } else if (directInvError && (directInvError as any).code === 'PGRST116') {
          // Invoice was deleted, clear the reference in the estimate
          console.log('Referenced invoice no longer exists, clearing estimate reference')
          await supabase
            .from('estimates')
            .update({ converted_to_invoice_id: null } as any)
            .eq('id', estimate.id)
        }
      }

      setDocumentRelationships(relationships)
    } catch (error) {
      console.error('Error loading document relationships:', error)
    }
  }

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

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle customer dropdown
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setCustomerDropdown(false)
      }

      // Handle item dropdowns
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
    fetchEstimateLines()
    loadDocumentRelationships()
  }, [])

  // Add visibility change listener to refresh docflow when tab becomes active
  // This handles cases where POs are created from related SOs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible, refresh docflow to catch any new relationships
        loadDocumentRelationships()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [estimate.id])

  // Column resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !tableRef.current) return
      
      const table = tableRef.current
      const rect = table.getBoundingClientRect()
      const x = e.clientX - rect.left
      
      // Calculate new width based on mouse position
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
    // Reset all form fields when estimate changes (for navigation)
    setCustomer(estimate.customers?.name || '')
    setCustomerId(estimate.customer_id || '')
    setEstimateNumber(estimate.estimate_number || '')
    setDate(estimate.estimate_date || '')
    setExpirationDate(estimate.expiration_date || '')
    setPoNumber(estimate.reference_number || '')
    setTerms(estimate.terms_and_conditions || '')
    setMemo(estimate.internal_notes || '')
    setCustomerMessage(estimate.customer_notes || '')
    setSelectedTemplateId(estimate.template_id || '')
    setShipSameAsBill(estimate.ship_to_same_as_billing || false)

    // Set sales rep name
    if (estimate.sales_reps) {
      setSalesRep(`${estimate.sales_reps.first_name} ${estimate.sales_reps.last_name}`)
    } else {
      setSalesRep('')
    }

    // Set addresses
    const billToLines = []
    if (estimate.bill_to_company) billToLines.push(estimate.bill_to_company)
    if (estimate.bill_to_address_line_1) billToLines.push(estimate.bill_to_address_line_1)
    if (estimate.bill_to_address_line_2) billToLines.push(estimate.bill_to_address_line_2)
    setBillTo(billToLines.join('\n'))

    const shipToLines = []
    if (estimate.ship_to_company) shipToLines.push(estimate.ship_to_company)
    if (estimate.ship_to_address_line_1) shipToLines.push(estimate.ship_to_address_line_1)
    if (estimate.ship_to_address_line_2) shipToLines.push(estimate.ship_to_address_line_2)
    setShipTo(shipToLines.join('\n'))

    // Fetch line items for the new estimate
    fetchEstimateLines()

    // Reset unsaved changes flag when navigating to new estimate
    setHasUnsavedChanges(false)
  }, [estimate])

  useEffect(() => {
    // Calculate totals
    const newSubtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
    
    // Calculate tax using backend tax rate
    const taxableSubtotal = lineItems
      .filter(item => item.is_taxable)
      .reduce((sum, item) => sum + (item.amount || 0), 0)
    const newTaxAmount = (taxableSubtotal * defaultTaxRate) / 100
    const newTotal = newSubtotal + newTaxAmount
    
    // Calculate profit using inventory costs
    const newTotalCost = lineItems.reduce((sum, item) => {
      // Find the inventory item to get its weighted average cost
      const inventoryItem = inventory.find(inv => inv.product_id === item.product_id)
      const itemCost = (inventoryItem?.weighted_average_cost || 0) * item.qty
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
  }, [lineItems, inventory])

  useEffect(() => {
    // Update Ship To when Bill To changes and shipSameAsBill is true
    if (shipSameAsBill) {
      setShipTo(billTo)
    }
  }, [billTo, shipSameAsBill])

  // Track changes to mark as unsaved
  useEffect(() => {
    const originalData = {
      customer: estimate.customers?.name || '',
      estimateNumber: estimate.estimate_number,
      date: estimate.estimate_date,
      expirationDate: estimate.expiration_date || '',
      poNumber: estimate.reference_number || '',
      memo: estimate.internal_notes || '',
      customerMessage: estimate.customer_notes || '',
      terms: estimate.terms_and_conditions || ''
    }

    const currentData = {
      customer,
      estimateNumber,
      date,
      expirationDate,
      poNumber,
      memo,
      customerMessage,
      terms
    }

    const hasFormChanges = JSON.stringify(originalData) !== JSON.stringify(currentData)
    const hasLineChanges = lineItems.some((item, index) => {
      const originalLine = estimateLines[index]
      if (!originalLine) return item.description.trim() !== ''
      return (
        item.description !== originalLine.description ||
        item.qty !== originalLine.quantity ||
        item.rate !== originalLine.unit_price ||
        item.item !== (originalLine.sku || '')
      )
    }) || lineItems.length !== estimateLines.length

    setHasUnsavedChanges(hasFormChanges || hasLineChanges)
  }, [customer, estimateNumber, date, expirationDate, poNumber, memo, customerMessage, terms, lineItems, estimateLines, estimate])

  // Navigation logic for cycling through estimates
  const currentIndex = estimates.findIndex(est => est.id === estimate.id)
  const canNavigatePrevious = currentIndex > 0
  const canNavigateNext = currentIndex < estimates.length - 1

  const handlePrevious = () => {
    // Navigate to the appropriate estimate
    const targetIndex = currentIndex - 1
    const targetEstimate = estimates[targetIndex]

    if (onNavigate && targetEstimate) {
      onNavigate(targetEstimate)
    }
  }

  const handleNext = () => {
    // Navigate to the appropriate estimate  
    const targetIndex = currentIndex + 1
    const targetEstimate = estimates[targetIndex]

    if (onNavigate && targetEstimate) {
      onNavigate(targetEstimate)
    }
  }

  // Generate unique estimate number
  const generateUniqueEstimateNumber = async () => {
    const today = new Date()
    const year = today.getFullYear().toString().slice(-2)
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const day = today.getDate().toString().padStart(2, '0')
    
    let attempts = 0
    while (attempts < 10) { // Try up to 10 times
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      const newNumber = `${year}${month}${day}-${random}`
      
      // Check if this number exists
      const { data, error } = await supabase
        .from('estimates')
        .select('estimate_number')
        .eq('estimate_number', newNumber)
        .single()
      
      if (error && error.code === 'PGRST116') {
        // No rows found, this number is available
        return newNumber
      }
      
      attempts++
    }
    
    // Fallback: use timestamp if we can't find a unique number
    return `${year}${month}${day}-${Date.now().toString().slice(-4)}`
  }

  const fetchData = async () => {
    try {
      const [customersResult, salesRepsResult, templatesResult, productsResult, inventoryResult] = await Promise.all([
        supabase.from('customers').select('*, payment_terms(name)').order('name'),
        supabase.from('sales_reps').select('*').eq('is_active', true).order('first_name'),
        supabase.from('estimate_templates').select('*').order('name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('inventory').select('*, products(*)').order('products(name)')
      ])

      if (customersResult.data) setCustomers(customersResult.data)
      if (salesRepsResult.data) setSalesReps(salesRepsResult.data)
      if (templatesResult.data) {
        setTemplates(templatesResult.data)
      }
      if (productsResult.data) setProducts(productsResult.data)
      if (inventoryResult.data) setInventory(inventoryResult.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const fetchEstimateLines = async () => {
    try {
      const { data, error } = await supabase
        .from('estimate_lines')
        .select('*')
        .eq('estimate_id', estimate.id)
        .order('line_number')

      if (error) throw error

      if (data) {
        setEstimateLines(data)
        // Convert to LineItem format with simplified tax
        const items: LineItem[] = data.map(line => ({
          id: line.line_number.toString(),
          item: line.sku || '',
          description: line.description,
          qty: line.quantity,
          rate: line.unit_price,
          amount: line.quantity * line.unit_price,
          product_id: line.product_id || undefined,
          unit_of_measure: line.unit_of_measure || 'ea',
          // Use is_taxable field directly, fallback to checking tax_code for old data
          is_taxable: line.is_taxable ?? (line.tax_code && line.tax_code !== 'NON' && line.tax_rate > 0)
        }))
        setLineItems(items.length > 0 ? items : [
          { id: '1', item: '', description: '', qty: 1, rate: 0, amount: 0, unit_of_measure: 'ea', is_taxable: false }
        ])
      }
    } catch (error) {
      console.error('Error fetching estimate lines:', error)
      // Set default line item if fetch fails
      setLineItems([
        { id: '1', item: '', description: '', qty: 1, rate: 0, amount: 0, unit_of_measure: 'ea', tax_code: '', tax_rate: 0, tax_amount: 0 }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCustomerSearch = (value: string) => {
    setCustomer(value)
    setCustomerDropdown(true)
    
    // Check if this could be a new customer
    const existing = customers.find(c => 
      c.company_name.toLowerCase() === value.toLowerCase()
    )
    
    if (!existing && value.trim()) {
      // This might be a new customer name
    }
  }

  const selectCustomer = (customerData: Customer) => {
    setCustomer(customerData.company_name)
    setCustomerId(customerData.id)
    setCustomerDropdown(false)
    
    // Auto-fill payment terms from customer if available
    if (customerData.payment_terms_relation?.name) {
      setTerms(customerData.payment_terms_relation.name)
    }
    
    // Set Bill To with customer info
    let billToText = customerData.company_name
    if (customerData.address_line_1) {
      billToText += '\n' + customerData.address_line_1
    }
    if (customerData.phone) {
      billToText += '\nPhone: ' + customerData.phone
    }
    if (customerData.email) {
      billToText += '\nEmail: ' + customerData.email
    }
    setBillTo(billToText)
    
    // If ship same as bill, copy to Ship To
    if (shipSameAsBill) {
      setShipTo(billToText)
    }
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
    console.log('=== QUICK ADD CUSTOMER DEBUG ===')
    console.log('Modal data:', newCustomerModal)
    console.log('Current user:', user)
    
    try {
      const customerData = {
        name: newCustomerModal.name,  // Add name field for database compatibility
        company_name: newCustomerModal.name,
        contact_name: '',
        email: newCustomerModal.email || null,
        phone: newCustomerModal.phone || null,
        address_line_1: newCustomerModal.address || null,
        address_line_2: null,
        city: null,
        state: null,
        zip_code: null,
        country: 'USA',
        customer_type: 'RETAIL',
        payment_terms: 'NET30',  // Note: uppercase to match potential enum constraint
        payment_terms_id: null,
        credit_limit: 0,
        tax_exempt: false,
        notes: null,
        is_active: true,
        last_edited_by: user?.id || null
      }
      
      console.log('Customer data to insert:', customerData)
      
      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single()

      console.log('Supabase result:', { data, error })

      if (error) {
        console.error('Customer insert error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        throw error
      }

      setCustomers(prev => [...prev, data])
      setCustomer(data.company_name)
      setCustomerId(data.id)
      
      // Set Bill To with new customer info
      let billToText = data.company_name
      if (data.address_line_1) {
        billToText += '\n' + data.address_line_1
      }
      if (data.phone) {
        billToText += '\nPhone: ' + data.phone
      }
      if (data.email) {
        billToText += '\nEmail: ' + data.email
      }
      setBillTo(billToText)
      
      if (shipSameAsBill) {
        setShipTo(billToText)
      }
      
      setNewCustomerModal({ show: false, name: '', email: '', phone: '', address: '' })
      console.log('=== CUSTOMER CREATED SUCCESSFULLY ===')
    } catch (error) {
      console.error('=== CUSTOMER CREATE ERROR ===')
      console.error('Error:', error)
      
      let errorMessage = (error as any)?.message || 'Unknown error occurred'
      
      // Provide more specific error messages
      if (errorMessage.includes('violates check constraint')) {
        if (errorMessage.includes('payment_terms')) {
          errorMessage = 'Invalid payment terms format.'
        } else if (errorMessage.includes('customer_type')) {
          errorMessage = 'Invalid customer type. Must be RETAIL, WHOLESALE, or DISTRIBUTOR.'
        }
      } else if (errorMessage.includes('null value in column')) {
        const match = errorMessage.match(/null value in column "(\w+)"/)
        if (match) {
          errorMessage = `Missing required field: ${match[1]}`
        }
      }
      
      alert(`Failed to create customer:\n\n${errorMessage}\n\nCheck console for details.`)
    }
  }

  const handleItemSearch = (lineId: string, value: string) => {
    setLineItems(prev => prev.map(item =>
      item.id === lineId ? { ...item, item: value } : item
    ))
    setActiveItemDropdowns(prev => ({ ...prev, [lineId]: true }))
  }

  const selectProduct = (lineId: string, product: Product) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        // Find the inventory item for this product to get the actual sales price and tax info
        const inventoryItem = inventory.find(inv => inv.product_id === product.id)
        
        // Use sales price from inventory if available, otherwise from product, otherwise 0
        const salesPrice = inventoryItem?.sales_price || (product as any).unit_price || 0
        const defaultQty = item.qty || 1 // Use current qty or default to 1
        
        // Get tax code from inventory if set
        const defaultTaxCode = inventoryItem?.default_tax_code || ''
        const defaultTaxRate = inventoryItem?.default_tax_rate || 0
        
        const lineAmount = defaultQty * salesPrice
        const taxAmount = lineAmount * (defaultTaxRate / 100)
        
        return {
          ...item,
          item: product.sku || product.name,
          description: product.name,
          product_id: product.id,
          unit_of_measure: product.unit_of_measure || 'ea',
          qty: defaultQty,
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

  const updateLineItem = (lineId: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        const updated = { ...item, [field]: value }
        
        // Recalculate amount when qty or rate changes
        if (field === 'qty' || field === 'rate') {
          updated.amount = updated.qty * updated.rate
          
          // Recalculate tax amount if tax rate is set
          if (updated.tax_rate && updated.tax_rate > 0) {
            updated.tax_amount = updated.amount * (updated.tax_rate / 100)
          }
        }
        
        // Recalculate tax amount when tax rate changes
        if (field === 'tax_rate') {
          updated.tax_amount = updated.amount * ((value || 0) / 100)
        }
        
        return updated
      }
      return item
    }))
  }


  // Generate PDF template for printing/emailing
  const generatePDF = async (forDownload = false) => {
    const lineItemsHTML = lineItems.filter(item => item.description).map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.item}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.qty}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.rate.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.amount.toFixed(2)}</td>
      </tr>
    `).join('')

    const estimateHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Estimate ${estimateNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .company-info { margin-bottom: 20px; }
            .estimate-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .customer-info { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background-color: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
            .totals { text-align: right; margin-top: 20px; }
            .totals table { width: 300px; margin-left: auto; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
          </style>
          ${forDownload ? `
          <script>
            window.onload = function() {
              // Auto-download as HTML file
              const filename = 'Estimate_${estimateNumber}_${customer.replace(/[^a-zA-Z0-9]/g, '_')}.html';
              const element = document.createElement('a');
              const htmlContent = document.documentElement.outerHTML;
              const file = new Blob([htmlContent], {type: 'text/html'});
              element.href = URL.createObjectURL(file);
              element.download = filename;
              element.click();
              
              // Show instructions
              setTimeout(() => {
                alert('PDF downloaded as HTML file. You can:\\n1. Open the file and print to PDF\\n2. Or attach the HTML file directly to your email');
              }, 500);
            }
          </script>
          ` : ''}
        </head>
        <body>
          <div class="header">
            <h1>ESTIMATE</h1>
          </div>
          
          <div class="company-info">
            <strong>[Your Company Name]</strong><br>
            [Your Address]<br>
            [Phone] | [Email]
          </div>
          
          <div class="estimate-info">
            <div>
              <strong>Estimate #:</strong> ${estimateNumber}<br>
              <strong>Date:</strong> ${date}
            </div>
            <div>
              <strong>Valid Until:</strong> ${expirationDate || 'N/A'}<br>
              <strong>Terms:</strong> ${terms || 'Standard'}
            </div>
          </div>
          
          <div class="customer-info">
            <strong>Bill To:</strong><br>
            ${customer}<br>
            ${[estimate.bill_to_address_line_1, estimate.bill_to_address_line_2].filter(Boolean).join('<br>') || '[Address]'}
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Item/SKU</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHTML}
            </tbody>
          </table>
          
          <div class="totals">
            <table>
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">$${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Tax (${defaultTaxRate}%):</td>
                <td style="text-align: right;">$${taxAmount.toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td><strong>Total:</strong></td>
                <td style="text-align: right;"><strong>$${total.toFixed(2)}</strong></td>
              </tr>
            </table>
          </div>
          
          ${customerMessage ? `<div style="margin-top: 30px;"><strong>Notes:</strong><br>${customerMessage.replace(/\n/g, '<br>')}</div>` : ''}
        </body>
      </html>
    `
    
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(estimateHTML)
      printWindow.document.close()
      printWindow.focus()
      return printWindow
    }
    return null
  }

  // Print functionality - generates PDF template
  const handlePrint = async () => {
    const printWindow = await generatePDF()
    if (printWindow) {
      // Auto-trigger print dialog after a short delay
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }
  }

  // Email functionality - auto-downloads PDF and opens email
  const handleEmail = async () => {
    // Generate downloadable PDF
    const printWindow = await generatePDF(true)
    if (!printWindow) {
      alert('Failed to generate PDF. Please try again.')
      return
    }

    // Small delay to ensure download starts, then open email
    setTimeout(() => {
      const customerEmail = customers.find(c => c.id === customerId)?.email
      const subject = `Estimate ${estimateNumber} for ${customer}`
      const body = `Dear ${customer},

Please find attached the estimate ${estimateNumber}.

Estimate Summary:
- Date: ${date}
- Total: $${total.toFixed(2)}
- Terms: ${terms || 'Standard'}

Thank you for your business.

Best regards,
[Your Company Name]`
      
      const mailtoUrl = customerEmail 
        ? `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      
      window.location.href = mailtoUrl
    }, 2000)
  }

  // Duplicate functionality - creates new estimate record
  const handleDuplicate = async () => {
    // Check if current estimate has unsaved changes
    if (hasUnsavedChanges) {
      const shouldSave = confirm('You have unsaved changes. Would you like to save the current estimate before duplicating?')
      if (shouldSave) {
        const success = await handleSave()
        if (!success) {
          alert('Failed to save current estimate. Duplication cancelled.')
          return
        }
      }
    }

    try {
      // Generate unique estimate number
      const newEstimateNumber = await generateUniqueEstimateNumber()

      // Create new estimate record with current data but new number
      const newEstimateData = {
        estimate_number: newEstimateNumber,
        customer_id: customerId || null,
        estimate_date: new Date().toISOString().split('T')[0],
        expiration_date: expirationDate?.trim() || null,
        reference_number: estimate.reference_number?.trim() || null,
        bill_to_company: estimate.bill_to_company?.trim() || null,
        bill_to_address_line_1: estimate.bill_to_address_line_1?.trim() || null,
        bill_to_address_line_2: estimate.bill_to_address_line_2?.trim() || null,
        ship_to_company: estimate.ship_to_company?.trim() || null,
        ship_to_address_line_1: estimate.ship_to_address_line_1?.trim() || null,
        ship_to_address_line_2: estimate.ship_to_address_line_2?.trim() || null,
        ship_to_same_as_billing: estimate.ship_to_same_as_billing || false,
        sales_rep_id: (salesReps.find(rep => `${rep.first_name} ${rep.last_name}` === salesRep)?.id) || null,
        template_id: selectedTemplateId?.trim() || null,
        terms_and_conditions: terms?.trim() || null,
        internal_notes: memo?.trim() || null,
        customer_notes: customerMessage?.trim() || null,
        discount_percentage: (estimate as any).discount_percentage || 0,
        subtotal: subtotal || 0,
        tax_rate: defaultTaxRate,
        tax_amount: taxAmount || 0,
        total_amount: total || 0,
        status: estimate.status || 'PENDING',
        updated_at: new Date().toISOString()
      }

      const { data: newEstimate, error: estimateError } = await supabase
        .from('estimates')
        .insert([newEstimateData])
        .select()
        .single()

      if (estimateError) throw estimateError

      // Create line items for the new estimate
      const newLineItems = lineItems
        .filter(item => item.description?.trim()) // Only include items with descriptions
        .map((item, index) => ({
          estimate_id: newEstimate.id,
          line_number: index + 1,
          product_id: item.product_id?.trim() || null,
          sku: item.item?.trim() || null,
          description: item.description?.trim() || '',
          quantity: item.qty || 0,
          unit_price: item.rate || 0,
          unit_of_measure: item.unit_of_measure?.trim() || 'ea',
          item_type: 'PRODUCT' as const,
          sort_order: index + 1,
          tax_code: item.tax_code?.trim() || null,
          tax_rate: item.tax_rate || 0,
          tax_amount: item.tax_amount || 0
        }))

      if (newLineItems.length > 0) {
        const { error: lineItemsError } = await supabase
          .from('estimate_lines')
          .insert(newLineItems)

        if (lineItemsError) throw lineItemsError
      }

      // Show success message
      alert(`Estimate duplicated successfully with number: ${newEstimateNumber}!\n\nNow opening the duplicate for editing...`)
      
      // Instead of going back to list, immediately open the duplicate for editing
      // We need to close this modal and open a new one with the duplicate
      if (onSave) {
        onSave(newEstimate)
      }
      
      // Small delay to ensure the callback completes, then trigger opening the duplicate
      setTimeout(() => {
        // This will depend on how the parent component handles opening estimates
        // For now, trigger a custom event that the parent can listen for
        window.dispatchEvent(new CustomEvent('openEstimateForEdit', { 
          detail: { estimate: newEstimate } 
        }))
      }, 100)

    } catch (error) {
      console.error('Error duplicating estimate:', error)
      console.error('Error details:', {
        message: (error as any)?.message,
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint
      })
      alert(`Failed to duplicate estimate: ${(error as any)?.message || 'Unknown error'}`)
    }
  }

  const addLineItem = () => {
    const newId = (lineItems.length + 1).toString()
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

  // Navigation functions
  const handleNavigation = (navigationFn: () => void) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => navigationFn)
      setShowUnsavedWarning(true)
    } else {
      navigationFn()
    }
  }

  const handlePreviousEstimate = () => {
    handleNavigation(() => {
      if (canNavigatePrevious) {
        handlePrevious()
      }
    })
  }

  const handleNextEstimate = () => {
    handleNavigation(() => {
      if (canNavigateNext) {
        handleNext()
      }
    })
  }

  const handleFindEstimate = () => {
    setShowFindEstimate(true)
  }

  // Conversion functions
  const handleCreateSalesOrder = async () => {
    const createSO = async () => {
      // Validate that we have the necessary data
      if (!estimate || !estimate.id) {
        alert('Please save the estimate first before creating a Sales Order')
        return
      }

      if (!estimate.customer_id) {
        alert('Please select a customer before creating a Sales Order')
        return
      }

      if (lineItems.filter(item => item.description).length === 0) {
        alert('Please add at least one line item before creating a Sales Order')
        return
      }

      try {
        setIsSaving(true)

        // Generate SO number
        const today = new Date()
        const year = today.getFullYear().toString().slice(-2)
        const month = (today.getMonth() + 1).toString().padStart(2, '0')
        const day = today.getDate().toString().padStart(2, '0')
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
        const soNumber = `SO-${year}${month}${day}-${random}`

        // Create sales order from estimate data
        // Note: Only include fields that exist in the sales_orders table
        const salesOrderData = {
          so_number: soNumber,
          customer_id: estimate.customer_id,
          sales_rep_id: estimate.sales_rep_id || null,
          order_date: new Date().toISOString().split('T')[0],
          ship_date: null,
          expiration_date: estimate.expiration_date || null,
          estimate_id: estimate.id,  // Now this field exists in the database
          estimate_number: estimate.estimate_number,  // Keep this for redundancy/display
          reference_number: estimate.reference_number,  // P.O. Number
          subtotal: estimate.subtotal,
          tax_rate: estimate.tax_rate,
          tax_amount: estimate.tax_amount,
          total_amount: estimate.total_amount,
          internal_notes: estimate.internal_notes,
          customer_notes: estimate.customer_notes,
          terms_and_conditions: estimate.terms_and_conditions,
          status: 'PENDING' as const
        }

        console.log('Creating sales order with data:', salesOrderData)

        // Create the sales order
        const { data: salesOrder, error: soError } = await supabase
          .from('sales_orders')
          .insert([salesOrderData])
          .select(`
            *,
            customers (name, email),
            sales_reps (first_name, last_name, employee_code)
          `)
          .single()

        if (soError) {
          console.error('Supabase error creating sales order:', soError)
          throw soError
        }

        // Create sales order lines from estimate lines
        // First try to get from database, otherwise use in-memory line items
        const { data: estimateLines } = await supabase
          .from('estimate_lines')
          .select('*')
          .eq('estimate_id', estimate.id)
          .order('line_number')

        // Use database lines if available, otherwise use current line items
        const linesToConvert = estimateLines && estimateLines.length > 0 
          ? estimateLines 
          : lineItems.filter(item => item.description).map((item, index) => ({
              line_number: index + 1,
              product_id: item.product_id,
              sku: item.item,
              description: item.description,
              quantity: item.qty,
              unit_price: item.rate,
              unit_of_measure: item.unit_of_measure,
              is_taxable: item.is_taxable || false,
              tax_code: item.is_taxable ? 'TAX' : null,
              tax_rate: item.tax_rate || 0,
              tax_amount: item.tax_amount || 0
            }))

        if (linesToConvert && linesToConvert.length > 0) {
          const salesOrderLines = linesToConvert.map((line) => ({
            sales_order_id: salesOrder.id,
            line_number: line.line_number,
            product_id: line.product_id || null,
            item_code: line.sku || '',
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            unit_of_measure: line.unit_of_measure || 'ea',
            is_taxable: line.is_taxable || false,
            tax_code: line.is_taxable ? 'TAX' : (line.tax_code || null),
            tax_rate: line.tax_rate || 0,
            tax_amount: line.tax_amount || 0,
            line_total: line.quantity * line.unit_price,
            fulfillment_status: 'pending' as const
          }))

          const { error: linesError } = await supabase
            .from('sales_order_lines')
            .insert(salesOrderLines)

          if (linesError) throw linesError
        }

        // Update estimate to link to sales order
        const { error: updateError } = await supabase
          .from('estimates')
          .update({ 
            converted_to_sales_order_id: salesOrder.id,
            converted_at: new Date().toISOString(),
            status: 'CONVERTED'
          })
          .eq('id', estimate.id)

        if (updateError) {
          console.error('Error updating estimate:', updateError)
          // Don't throw here, the SO was created successfully
        }

        // Reload document relationships to show the new connection
        await loadDocumentRelationships()

        alert(`Sales Order ${soNumber} created successfully from Estimate ${estimate.estimate_number}!`)
        
        // Navigate to the specific sales order for editing using URL parameters
        const salesOrderUrl = `/sales-orders?open=${salesOrder.id}`
        window.location.href = salesOrderUrl
      } catch (error: any) {
        console.error('Error creating sales order:', error)
        const errorMessage = error?.message || error?.details || 'Unknown error occurred'
        alert(`Failed to create Sales Order: ${errorMessage}`)
      } finally {
        setIsSaving(false)
      }
    }

    // Use handleNavigation to check for unsaved changes
    handleNavigation(() => {
      createSO().catch(error => {
        console.error('Failed to create sales order:', error)
      })
    })
  }

  const handleCreateInvoice = () => {
    handleNavigation(() => {
      console.log('Convert to Invoice')
      // TODO: Navigate to Invoice module with estimate data
      alert('Converting to Invoice... (Feature to be implemented)')
    })
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => onCancel)
      setShowUnsavedWarning(true)
    } else {
      onCancel()
    }
  }

  const confirmUnsavedWarning = () => {
    if (pendingNavigation) {
      pendingNavigation()
      setPendingNavigation(null)
    }
    setShowUnsavedWarning(false)
  }

  const cancelUnsavedWarning = () => {
    setPendingNavigation(null)
    setShowUnsavedWarning(false)
  }

  const handleSave = async () => {
    // If there are no unsaved changes, don't save
    if (!hasUnsavedChanges) {
      return true // Return success since there's nothing to save
    }

    if (!customerId) {
      alert('Please select a customer')
      return false
    }

    if (!estimateNumber.trim()) {
      alert('Please enter an estimate number')
      return false
    }

    const validLineItems = lineItems.filter(item => item.description.trim())
    if (validLineItems.length === 0) {
      alert('Please add at least one line item')
      return false
    }

    setIsSaving(true)

    try {
      // Parse Bill To for structured data
      const billToLines = billTo.split('\n').filter(line => line.trim())
      const shipToLines = shipTo.split('\n').filter(line => line.trim())

      // Update estimate
      const estimateData = {
        estimate_number: estimateNumber?.trim() || null,
        customer_id: customerId?.trim() || null,
        sales_rep_id: salesReps.find(rep => `${rep.first_name} ${rep.last_name}` === salesRep)?.id || null,
        estimate_date: date || null,
        expiration_date: expirationDate?.trim() || null,
        reference_number: poNumber?.trim() || null,
        bill_to_company: billToLines[0]?.trim() || null,
        bill_to_address_line_1: billToLines[1]?.trim() || null,
        bill_to_address_line_2: billToLines[2]?.trim() || null,
        ship_to_company: shipToLines[0]?.trim() || null,
        ship_to_address_line_1: shipToLines[1]?.trim() || null,
        ship_to_address_line_2: shipToLines[2]?.trim() || null,
        ship_to_same_as_billing: shipSameAsBill || false,
        subtotal: subtotal || 0,
        tax_rate: defaultTaxRate,
        tax_amount: taxAmount || 0,
        total_amount: total || 0,
        internal_notes: memo?.trim() || null,
        customer_notes: customerMessage?.trim() || null,
        terms_and_conditions: terms?.trim() || null,
        template_id: selectedTemplateId?.trim() || null,
        discount_percentage: 0,
        updated_at: new Date().toISOString()
      }

      const { data: estimateResult, error: estimateError } = await supabase
        .from('estimates')
        .update(estimateData)
        .eq('id', estimate.id)
        .select(`
          *,
          customers (name, email),
          sales_reps (first_name, last_name, employee_code),
          estimate_templates (name)
        `)
        .single()

      if (estimateError) throw estimateError

      // Delete existing line items
      await supabase
        .from('estimate_lines')
        .delete()
        .eq('estimate_id', estimate.id)

      // Create new line items
      const lineItemsData = validLineItems.map((item, index) => ({
        estimate_id: estimate.id,
        line_number: index + 1,
        product_id: item.product_id?.trim() || null,
        sku: item.item?.trim() || null,
        description: item.description?.trim() || '',
        quantity: item.qty || 0,
        unit_price: item.rate || 0,
        unit_of_measure: item.unit_of_measure?.trim() || 'ea',
        item_type: 'PRODUCT' as const,
        sort_order: index + 1,
        is_taxable: item.is_taxable || false,
        tax_code: item.is_taxable ? 'TAX' : null,
        tax_rate: item.tax_rate || 0,
        tax_amount: item.tax_amount || 0
      }))

      const { error: lineItemsError } = await supabase
        .from('estimate_lines')
        .insert(lineItemsData)

      if (lineItemsError) throw lineItemsError

      setHasUnsavedChanges(false) // Reset unsaved changes flag
      onSave(estimateResult)
      return true // Return success
    } catch (error) {
      console.error('Error updating estimate:', error)
      console.error('Error details:', {
        message: (error as any)?.message,
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint
      })
      alert(`Failed to update estimate: ${(error as any)?.message || 'Unknown error'}`)
      return false // Return failure
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete estimate ${estimate.estimate_number}? This action cannot be undone.`)) {
      return
    }

    try {
      // First, clear any sales order references to this estimate
      const { error: soError } = await supabase
        .from('sales_orders')
        .update({ estimate_id: null })
        .eq('estimate_id', estimate.id)

      if (soError) {
        console.error('Error clearing sales order references:', soError)
        // Continue with deletion even if this fails
      }

      // Then delete the estimate
      const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', estimate.id)

      if (error) throw error

      if (onDelete) {
        onDelete(estimate)
      }
    } catch (error) {
      console.error('Error deleting estimate:', error)
      alert('Failed to delete estimate')
    }
  }

  const filteredCustomers = customers.filter(c =>
    c.company_name.toLowerCase().includes(customer.toLowerCase())
  ).slice(0, 8)

  const getFilteredProducts = (lineId: string) => {
    const item = lineItems.find(li => li.id === lineId)
    if (!item?.item.trim()) return []
    
    return products.filter(p =>
      p.sku?.toLowerCase().includes(item.item.toLowerCase()) ||
      p.name.toLowerCase().includes(item.item.toLowerCase())
    ).slice(0, 8)
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading estimate...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-white z-40 flex flex-col">
      {/* Header Bar - Redesigned for more functionality */}
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
                onClick={handlePreviousEstimate}
                disabled={!canNavigatePrevious}
                title={canNavigatePrevious ? "Navigate to previous estimate" : "No previous estimate"}
              >
                <ArrowLeft className={`w-4 h-4 ${canNavigatePrevious ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0" 
                onClick={handleNextEstimate}
                disabled={!canNavigateNext}
                title={canNavigateNext ? "Navigate to next estimate" : "No next estimate"}
              >
                <ArrowRight className={`w-4 h-4 ${canNavigateNext ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleFindEstimate}>
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {/* Title with unsaved indicator */}
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-gray-800">Edit Estimate #{estimate.estimate_number}</h1>
              {hasUnsavedChanges && (
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-xs">Unsaved</span>
                </div>
              )}
            </div>

            {/* Collaboration Indicator */}
            {activeUsers.length > 0 && (
              <div className="flex items-center gap-1">
                <CollaborationIndicator 
                  activeUsers={activeUsers}
                  currentUserId={currentUserId}
                />
                <span className="text-xs text-gray-500">
                  {activeUsers.filter(u => u.user_id !== currentUserId).length} viewing
                </span>
              </div>
            )}
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
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleCreateSalesOrder}>
              <FileCheck className="w-3 h-3 mr-1" /> Create SO
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleCreateInvoice}>
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
            {/* Settings */}
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowTemplateEditor(true)}>
              <Settings2 className="w-3 h-3 mr-1" /> Template
            </Button>
            
            {/* Divider */}
            <div className="h-4 w-px bg-gray-300 mx-1" />
            
            {/* Primary Actions */}
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-xs h-7">
              <Save className="w-3 h-3 mr-1" /> {isSaving ? 'Saving...' : 'Save'}
            </Button>
            {onDelete && (
              <Button size="sm" variant="outline" onClick={handleDelete} className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleCancel} className="text-xs h-7">
              <X className="w-3 h-3 mr-1" /> Close
            </Button>
          </div>
        </div>
      </div>

      {/* Document Flow Tracker */}
      {Object.keys(documentRelationships).length > 0 && (
        <div className="px-4 py-2 border-b bg-blue-50">
          <DocumentFlowTracker
            relationships={documentRelationships}
            currentDocument="estimate"
            currentDocumentId={estimate.id}
            onNavigate={(type, id) => {
              if (type === 'salesOrder') {
                // Navigate to specific sales order for editing
                window.location.href = `/sales-orders?open=${id}`
              } else if (type === 'purchaseOrder') {
                // Navigate to specific purchase order for editing
                window.location.href = `/purchase-orders?open=${id}`
              } else if (type === 'estimate') {
                // Navigate to specific estimate for editing
                window.location.href = `/estimates?open=${id}`
              } else if (type === 'invoice') {
                // Navigate to specific invoice for editing (when available)
                window.location.href = `/invoices?open=${id}`
              }
            }}
          />
        </div>
      )}

      {/* Form Content - Same as create component but with "Edit" functionality */}
      <div className="flex-1 overflow-auto p-6 bg-white">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Rest of the form content would be identical to the create component */}
          {/* For brevity, I'll include the key sections */}
          
          {/* Customer Selection - Top of Form */}
          <div className="bg-blue-50 p-4 rounded border border-blue-200">
            <div className="grid grid-cols-3 gap-4">
              <div ref={customerDropdownRef} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <Input
                  value={customer}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                  placeholder="Type customer name"
                  className="pr-8"
                  onFocus={() => setCustomerDropdown(true)}
                />
                
                {customerDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                    {filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm border-b last:border-b-0"
                      >
                        <div className="font-medium">{c.company_name}</div>
                        <div className="text-xs text-gray-500">{c.email}</div>
                      </button>
                    ))}
                    
                    {customer && !customers.find(c => c.company_name.toLowerCase() === customer.toLowerCase()) && (
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
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimate # *</label>
                <Input
                  value={estimateNumber}
                  onChange={(e) => setEstimateNumber(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
          </div>


          {/* Bill To and Ship To Addresses */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Bill To</label>
              <Textarea
                value={billTo}
                onChange={(e) => setBillTo(e.target.value)}
                placeholder="Customer Name
Address Line 1
Address Line 2
City, State ZIP
Phone: (555) 123-4567
Email: customer@example.com"
                rows={6}
                className="text-sm font-mono resize-y"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">Ship To</label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={shipSameAsBill}
                    onChange={(e) => setShipSameAsBill(e.target.checked)}
                    className="rounded"
                  />
                  Same as Bill To
                </label>
              </div>
              <Textarea
                value={shipTo}
                onChange={(e) => setShipTo(e.target.value)}
                placeholder="Shipping Name
Address Line 1
Address Line 2
City, State ZIP
Phone: (555) 123-4567"
                rows={6}
                className="text-sm font-mono resize-y"
                disabled={shipSameAsBill}
              />
            </div>
          </div>

          {/* Additional Header Fields */}
          <div className="bg-gray-50 p-4 rounded border">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">P.O. Number</label>
                <Input
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="Purchase Order #"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                <TermsSelector
                  value={terms}
                  onChange={setTerms}
                  placeholder="e.g. Net 30"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                <Input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales Rep</label>
                <select
                  value={salesRep}
                  onChange={(e) => setSalesRep(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {salesReps.map(rep => (
                    <option key={rep.id} value={`${rep.first_name} ${rep.last_name}`}>
                      {rep.first_name} {rep.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Line Items Table - QuickBooks Style */}
          <div className="border rounded">
            <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
              <span className="font-medium text-gray-700">Line Items</span>
              <Button size="sm" onClick={addLineItem} className="bg-blue-600 hover:bg-blue-700 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Add Line
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
                        <div ref={el => { itemDropdownRefs.current[item.id] = el; }}>
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
                    
                    <td className="px-2 py-2 text-center" style={{width: `${columnWidths.tax}px`}}>
                      <input
                        type="checkbox"
                        checked={item.is_taxable || false}
                        onChange={(e) => updateLineItem(item.id, 'is_taxable', e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        title={item.is_taxable ? "Taxable" : "Non-taxable"}
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

          {/* Totals Section - QuickBooks Style */}
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

          {/* Notes Section - QuickBooks Style */}
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

          {/* Audit Trail Section */}
          <div className="pt-4 border-t">
            <AuditInfo
              lastEditedBy={(estimate as any).last_edited_by}
              lastEditedAt={(estimate as any).last_edited_at}
              createdBy={(estimate as any).created_by}
              createdAt={estimate.created_at}
              showCreated={true}
              className="flex flex-col gap-1"
            />
          </div>

        </div>
      </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
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
            
            <div className="flex justify-end gap-2">
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
          templateType="estimate"
          currentTemplateId={selectedTemplateId}
        />
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col">
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Estimate Preview</h2>
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
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">ESTIMATE</h1>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><strong>Estimate #:</strong> {estimateNumber}</p>
                        <p><strong>Date:</strong> {new Date(date).toLocaleDateString()}</p>
                        {expirationDate && <p><strong>Expires:</strong> {new Date(expirationDate).toLocaleDateString()}</p>}
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

                {/* Addresses */}
                <div className="p-8 grid grid-cols-2 gap-8 border-b">
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Bill To:</h3>
                    <div className="text-sm text-gray-600 whitespace-pre-line">
                      {billTo || 'Customer Name\nAddress Line 1\nCity, ST 12345'}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Ship To:</h3>
                    <div className="text-sm text-gray-600 whitespace-pre-line">
                      {shipTo || billTo || 'Customer Name\nAddress Line 1\nCity, ST 12345'}
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

              {/* Line Item Breakdown - Same as create component */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Line Item Breakdown</h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full " style={{ minWidth: "800px" }}">
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
                        // Find the inventory item to get its weighted average cost
                        const inventoryItem = inventory.find(inv => inv.product_id === item.product_id)
                        const costEach = inventoryItem?.weighted_average_cost || 0
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
                                {costEach === 0 && <span className="text-xs ml-1">(Inventory Cost)</span>}
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

      {/* Find Estimate Modal */}
      {showFindEstimate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Find Estimate</h2>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowFindEstimate(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimate Number</label>
                  <Input
                    placeholder="EST-241212-001"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <Input
                    placeholder="Search by customer..."
                    className="w-full"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowFindEstimate(false)}>Cancel</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
                    setShowFindEstimate(false)
                    alert('Find estimate functionality to be implemented')
                  }}>Find</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold">Unsaved Changes</h2>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                You have unsaved changes that will be lost if you continue. Do you want to save your changes before leaving?
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={cancelUnsavedWarning}>Cancel</Button>
                <Button 
                  variant="outline" 
                  onClick={confirmUnsavedWarning}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Leave Without Saving
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    await handleSave()
                    if (pendingNavigation) {
                      pendingNavigation()
                      setPendingNavigation(null)
                    }
                    setShowUnsavedWarning(false)
                  }}
                >
                  Save & Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}