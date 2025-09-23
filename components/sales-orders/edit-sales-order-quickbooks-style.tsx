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
import { Badge } from '@/components/ui/badge'
import { X, Save, Plus, Trash2, Package, FileText, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, Printer, Mail, Copy, Settings2, ArrowLeft, ArrowRight, Search, Eye, Calculator, Receipt, FileCheck } from 'lucide-react'
// import TaxCodeDropdown from '@/components/ui/tax-code-dropdown' // No longer needed - using simple taxable checkbox
import ContextMenu from '@/components/ui/context-menu'
import TemplateEditor from '@/components/templates/template-editor'
import DocumentFlowTracker, { DocumentRelationship } from '@/components/ui/document-flow-tracker'
import TermsSelector from '@/components/ui/terms-selector'
import AuditInfo from '@/components/ui/audit-info'
import { executeSaveOperation, displayError } from '@/lib/error-handling'

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
  payment_terms_details?: { name: string } | null
}
type SalesRep = Database['public']['Tables']['sales_reps']['Row']
type Product = Database['public']['Tables']['products']['Row']
type SalesOrder = Database['public']['Tables']['sales_orders']['Row'] & {
  customers?: { name: string; email: string | null }
  sales_reps?: { first_name: string; last_name: string; employee_code: string }
}
type SOTemplate = any
type SalesOrderLine = any

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
  quantity_reserved?: number
  qty_invoiced?: number  // Quantity already invoiced
  qty_remaining?: number  // Quantity still to be invoiced
  fulfillment_status?: 'pending' | 'partial' | 'complete'
}

interface NewCustomerModal {
  show: boolean
  name: string
  email: string
  phone: string
  address: string
}

interface EditSalesOrderQuickBooksStyleProps {
  salesOrder: SalesOrder
  onSave: (salesOrder: SalesOrder) => void
  onCancel: () => void
  onDelete?: (salesOrder: SalesOrder) => void
  salesOrders?: SalesOrder[]
  onNavigate?: (salesOrder: SalesOrder) => void
}

export default function EditSalesOrderQuickBooksStyle({ 
  salesOrder, 
  onSave, 
  onCancel, 
  onDelete, 
  salesOrders = [], 
  onNavigate 
}: EditSalesOrderQuickBooksStyleProps) {
  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [templates, setTemplates] = useState<SOTemplate[]>([])
  const [salesOrderLines, setSalesOrderLines] = useState<SalesOrderLine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Header fields
  const [customer, setCustomer] = useState(salesOrder.customers?.name || '')
  const [customerId, setCustomerId] = useState(salesOrder.customer_id)
  const [customerDropdown, setCustomerDropdown] = useState(false)
  const [soNumber, setSoNumber] = useState(salesOrder.so_number)
  const [date, setDate] = useState(salesOrder.order_date)
  const [shipDate, setShipDate] = useState(salesOrder.ship_date || '')
  const [poNumber, setPoNumber] = useState(salesOrder.reference_number || '')
  const [salesRep, setSalesRep] = useState('')
  const [salesRepId, setSalesRepId] = useState(salesOrder.sales_rep_id || '')
  const [terms, setTerms] = useState(salesOrder.terms_and_conditions || '')
  const [status, setStatus] = useState(salesOrder.status)

  // Address fields
  const [billTo, setBillTo] = useState('')
  const [shipTo, setShipTo] = useState('')
  const [shipSameAsBill, setShipSameAsBill] = useState(true)

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([])
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
  const [subtotal, setSubtotal] = useState(salesOrder.subtotal)
  const [taxAmount, setTaxAmount] = useState(salesOrder.tax_amount)
  const [total, setTotal] = useState(salesOrder.total_amount)
  
  // Get backend-controlled tax rate from settings
  const { defaultTaxRate } = useDefaultTaxRate()
  
  // Get current authenticated user
  const { user } = useAuth()

  // Notes
  const [memo, setMemo] = useState(salesOrder.internal_notes || '')
  const [customerMessage, setCustomerMessage] = useState(salesOrder.customer_notes || '')

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
  const [isDuplicating, setIsDuplicating] = useState(false)

  // Profit calculations
  const [totalCost, setTotalCost] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [profitMargin, setProfitMargin] = useState(0)

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

  // Document relationships
  const [documentRelationships, setDocumentRelationships] = useState<DocumentRelationship>({})

  // Load document relationships
  const loadDocumentRelationships = async () => {
    console.log('=== LOADING DOCUMENT RELATIONSHIPS FOR SO ===')
    console.log('Sales Order ID:', salesOrder.id)
    console.log('Sales Order Number:', salesOrder.so_number)
    // Multi-invoice model - no longer using converted_to_invoice_id
    
    try {
      // No need to refresh SO data - multi-invoice model doesn't use converted_to_invoice_id

      const relationships: DocumentRelationship = {
        salesOrder: {
          id: salesOrder.id,
          number: salesOrder.so_number,
          status: salesOrder.status,
          date: salesOrder.order_date,
          amount: salesOrder.total_amount
        }
      }

      // Check for related estimate using estimate_id field (fallback to estimate_number)
      if ((salesOrder as any).estimate_id) {
        const { data: estimate, error: estError } = await supabase
          .from('estimates')
          .select('*')
          .eq('id', (salesOrder as any).estimate_id)
          .single()

        if (!estError && estimate) {
          relationships.estimate = {
            id: estimate.id,
            number: estimate.estimate_number,
            status: estimate.status,
            date: estimate.estimate_date,
            amount: estimate.total_amount
          }
        } else if (estError && estError.code === 'PGRST116') {
          // Estimate was deleted, clear the reference in the SO
          console.log('Referenced estimate no longer exists, clearing SO reference')
          await supabase
            .from('sales_orders')
            .update({ estimate_id: null })
            .eq('id', salesOrder.id)
        }
      } else if (salesOrder.estimate_number) {
        // Fallback to estimate_number if estimate_id is not available
        const { data: estimate, error: estError } = await supabase
          .from('estimates')
          .select('*')
          .eq('estimate_number', salesOrder.estimate_number)
          .single()

        if (!estError && estimate) {
          relationships.estimate = {
            id: estimate.id,
            number: estimate.estimate_number,
            status: estimate.status,
            date: estimate.estimate_date,
            amount: estimate.total_amount
          }
        }
      }

      // Check for related purchase orders using source_sales_order_id
      const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('source_sales_order_id', salesOrder.id)
        .order('created_at', { ascending: true })

      if (!poError && purchaseOrders && purchaseOrders.length > 0) {
        // Support multiple POs per SO
        relationships.purchaseOrders = purchaseOrders.map(po => ({
          id: po.id,
          number: po.po_number,
          status: po.status,
          date: po.order_date,
          amount: po.total_amount || 0
        }))
        
        // Keep backward compatibility with single PO
        relationships.purchaseOrder = relationships.purchaseOrders[0]
        
        console.log(`Found ${purchaseOrders.length} purchase order(s) for this SO`)
      }

      // Check for related invoices (now supports multiple)
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('*')
        .eq('sales_order_id', salesOrder.id)
        .order('invoice_sequence', { ascending: true })

      console.log(`Found ${invoices?.length || 0} invoice(s) for this SO`)

      if (!invError && invoices && invoices.length > 0) {
        relationships.invoices = invoices.map((invoice, index) => ({
          id: invoice.id,
          number: invoice.invoice_number,
          status: invoice.status,
          date: invoice.invoice_date,
          amount: invoice.total_amount || 0,
          sequence: invoice.invoice_sequence || (index + 1),
          isPartial: invoice.is_partial_invoice || false,
          isFinal: invoice.is_final_invoice || false
        }))
        
        // Keep backward compatibility with single invoice
        relationships.invoice = relationships.invoices[0]
        
        // Calculate fulfillment percentage for SO
        const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
        const soTotal = salesOrder.total_amount || 0
        relationships.salesOrder = {
          ...relationships.salesOrder!,
          fulfillmentPercentage: soTotal > 0 ? Math.round((totalInvoiced / soTotal) * 100) : 0
        }
        
        console.log('Added invoices to relationships:', relationships.invoices)
      } else if (invError) {
        console.log('Invoice lookup failed:', invError)
      }

      setDocumentRelationships(relationships)
    } catch (error) {
      console.error('Error loading document relationships:', error)
    }
  }

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
    fetchSalesOrderLines()
    loadDocumentRelationships()
  }, [])

  // Add visibility change listener to refresh docflow when tab becomes active
  // This handles cases where user creates invoices/POs from SO and comes back
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible, refresh docflow to catch any new relationships
        loadDocumentRelationships()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [salesOrder.id])

  // Add periodic refresh to catch document flow updates (e.g., invoices created)
  // Reduced frequency to improve performance
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      loadDocumentRelationships()
    }, 30000) // Refresh every 30 seconds (reduced from 10s)

    return () => clearInterval(refreshInterval)
  }, [salesOrder.id])

  // Refresh document flow when status changes
  useEffect(() => {
    loadDocumentRelationships()
  }, [status]) // Refresh when status changes

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
  }, [lineItems, products, inventory])

  // Sync Ship To with Bill To when "Same as Bill To" is checked
  useEffect(() => {
    if (shipSameAsBill) {
      setShipTo(billTo)
    }
  }, [billTo, shipSameAsBill])

  const fetchData = async () => {
    try {
      const [customersRes, salesRepsRes, productsRes, inventoryRes, templatesRes] = await Promise.all([
        supabase.from('customers').select('*, payment_terms(name)').order('name'),
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

      // Set sales rep name
      if (salesOrder.sales_reps) {
        setSalesRep(`${salesOrder.sales_reps.first_name} ${salesOrder.sales_reps.last_name}`)
      }

      // Initialize addresses if we have a customer
      if (salesOrder.customer_id && customersRes.data) {
        const customerData = customersRes.data.find(c => c.id === salesOrder.customer_id)
        if (customerData) {
          // Set Bill To with customer info
          let billToText = customerData.name
          if (customerData.billing_address) {
            billToText += '\n' + customerData.billing_address
          }
          if (customerData.phone) {
            billToText += '\nPhone: ' + customerData.phone
          }
          if (customerData.email) {
            billToText += '\nEmail: ' + customerData.email
          }
          setBillTo(billToText)
          setShipTo(billToText) // Default ship to same as bill to
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSalesOrderLines = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_order_lines')
        .select('*')
        .eq('sales_order_id', salesOrder.id)
        .order('line_number')

      if (error) throw error

      setSalesOrderLines(data || [])
      
      // Convert to line items format with simplified tax and fulfillment tracking
      const items = (data || []).map(line => ({
        id: line.id,
        item: line.item_code || '',
        description: line.description || '',
        qty: Number(line.quantity),
        rate: Number(line.unit_price),
        amount: Number(line.line_total),
        product_id: line.product_id,
        unit_of_measure: line.unit_of_measure || 'ea',
        // Convert existing tax codes to simple taxable flag
        is_taxable: line.is_taxable ?? (line.tax_code && line.tax_code !== 'NON' && line.tax_rate > 0),
        quantity_reserved: Number(line.quantity_reserved || 0),
        // Add fulfillment tracking
        qty_invoiced: Number(line.qty_invoiced || 0),
        qty_remaining: Number(line.qty_remaining || line.quantity || 0),
        fulfillment_status: line.fulfillment_status || 'pending'
      }))

      setLineItems(items.length > 0 ? items : [
        { id: '1', item: '', description: '', qty: 1, rate: 0, amount: 0, unit_of_measure: 'ea', tax_code: '', tax_rate: 0, tax_amount: 0 }
      ])
    } catch (error) {
      console.error('Error fetching sales order lines:', error)
    }
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

  const selectCustomer = (customerData: Customer) => {
    setCustomer(customerData.company_name)
    setCustomerId(customerData.id)
    setCustomerDropdown(false)
    
    // Auto-fill payment terms from customer if available
    if ((customerData.payment_terms as any)?.name) {
      setTerms((customerData.payment_terms as any).name)
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

  const handleConfirmOrder = async () => {
    try {
      const { data, error } = await supabase.rpc('reserve_inventory_for_sales_order', {
        p_sales_order_id: salesOrder.id
      })

      if (error) throw error

      if (data?.success) {
        setStatus('CONFIRMED')
        alert('Sales Order confirmed and inventory reserved!')
        // Reload the sales order to get updated status
        const updatedSO = { ...salesOrder, status: 'CONFIRMED' as const }
        onSave(updatedSO)
      } else {
        alert(`Cannot confirm order: ${data?.error}`)
      }
    } catch (error) {
      console.error('Error confirming sales order:', error)
      alert('Error confirming sales order')
    }
  }

  // Action handlers
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

    const salesOrderHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sales Order ${soNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .company-info { margin-bottom: 20px; }
            .so-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .address-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .address-box { width: 48%; }
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
              const filename = 'SalesOrder_${soNumber}_${customer.replace(/[^a-zA-Z0-9]/g, '_')}.html';
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
            <h1>SALES ORDER</h1>
          </div>
          
          <div class="company-info">
            <strong>[Your Company Name]</strong><br>
            [Your Address]<br>
            [Phone] | [Email]
          </div>
          
          <div class="so-info">
            <div>
              <strong>Sales Order #:</strong> ${soNumber}<br>
              <strong>Date:</strong> ${date}<br>
              ${salesOrder.estimate_number ? `<strong>Estimate #:</strong> ${salesOrder.estimate_number}<br>` : ''}
              ${salesRep ? `<strong>Sales Rep:</strong> ${salesRep}<br>` : ''}
            </div>
            <div>
              <strong>Ship Date:</strong> ${shipDate || 'TBD'}<br>
              <strong>P.O. #:</strong> ${poNumber || 'N/A'}<br>
              <strong>Status:</strong> ${status.replace('_', ' ')}
            </div>
            <div>
              ${terms ? `<strong>Terms:</strong> ${terms}` : ''}
            </div>
          </div>
          
          <div class="address-section">
            <div class="address-box">
              <strong>Bill To:</strong><br>
              ${billTo.replace(/\n/g, '<br>') || customer + '<br>[Address]'}
            </div>
            <div class="address-box">
              <strong>Ship To:</strong><br>
              ${shipTo.replace(/\n/g, '<br>') || billTo.replace(/\n/g, '<br>') || customer + '<br>[Address]'}
            </div>
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
      printWindow.document.write(salesOrderHTML)
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
      const subject = `Sales Order ${soNumber} for ${customer}`
      const body = `Dear ${customer},

Please find attached the sales order ${soNumber}.

Sales Order Summary:
- Date: ${date}
- Total: $${total.toFixed(2)}
- Ship Date: ${shipDate || 'TBD'}
- Status: ${status.replace('_', ' ')}

Thank you for your business.

Best regards,
[Your Company Name]`
      
      const mailtoUrl = customerEmail 
        ? `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      
      window.location.href = mailtoUrl
    }, 2000)
  }

  const handleDuplicate = async () => {
    // Prevent multiple duplicate attempts
    if (isDuplicating) {
      console.log('Duplicate already in progress, ignoring click')
      return
    }
    
    console.log('=== DUPLICATE BUTTON CLICKED ===')
    console.log('onNavigate callback available:', typeof onNavigate)
    console.log('Current salesOrder:', salesOrder)
    console.log('salesOrders array length:', salesOrders.length)
    
    setIsDuplicating(true)
    
    try {
      // Generate new SO number - ensure uniqueness by checking existence
      let newSONumber = ''
      let attempts = 0
      const maxAttempts = 10
      
      while (attempts < maxAttempts) {
        // Get the highest existing SO number from database
        const { data: existingSOs } = await supabase
          .from('sales_orders')
          .select('so_number')
          .order('so_number', { ascending: false })
          .limit(1)

        let lastNum = 0
        if (existingSOs && existingSOs.length > 0) {
          const lastSOFromDB = existingSOs[0].so_number
          if (lastSOFromDB && lastSOFromDB.match(/^SO-\d{6}$/)) {
            lastNum = parseInt(lastSOFromDB.split('-')[1])
          }
        }

        // Also check the current salesOrders array
        const lastSOFromArray = salesOrders
          .map(so => so.so_number)
          .filter(num => num?.match(/^SO-\d{6}$/))
          .sort()
          .pop()

        if (lastSOFromArray) {
          const arrayNum = parseInt(lastSOFromArray.split('-')[1])
          lastNum = Math.max(lastNum, arrayNum)
        }

        newSONumber = `SO-${String(lastNum + 1 + attempts).padStart(6, '0')}`
        
        // Check if this number already exists
        const { data: existing } = await supabase
          .from('sales_orders')
          .select('id')
          .eq('so_number', newSONumber)
          .limit(1)
          
        if (!existing || existing.length === 0) {
          break // Found a unique number
        }
        
        attempts++
      }
      
      console.log('Generated new SO number:', newSONumber, 'after', attempts + 1, 'attempts')

      // Start with minimal required fields only
      const duplicateData = {
        so_number: newSONumber,
        customer_id: customerId,
        status: 'PENDING' as const, // Not confirmed
        order_date: new Date().toISOString().split('T')[0], // Today's date
        subtotal: subtotal || 0,
        tax_rate: defaultTaxRate,
        tax_amount: taxAmount || 0,
        total_amount: total || 0,
        // Clear doc flow relationships for the duplicate (as requested)
        source_estimate_id: null,
        estimate_number: null
      }

      console.log('Attempting to duplicate with data:', duplicateData)

      const { data: newSalesOrder, error } = await supabase
        .from('sales_orders')
        .insert(duplicateData)
        .select(`
          *,
          customers (name, email),
          sales_reps (first_name, last_name, employee_code)
        `)
        .single()

      if (error) {
        console.error('Supabase error:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        throw error
      }

      console.log('Sales order created successfully:', newSalesOrder)

      // Also copy line items with simplified tax handling
      const salesOrderLines = lineItems
        .filter(item => item.description.trim())
        .map((item, index) => ({
          sales_order_id: newSalesOrder.id,
          line_number: index + 1,
          product_id: item.product_id,
          item_code: item.item,
          description: item.description,
          quantity: item.qty,
          unit_price: item.rate,
          unit_of_measure: item.unit_of_measure || 'ea',
          // Simplified tax - just store if it's taxable or not
          tax_code: item.is_taxable ? 'TAX' : 'NON',
          tax_rate: item.is_taxable ? defaultTaxRate : 0,
          tax_amount: item.is_taxable ? (item.amount * defaultTaxRate / 100) : 0,
          line_total: item.amount,
          fulfillment_status: 'pending' as const
        }))

      if (salesOrderLines.length > 0) {
        console.log('Inserting line items with enhanced product data:', salesOrderLines)
        const { error: linesError } = await supabase
          .from('sales_order_lines')
          .insert(salesOrderLines)

        if (linesError) {
          console.error('Line items error:', linesError)
          console.error('Line items error details:', JSON.stringify(linesError, null, 2))
        }
      }

      // Show success message and navigate to duplicate (same as estimates)
      alert(`Sales order duplicated successfully with number: ${newSONumber}!\n\nNow opening the duplicate for editing...`)
      
      // Instead of relying on onNavigate callback, use the same pattern as estimates
      if (onSave) {
        onSave(newSalesOrder)
      }
      
      // Small delay to ensure the callback completes, then trigger opening the duplicate
      setTimeout(() => {
        // Trigger a custom event that the parent can listen for (same as estimates pattern)
        window.dispatchEvent(new CustomEvent('openSalesOrderForEdit', { 
          detail: { salesOrder: newSalesOrder } 
        }))
      }, 100)

      console.log('Sales order duplicated successfully')
    } catch (error) {
      console.error('Error duplicating sales order:', error)
      console.error('Error type:', typeof error)
      console.error('Error keys:', Object.keys(error as any))
      if ((error as any).message) console.error('Error message:', (error as any).message)
      if ((error as any).details) console.error('Error details:', (error as any).details)
      if ((error as any).hint) console.error('Error hint:', (error as any).hint)
      if ((error as any).code) console.error('Error code:', (error as any).code)
      alert(`Error duplicating sales order: ${(error as any).message || 'Unknown error'}`)
    } finally {
      setIsDuplicating(false)
    }
  }

  const handleCreatePO = () => {
    // Show confirmation message before navigating
    const confirmed = confirm(`Create a Purchase Order from Sales Order ${salesOrder.so_number}?\n\nThis will take you to the Purchase Orders module with the sales order data pre-filled.`)
    
    if (confirmed) {
      const poUrl = `/purchase-orders?create_from_so=${salesOrder.id}`
      window.location.href = poUrl
    }
  }

  const handleCreateInvoice = () => {
    // Show confirmation message before navigating
    const confirmed = confirm(`Create an Invoice from Sales Order ${salesOrder.so_number}?\n\nThis will take you to the Invoices module with the sales order data pre-filled.`)
    
    if (confirmed) {
      const invoiceUrl = `/invoices?create_from_so=${salesOrder.id}`
      window.location.href = invoiceUrl
    }
  }

  // Navigation logic
  const canNavigatePrevious = salesOrders.length > 0
  const canNavigateNext = salesOrders.length > 0

  const handleNavigateToSalesOrder = async (direction: 'previous' | 'next') => {
    if (hasUnsavedChanges) {
      const shouldSave = confirm('You have unsaved changes. Would you like to save before navigating?')
      if (shouldSave) {
        try {
          await handleSave()
        } catch (error) {
          alert('Failed to save sales order. Navigation cancelled.')
          return
        }
      } else {
        const shouldDiscard = confirm('Are you sure you want to discard your changes?')
        if (!shouldDiscard) {
          return
        }
      }
    }

    if (salesOrders.length === 0) return

    const currentIndex = salesOrders.findIndex(so => so.id === salesOrder.id)
    let targetIndex
    
    if (direction === 'previous') {
      targetIndex = currentIndex <= 0 ? salesOrders.length - 1 : currentIndex - 1
    } else {
      targetIndex = currentIndex >= salesOrders.length - 1 ? 0 : currentIndex + 1
    }
    
    const targetSalesOrder = salesOrders[targetIndex]
    if (onNavigate && targetSalesOrder) {
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

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)

    const validLineItems = lineItems.filter(item => item.description.trim())
    
    // Prepare validation data
    const validationData = {
      customer_id: customerId,
      order_date: date,
      so_number: soNumber,
      line_items: validLineItems.map(item => ({
        description: item.description,
        quantity: item.qty,
        unit_price: item.rate
      }))
    }

    const saveResult = await executeSaveOperation(
      'UPDATE_SALES_ORDER',
      'sales_order',
      salesOrder.id,
      async () => {
        // Update sales order header
        const salesOrderData = {
          so_number: soNumber,
          customer_id: customerId,
          sales_rep_id: salesRepId || null,
          order_date: date,
          ship_date: shipDate || null,
          reference_number: poNumber,
          subtotal,
          tax_rate: defaultTaxRate,
          tax_amount: taxAmount,
          total_amount: total,
          internal_notes: memo,
          customer_notes: customerMessage,
          terms_and_conditions: terms,
          status,
          last_edited_by: user?.id || null
        }

        const { data: updatedSalesOrder, error: soError } = await supabase
          .from('sales_orders')
          .update(salesOrderData)
          .eq('id', salesOrder.id)
          .select(`
            *,
            customers (name, email),
            sales_reps (first_name, last_name, employee_code)
          `)
          .single()

        if (soError) throw soError

      // Check if this sales order has been invoiced (using multi-invoice model)
      const { data: invoices, error: invoiceCheckError } = await supabase
        .from('invoices')
        .select('id')
        .eq('sales_order_id', salesOrder.id)
        .limit(1)
      
      const hasInvoice = !invoiceCheckError && invoices && invoices.length > 0
      
      if (hasInvoice) {
        // Sales order has been invoiced - update lines in place to preserve invoice references
        
        // Get existing lines from database
        const { data: existingLines, error: fetchError } = await supabase
          .from('sales_order_lines')
          .select('*')
          .eq('sales_order_id', salesOrder.id)
          .order('line_number')
        
        if (fetchError) {
          console.error('Error fetching existing lines:', fetchError)
          throw fetchError
        }
        
        // Update existing lines and track which ones to keep
        const validLineItems = lineItems.filter(item => item.description.trim())
        const updatedLineIds = []
        
        for (let i = 0; i < validLineItems.length; i++) {
          const item = validLineItems[i]
          const lineData = {
            line_number: i + 1,
            product_id: item.product_id,
            item_code: item.item,
            description: item.description,
            quantity: item.qty,
            unit_price: item.rate,
            unit_of_measure: item.unit_of_measure,
            is_taxable: item.is_taxable || false,
            tax_code: item.is_taxable ? 'TAX' : null,
            tax_rate: item.is_taxable ? defaultTaxRate : 0,
            tax_amount: item.is_taxable ? (item.amount * defaultTaxRate / 100) : 0,
            line_total: item.amount,
            fulfillment_status: 'pending' as const
          }
          
          if (i < existingLines.length) {
            // Update existing line
            const existingLine = existingLines[i]
            
            const { error: updateError } = await supabase
              .from('sales_order_lines')
              .update(lineData)
              .eq('id', existingLine.id)
            
            if (updateError) {
              console.error('Error updating line:', updateError)
              throw updateError
            }
            
            updatedLineIds.push(existingLine.id)
          } else {
            // Add new line
            const { data: newLine, error: insertError } = await supabase
              .from('sales_order_lines')
              .insert({
                ...lineData,
                sales_order_id: salesOrder.id
              })
              .select()
              .single()
            
            if (insertError) {
              console.error('Error inserting new line:', insertError)
              throw insertError
            }
            
            if (newLine) updatedLineIds.push(newLine.id)
          }
        }
        
        // Only delete lines that are no longer needed and aren't referenced by invoices
        if (existingLines.length > validLineItems.length) {
          const linesToDelete = existingLines
            .slice(validLineItems.length)
            .map(line => line.id)
          
          
          // Try to delete, but don't fail if some lines can't be deleted due to invoice references
          for (const lineId of linesToDelete) {
            const { error: deleteError } = await supabase
              .from('sales_order_lines')
              .delete()
              .eq('id', lineId)
            
            if (deleteError) {
              console.warn(`Could not delete line ${lineId} (might be referenced by invoice):`, deleteError.message)
              // Don't throw - just log the warning
            }
          }
        }
      } else {
        // No invoice exists, safe to delete and recreate
        
        const { error: deleteError } = await supabase
          .from('sales_order_lines')
          .delete()
          .eq('sales_order_id', salesOrder.id)

        if (deleteError) {
          console.error('Error deleting existing lines:', deleteError)
          throw deleteError
        }

        // Create new sales order lines
        const validLineItems = lineItems.filter(item => item.description.trim())
        const salesOrderLines = validLineItems.map((item, index) => ({
          sales_order_id: salesOrder.id,
          line_number: index + 1,
          product_id: item.product_id,
          item_code: item.item,
          description: item.description,
          quantity: item.qty,
          unit_price: item.rate,
          unit_of_measure: item.unit_of_measure,
          is_taxable: item.is_taxable || false,
          tax_code: item.is_taxable ? 'TAX' : null,
          tax_rate: item.is_taxable ? defaultTaxRate : 0,
          tax_amount: item.is_taxable ? (item.amount * defaultTaxRate / 100) : 0,
          line_total: item.amount,
          fulfillment_status: 'pending' as const
        }))

        if (salesOrderLines.length > 0) {
          const { error: linesError } = await supabase
            .from('sales_order_lines')
            .insert(salesOrderLines)

          if (linesError) {
            console.error('Sales Order Lines Insert Error:', linesError)
            throw linesError
          }
        }
      }
      
        // Clear unsaved changes flag and return the updated data
        setHasUnsavedChanges(false)
        return updatedSalesOrder
      },
      validationData
    )

    // Handle the result
    if (saveResult.success) {
      onSave(saveResult.data!)
    } else {
      // Display user-friendly error message
      const errorMsg = displayError(saveResult.error!, process.env.NODE_ENV === 'development')
      
      // Add specific handling for sales order constraints
      if (saveResult.error!.message.includes('violates foreign key constraint')) {
        if (saveResult.error!.message.includes('invoice_lines')) {
          alert('Cannot modify sales order lines that are referenced by an invoice.\n\nYou can update existing line details, but cannot remove lines that have been invoiced.')
        } else if (saveResult.error!.message.includes('purchase_order')) {
          alert('Cannot modify sales order lines that are referenced by purchase orders.\n\nYou can update pricing and details, but cannot remove lines that are linked to POs.')
        } else {
          alert(errorMsg)
        }
      } else {
        alert(errorMsg)
      }
    }
    
    setIsSaving(false)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'PENDING': { color: 'bg-yellow-100 text-yellow-800', icon: Package },
      'CONFIRMED': { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      'IN_PROGRESS': { color: 'bg-purple-100 text-purple-800', icon: Package },
      'SHIPPED': { color: 'bg-indigo-100 text-indigo-800', icon: Package },
      'DELIVERED': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      'INVOICED': { color: 'bg-gray-100 text-gray-800', icon: FileText },
      'CANCELLED': { color: 'bg-red-100 text-red-800', icon: AlertTriangle },
      'ON_HOLD': { color: 'bg-orange-100 text-orange-800', icon: AlertTriangle }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['PENDING']
    const Icon = config.icon

    return (
      <Badge className={`${config.color} border-0 flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ')}
      </Badge>
    )
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
                disabled={!canNavigatePrevious}
                onClick={handlePrevious}
                title="Navigate to previous sales order"
              >
                <ArrowLeft className={`w-4 h-4 ${canNavigatePrevious ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0" 
                disabled={!canNavigateNext}
                onClick={handleNext}
                title="Navigate to next sales order"
              >
                <ArrowRight className={`w-4 h-4 ${canNavigateNext ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled>
                <Search className="w-4 h-4 text-gray-400" />
              </Button>
            </div>

            {/* Title with status and unsaved indicator */}
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-gray-800">Edit Sales Order</h1>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">{soNumber}</span>
                {getStatusBadge(status)}
              </div>
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
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleDuplicate} disabled={isDuplicating}>
              <Copy className="w-3 h-3 mr-1" /> {isDuplicating ? 'Duplicating...' : 'Duplicate'}
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {/* Confirm Order Action for Pending Orders */}
            {status === 'PENDING' && (
              <>
                <Button size="sm" variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 text-xs h-7" onClick={handleConfirmOrder}>
                  <CheckCircle className="w-3 h-3 mr-1" /> Confirm Order
                </Button>
                <div className="h-4 w-px bg-gray-300 mx-1" />
              </>
            )}
            
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

      {/* Document Flow Tracker */}
      {Object.keys(documentRelationships).length > 0 && (
        <div className="px-4 py-2 border-b bg-blue-50">
          <DocumentFlowTracker
            relationships={documentRelationships}
            currentDocument="salesOrder"
            currentDocumentId={salesOrder.id}
            onNavigate={(type, id) => {
              if (type === 'estimate') {
                // Navigate to specific estimate for editing
                window.location.href = `/estimates?open=${id}`
              } else if (type === 'salesOrder') {
                // Navigate to specific sales order for editing
                window.location.href = `/sales-orders?open=${id}`
              } else if (type === 'invoice') {
                // Navigate to specific invoice for editing (when available)
                window.location.href = `/invoices?open=${id}`
              } else if (type === 'purchaseOrder') {
                // Navigate to specific purchase order for editing (when available)
                window.location.href = `/purchase-orders?open=${id}`
              }
            }}
          />
        </div>
      )}

      {/* Form Content */}
      <div className="flex-1 overflow-auto p-6 bg-white">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* Sales Order Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    .filter(c => (c.company_name || '').toLowerCase().includes(customer.toLowerCase()))
                    .map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm"
                      >
                        <div className="font-medium">{c.company_name}</div>
                        {c.email && <div className="text-xs text-gray-500">{c.email}</div>}
                      </button>
                    ))}
                    
                    {customer && !customers.find(c => (c.company_name || '').toLowerCase() === customer.toLowerCase()) && (
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">P.O. Number</label>
            <Input
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="Customer PO Number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sales Rep</label>
            <select
              value={salesRepId}
              onChange={(e) => {
                setSalesRepId(e.target.value)
                const selectedRep = salesReps.find(rep => rep.id === e.target.value)
                if (selectedRep) {
                  setSalesRep(`${selectedRep.first_name} ${selectedRep.last_name}`)
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Sales Rep...</option>
              {salesReps.map(rep => (
                <option key={rep.id} value={rep.id}>
                  {rep.first_name} {rep.last_name} ({rep.employee_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Terms</label>
            <TermsSelector
              value={terms}
              onChange={setTerms}
              placeholder="Payment terms"
            />
          </div>
        </div>

        {/* Show estimate reference if exists */}
        {salesOrder.estimate_number && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Converted from Estimate: {salesOrder.estimate_number}
              </span>
            </div>
          </div>
        )}


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
                  onChange={(e) => {
                    setShipSameAsBill(e.target.checked)
                    if (e.target.checked) {
                      setShipTo(billTo)
                    }
                  }}
                  className="rounded"
                />
                Same as Bill To
              </label>
            </div>
            <Textarea
              value={shipTo}
              onChange={(e) => setShipTo(e.target.value)}
              disabled={shipSameAsBill}
              placeholder="Shipping Address..."
              rows={6}
              className={`text-sm font-mono resize-y ${shipSameAsBill ? 'bg-gray-100' : ''}`}
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
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase" style={{width: '80px'}}>
                  Invoiced
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase" style={{width: '80px'}}>
                  Remaining
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
                    {/* Show reserved quantity indicator */}
                    {item.quantity_reserved && item.quantity_reserved > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        Reserved: {item.quantity_reserved}
                      </div>
                    )}
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
                  
                  <td className="px-3 py-2 text-center" style={{width: '80px'}}>
                    <div className="text-sm">
                      <span className={`font-medium ${item.qty_invoiced && item.qty_invoiced > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {item.qty_invoiced || 0}
                      </span>
                      {item.fulfillment_status === 'complete' && (
                        <CheckCircle className="w-3 h-3 text-green-600 inline-block ml-1" />
                      )}
                    </div>
                  </td>
                  
                  <td className="px-3 py-2 text-center" style={{width: '80px'}}>
                    <div className="text-sm">
                      <span className={`font-medium ${item.qty_remaining && item.qty_remaining > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {item.qty_remaining || 0}
                      </span>
                    </div>
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

        {/* Audit Trail Section */}
        <div className="pt-4 border-t">
          <AuditInfo
            lastEditedBy={(salesOrder as any).last_edited_by}
            lastEditedAt={(salesOrder as any).last_edited_at}
            createdBy={(salesOrder as any).created_by}
            createdAt={(salesOrder as any).created_at}
            showCreated={true}
            className="flex flex-col gap-1"
          />
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
                        {salesRep && <p><strong>Sales Rep:</strong> {salesRep}</p>}
                        {terms && <p><strong>Terms:</strong> {terms}</p>}
                        <p><strong>Status:</strong> {status.replace('_', ' ')}</p>
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
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">Bill To:</h3>
                      <div className="text-sm text-gray-600 whitespace-pre-line">
                        {billTo || customer + '\n[Address]'}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">Ship To:</h3>
                      <div className="text-sm text-gray-600 whitespace-pre-line">
                        {shipTo || billTo || customer + '\n[Address]'}
                      </div>
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
                        const costEach = inventoryItem?.weighted_average_cost || (product as any)?.cost || 0
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