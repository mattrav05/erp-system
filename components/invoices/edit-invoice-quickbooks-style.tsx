'use client'

import { useState, useEffect, useRef } from 'react'
import { useDefaultTaxRate } from '@/hooks/useDefaultTaxRate'
import { useCompanySettings } from '@/hooks/useCompanySettings'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import { useAuth } from '@/components/providers/auth-provider'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { X, Save, Plus, Trash2, FileText, Mail, Copy, Settings2, ArrowLeft, ArrowRight, Search, Eye, Calculator, Receipt, DollarSign, CheckCircle, AlertTriangle } from 'lucide-react'
import ContextMenu from '@/components/ui/context-menu'
import TemplateEditor from '@/components/templates/template-editor'
import DocumentFlowTracker, { DocumentRelationship } from '@/components/ui/document-flow-tracker'
import AuditInfo from '@/components/ui/audit-info'
import { executeSaveOperation, displayError } from '@/lib/error-handling'

// Utility function to calculate due date based on payment terms
const calculateDueDate = (invoiceDate: string, paymentTerms: string): string => {
  const baseDate = new Date(invoiceDate)
  let daysToAdd = 30 // Default to 30 days

  // Parse payment terms to determine days
  switch (paymentTerms.trim()) {
    case 'Due on receipt':
    case 'Due on Receipt':
      daysToAdd = 0
      break
    case 'Net 15':
      daysToAdd = 15
      break
    case 'Net 30':
      daysToAdd = 30
      break
    case 'Net 45':
      daysToAdd = 45
      break
    case 'Net 60':
      daysToAdd = 60
      break
    case '2/10 Net 30':
      daysToAdd = 30 // Net 30 is the full term
      break
    default:
      // Try to extract number from terms like "Net 45", "NET45", etc.
      const match = paymentTerms.match(/\d+/)
      if (match) {
        daysToAdd = parseInt(match[0])
      }
      break
  }

  baseDate.setDate(baseDate.getDate() + daysToAdd)
  return baseDate.toISOString().split('T')[0]
}

type Customer = Database['public']['Tables']['customers']['Row'] & {
  payment_terms?: { name: string } | null
}
type Product = Database['public']['Tables']['products']['Row']
type Invoice = any
type InvoiceTemplate = any
type SalesRep = Database['public']['Tables']['sales_reps']['Row']
type SalesOrder = Database['public']['Tables']['sales_orders']['Row']

interface InventoryItem {
  id: string
  product_id: string
  on_hand_quantity: number
  reserved_quantity: number
  available_quantity: number
  purchase_price: number | null
  last_cost: number | null
  products?: Product
}

interface LineItem {
  id: string
  item: string
  description: string
  qty: number
  rate: number
  amount: number
  unit_of_measure: string
  is_taxable?: boolean
  product_id?: string
  sales_order_line_id?: string
  // Partial invoicing support
  so_qty_ordered?: number
  so_qty_invoiced?: number
  so_qty_remaining?: number
  so_fulfillment_status?: string
  original_qty?: number // Track original invoice quantity for comparison
}

interface EditInvoiceQuickBooksStyleProps {
  invoice: Invoice
  onSave: (invoice: Invoice) => void
  onCancel: () => void
  onDelete?: (invoice: Invoice) => void
  invoices?: Invoice[]
  onNavigate?: (invoice: Invoice) => void
}

interface NewCustomerModal {
  show: boolean
  name: string
  email: string
  phone: string
  address: string
}

export default function EditInvoiceQuickBooksStyle({ 
  invoice,
  onSave, 
  onCancel,
  onDelete,
  invoices = [],
  onNavigate
}: EditInvoiceQuickBooksStyleProps) {
  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Invoice fields
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number)
  const [customer, setCustomer] = useState(invoice.customer_name || '')
  const [customerId, setCustomerId] = useState<string | null>(invoice.customer_id)
  const [customerDropdown, setCustomerDropdown] = useState(false)
  const [newCustomerModal, setNewCustomerModal] = useState<NewCustomerModal>({
    show: false,
    name: '',
    email: '',
    phone: '',
    address: ''
  })
  const [date, setDate] = useState(invoice.invoice_date || new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(invoice.due_date || '')
  const [salesRepId, setSalesRepId] = useState<string | null>(invoice.sales_rep_id || null)
  const [terms, setTerms] = useState(invoice.terms || 'Net 30')
  const [status, setStatus] = useState<string>(invoice.status || 'DRAFT')
  const [billTo, setBillTo] = useState(invoice.bill_to_address || '')
  const [shipTo, setShipTo] = useState(invoice.ship_to_address || '')
  const [shipSameAsBill, setShipSameAsBill] = useState(false)

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', item: '', description: '', qty: 1, rate: 0, amount: 0, unit_of_measure: 'ea', is_taxable: false }
  ])
  const [activeItemDropdowns, setActiveItemDropdowns] = useState<{[key: string]: boolean}>({})
  const [dropdownPosition, setDropdownPosition] = useState<{top: number, left: number, width: number} | null>(null)

  // Column widths for resizable headers
  const [columnWidths, setColumnWidths] = useState({
    item: 120,
    description: 280,
    qty: 80,
    fulfillment: 120,
    rate: 90,
    tax: 120,
    amount: 90
  })
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)

  // Totals
  const [subtotal, setSubtotal] = useState(invoice.subtotal || 0)
  const [taxAmount, setTaxAmount] = useState(invoice.tax_amount || 0)
  const [total, setTotal] = useState(invoice.total_amount || 0)
  const [amountPaid, setAmountPaid] = useState(invoice.amount_paid || 0)
  
  // Profit calculations
  const [totalCost, setTotalCost] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [profitMargin, setProfitMargin] = useState(0)
  const [showProfitCalculator, setShowProfitCalculator] = useState(false)
  
  // Get backend-controlled tax rate from settings
  const { defaultTaxRate } = useDefaultTaxRate()
  
  // Get company settings for addresses
  const { companySettings, getBillingAddress, getShippingAddress } = useCompanySettings()
  
  // Get current authenticated user
  const { user } = useAuth()

  // Notes
  const [memo, setMemo] = useState(invoice.memo || '')
  const [customerMessage, setCustomerMessage] = useState(invoice.customer_message || '')

  // UI state
  const [showPreview, setShowPreview] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Add browser-level unsaved changes warning
  useUnsavedChangesWarning(hasUnsavedChanges, 'You have unsaved changes to this invoice. Are you sure you want to leave?')
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  // Document relationships for flow tracking
  const [documentRelationships, setDocumentRelationships] = useState<DocumentRelationship>({})
  const [sourceSalesOrderId, setSourceSalesOrderId] = useState<string | null>(invoice.sales_order_id || null)

  // Refs for click outside handling
  const customerDropdownRef = useRef<HTMLDivElement>(null)
  const itemDropdownRefs = useRef<{[key: string]: HTMLDivElement | null}>({})

  // Click outside and scroll handler
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
          setDropdownPosition(null)
        }
      })
    }

    const handleScroll = () => {
      // Close dropdowns on scroll to prevent misalignment
      setActiveItemDropdowns({})
      setDropdownPosition(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [customerDropdown, activeItemDropdowns])

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        await fetchData()
        await fetchInvoiceLines()
        await loadDocumentRelationships()
        
        // Mark as initialized after all data is loaded
        setIsInitialized(true)
      } catch (error) {
        console.error('Error during component initialization:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    initializeComponent()
  }, [])

  // Add visibility change listener to refresh docflow when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible, refresh docflow to catch any new relationships
        loadDocumentRelationships()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [invoice.id])

  // Column resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !tableRef.current) return
      
      const table = tableRef.current
      const rect = table.getBoundingClientRect()
      const x = e.clientX - rect.left
      
      let cumulativeWidth = 0
      const columns = ['item', 'description', 'qty', 'fulfillment', 'rate', 'tax', 'amount'] as const
      
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
    // Calculate totals using backend tax rate, ensuring numbers
    const newSubtotal = lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const taxableSubtotal = lineItems
      .filter(item => item.is_taxable)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const newTaxAmount = (taxableSubtotal * defaultTaxRate) / 100
    const newTotal = newSubtotal + newTaxAmount
    
    // Calculate profit using inventory costs
    const newTotalCost = lineItems.reduce((sum, item) => {
      // Find the inventory item to get its weighted average cost
      const inventoryItem = inventory.find(inv => inv.product_id === item.product_id)
      // Use inventory cost if available, otherwise product cost, otherwise 0
      const costEach = (inventoryItem as any)?.weighted_average_cost ||
                       (inventoryItem as any)?.last_cost ||
                       (inventoryItem as any)?.purchase_price ||
                       (products.find(p => p.id === item.product_id) as any)?.cost || 0
      return sum + (costEach * Number(item.qty || 0))
    }, 0)
    
    const newTotalProfit = newSubtotal - newTotalCost
    const newProfitMargin = newSubtotal > 0 ? (newTotalProfit / newSubtotal) * 100 : 0

    // Debug: Log totals calculation when needed
    // console.log('Calculating totals:', { newSubtotal, newTaxAmount, newTotal, isInitialized })

    setSubtotal(newSubtotal)
    setTaxAmount(newTaxAmount)
    setTotal(newTotal)
    setTotalCost(newTotalCost)
    setTotalProfit(newTotalProfit)
    setProfitMargin(newProfitMargin)

    // Only mark as unsaved if component has been initialized and user has interacted
    if (isInitialized) {
      setHasUnsavedChanges(true)
    }
  }, [lineItems, defaultTaxRate, isInitialized, inventory, products])

  // Auto-calculate due date when payment terms or invoice date changes
  useEffect(() => {
    if (date && terms) {
      const newDueDate = calculateDueDate(date, terms)
      setDueDate(newDueDate)
    }
  }, [date, terms])

  // Load invoice lines from database
  const fetchInvoiceLines = async () => {
    try {
      const { data: lines, error } = await supabase
        .from('invoice_lines')
        .select(`
          *,
          sales_order_lines (
            quantity,
            qty_invoiced,
            qty_remaining,
            fulfillment_status
          )
        `)
        .eq('invoice_id', invoice.id)
        .order('line_number')

      if (error) throw error

      const items: LineItem[] = lines.map(line => {
        const qty = Number(line.quantity || 1)
        const rate = Number(line.unit_price || 0)
        // Use database-calculated amount if available, fallback to manual calculation
        const amount = Number(line.amount || line.line_total || (qty * rate))
        
        return {
          id: line.id,
          item: line.item_name || line.item_code || '',
          description: line.description || '',
          qty: qty,
          rate: rate,
          amount: amount,
          unit_of_measure: line.unit_of_measure || 'ea',
          is_taxable: line.is_taxable || false,
          product_id: line.product_id || undefined,
          sales_order_line_id: line.sales_order_line_id || undefined,
          // Fulfillment tracking data
          so_qty_ordered: line.sales_order_lines?.quantity || undefined,
          so_qty_invoiced: line.sales_order_lines?.qty_invoiced || undefined,
          so_qty_remaining: line.sales_order_lines?.qty_remaining || undefined,
          so_fulfillment_status: line.sales_order_lines?.fulfillment_status || undefined,
          original_qty: qty // Track original quantity for comparison
        }
      })

      if (items.length > 0) {
        setLineItems(items)
        
        // Check if this is a remainder invoice and update memo if needed
        if (invoice.sales_order_id && items.some(item => item.sales_order_line_id)) {
          await checkAndUpdateRemainderMemo(items)
        }
      }
    } catch (error) {
      console.error('Error fetching invoice lines:', error)
    }
  }

  // Check if this is a remainder invoice and update memo accordingly
  const checkAndUpdateRemainderMemo = async (invoiceItems: LineItem[]) => {
    try {
      if (!sourceSalesOrderId) return
      
      // Get the sales order to check its number and status
      const { data: salesOrder, error: soError } = await supabase
        .from('sales_orders')
        .select('so_number, sales_order_lines(*)')
        .eq('id', sourceSalesOrderId)
        .single()
      
      if (soError || !salesOrder) return
      
      // Check if any line items have been previously invoiced (not first invoice)
      const hasBeenPartiallyInvoiced = salesOrder.sales_order_lines.some((line: any) => (line.qty_invoiced || 0) > 0)
      
      // Check if this appears to be a remainder invoice
      const isRemainderInvoice = hasBeenPartiallyInvoiced && invoiceItems.every(item => {
        if (!item.sales_order_line_id) return true // Skip non-SO items
        
        const soLine = salesOrder.sales_order_lines.find((l: any) => l.id === item.sales_order_line_id)
        if (!soLine) return true
        
        const remainingQty = soLine.qty_remaining || (soLine.quantity - (soLine.qty_invoiced || 0))
        // Check if this invoice line quantity equals the remaining quantity (indicating final/remainder)
        return remainingQty > 0 && Math.abs(item.qty - remainingQty) < 0.001
      })
      
      // Update memo if current memo doesn't already indicate remainder/final
      const currentMemo = memo || ''
      const shouldUpdateMemo = isRemainderInvoice && 
        !currentMemo.toLowerCase().includes('final') && 
        !currentMemo.toLowerCase().includes('remainder')
      
      if (shouldUpdateMemo) {
        setMemo(`Final/remainder invoice from Sales Order ${salesOrder.so_number}`)
      } else if (hasBeenPartiallyInvoiced && !currentMemo.includes('Sales Order') && !currentMemo.includes('SO')) {
        // If it's partial but not remainder, and memo doesn't reference SO
        setMemo(`Partial invoice from Sales Order ${salesOrder.so_number}`)
      } else if (!hasBeenPartiallyInvoiced && !currentMemo.includes('Sales Order') && !currentMemo.includes('SO')) {
        // If it's the first invoice and memo doesn't reference SO
        setMemo(`Invoice created from Sales Order ${salesOrder.so_number}`)
      }
      
    } catch (error) {
      console.error('Error checking remainder invoice status:', error)
    }
  }

  // Load document relationships
  const loadDocumentRelationships = async () => {
    try {
      const relationships: DocumentRelationship = {
        invoice: {
          id: invoice.id,
          number: invoice.invoice_number,
          status: invoice.status,
          date: invoice.invoice_date,
          amount: invoice.total_amount || 0
        }
      }

      // Check for related sales order
      if (invoice.sales_order_id) {
        const { data: salesOrder, error: soError } = await supabase
          .from('sales_orders')
          .select('*')
          .eq('id', invoice.sales_order_id)
          .single()

        if (!soError && salesOrder) {
          relationships.salesOrder = {
            id: salesOrder.id,
            number: salesOrder.so_number || '',
            status: salesOrder.status,
            date: salesOrder.order_date,
            amount: salesOrder.total_amount || 0
          }

          // Check for related estimate through the sales order
          if (salesOrder.estimate_id) {
            const { data: estimate, error: estError } = await supabase
              .from('estimates')
              .select('*')
              .eq('id', salesOrder.estimate_id)
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

          // Check for related purchase orders through the sales order
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
          }

          // Check for all invoices from the same sales order (including current invoice)
          const { data: allInvoices, error: invError } = await supabase
            .from('invoices')
            .select('*')
            .eq('sales_order_id', salesOrder.id)
            .order('created_at', { ascending: true })

          if (!invError && allInvoices && allInvoices.length > 0) {
            // Support multiple invoices per SO
            relationships.invoices = allInvoices.map(inv => ({
              id: inv.id,
              number: inv.invoice_number,
              status: inv.status,
              date: inv.invoice_date,
              amount: inv.total_amount || 0,
              sequence: inv.invoice_sequence || 1,
              isPartial: inv.is_partial_invoice || false,
              isFinal: inv.is_final_invoice || false
            }))
          }
        } else if (soError && soError.code === 'PGRST116') {
          // SO was deleted, clear the reference in the invoice
          console.log('Referenced SO no longer exists, clearing invoice reference')
          await supabase
            .from('invoices')
            .update({ sales_order_id: null })
            .eq('id', invoice.id)
        }
      }

      setDocumentRelationships(relationships)
      
    } catch (error) {
      console.error('Error loading sales order data:', error)
    }
  }

  const fetchData = async () => {
    try {
      const [customersRes, productsRes, inventoryRes, templatesRes, salesRepsRes] = await Promise.all([
        supabase.from('customers').select('*, payment_terms(*)').order('company_name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('inventory').select('*, products(*)').order('products(name)'),
        supabase.from('invoice_templates').select('*').order('template_name'),
        supabase.from('sales_reps').select('*').order('first_name')
      ])

      if (customersRes.data) setCustomers(customersRes.data)
      if (productsRes.data) setProducts(productsRes.data)
      if (inventoryRes.data) setInventory(inventoryRes.data as InventoryItem[])
      if (templatesRes.data) setTemplates(templatesRes.data)
      if (salesRepsRes.data) setSalesReps(salesRepsRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
    // Don't set loading false here - let the initialization useEffect handle it
  }

  // Handle delete
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}? This action cannot be undone.`)) {
      return
    }

    try {
      // Multi-invoice model - no need to clear SO references since converted_to_invoice_id doesn't exist

      // Then delete the invoice (invoice_lines will cascade delete)
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id)

      if (error) throw error

      if (onDelete) {
        onDelete(invoice)
      }
    } catch (error) {
      console.error('Error deleting invoice:', error)
      alert('Failed to delete invoice')
    }
  }

  // Navigation between invoices
  const currentIndex = invoices.findIndex(inv => inv.id === invoice.id)
  const canNavigatePrevious = currentIndex > 0
  const canNavigateNext = currentIndex < invoices.length - 1

  const handlePrevious = () => {
    const targetIndex = currentIndex - 1
    const targetInvoice = invoices[targetIndex]
    if (onNavigate && targetInvoice) {
      onNavigate(targetInvoice)
    }
  }

  const handleNext = () => {
    const targetIndex = currentIndex + 1
    const targetInvoice = invoices[targetIndex]
    if (onNavigate && targetInvoice) {
      onNavigate(targetInvoice)
    }
  }

  const generateInvoiceNumber = async () => {
    try {
      const today = new Date()
      const year = today.getFullYear().toString().slice(-2)
      const month = (today.getMonth() + 1).toString().padStart(2, '0')
      const day = today.getDate().toString().padStart(2, '0')
      
      // For partial invoices from sales orders, use SO reference + sequence
      if (invoice.sales_order_id && invoice.is_partial_invoice) {
        // Get next sequence number for this sales order
        const { data: existingInvoices, error: seqError } = await supabase
          .from('invoices')
          .select('invoice_sequence')
          .eq('sales_order_id', invoice.sales_order_id)
          .order('invoice_sequence', { ascending: false })
          .limit(1)
        
        if (seqError) throw seqError
        
        const nextSequence = (existingInvoices?.[0]?.invoice_sequence || 0) + 1
        const baseNumber = `INV-${year}${month}${day}`
        
        // Check if we need a unique suffix
        let attempt = 1
        let candidateNumber = `${baseNumber}-${String(attempt).padStart(2, '0')}-${nextSequence}`
        
        while (await invoiceNumberExists(candidateNumber)) {
          attempt++
          candidateNumber = `${baseNumber}-${String(attempt).padStart(2, '0')}-${nextSequence}`
        }
        
        setInvoiceNumber(candidateNumber)
        return
      }
      
      // For regular invoices, use sequential numbering with uniqueness check
      const { count, error: countError } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
      
      if (countError) throw countError
      
      let attempt = (count || 0) + 1
      let candidateNumber = `INV-${year}${month}${day}-${String(attempt).padStart(3, '0')}`
      
      // Ensure uniqueness
      while (await invoiceNumberExists(candidateNumber)) {
        attempt++
        candidateNumber = `INV-${year}${month}${day}-${String(attempt).padStart(3, '0')}`
      }
      
      setInvoiceNumber(candidateNumber)
    } catch (error) {
      console.error('Error generating invoice number:', error)
      // Fallback to timestamp-based number
      const timestamp = Date.now().toString().slice(-6)
      setInvoiceNumber(`INV-${timestamp}`)
    }
  }

  // Helper function to check if invoice number already exists
  const invoiceNumberExists = async (number: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id')
        .eq('invoice_number', number)
        .limit(1)
      
      if (error) throw error
      return data && data.length > 0
    } catch (error) {
      console.error('Error checking invoice number existence:', error)
      return false // Assume doesn't exist if we can't check
    }
  }

  // Customer handling
  const handleCustomerSearch = (value: string) => {
    setCustomer(value)
    setCustomerDropdown(true)
    
    // Check if this could be a new customer
    const existing = customers.find(c =>
      ((c as any).company_name || c.name).toLowerCase() === value.toLowerCase()
    )
    
    if (!existing && value.trim()) {
      // This might be a new customer name
    }
  }

  const selectCustomer = (customerData: Customer) => {
    setCustomer((customerData as any).company_name || customerData.name)
    setCustomerId(customerData.id)
    setCustomerDropdown(false)
    
    // Auto-fill payment terms from customer if available
    if (customerData.payment_terms?.name) {
      setTerms(customerData.payment_terms.name)
    }
    
    // Set Bill To with customer info
    let billToText = (customerData as any).company_name || customerData.name
    if ((customerData as any).address_line_1) {
      billToText += '\n' + (customerData as any).address_line_1
    }
    if ((customerData as any).address_line_2) {
      billToText += '\n' + (customerData as any).address_line_2
    }
    if ((customerData as any).city || (customerData as any).state || (customerData as any).zip_code) {
      billToText += '\n' + [(customerData as any).city, (customerData as any).state, (customerData as any).zip_code].filter(Boolean).join(', ')
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
    console.log('=== QUICK ADD CUSTOMER DEBUG (INVOICE EDIT) ===')
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
        payment_terms: 'NET30',  // Fixed: uppercase to match database constraint
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
      
      setNewCustomerModal({
        show: false,
        name: '',
        email: '',
        phone: '',
        address: ''
      })
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

  // Line item handling
  const updateLineItem = (id: string, field: string, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        
        // Recalculate amount when qty or rate changes, ensuring numbers
        if (field === 'qty' || field === 'rate') {
          const qty = Number(updated.qty || 0)
          const rate = Number(updated.rate || 0)
          updated.amount = qty * rate
        }
        
        return updated
      }
      return item
    }))
  }

  const addLineItem = () => {
    const newId = Date.now().toString()
    setLineItems(prev => [...prev, {
      id: newId,
      item: '',
      description: '',
      qty: 1,
      rate: 0,
      amount: 0,
      unit_of_measure: 'ea',
      is_taxable: false
    }])
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(item => item.id !== id))
    }
  }

  const selectProduct = (lineId: string, product: Product) => {
    // Find inventory item for this product to get pricing
    const inventoryItem = inventory.find(inv => inv.product_id === product.id)
    
    updateLineItem(lineId, 'item', product.sku || '')
    updateLineItem(lineId, 'description', product.description || product.name)
    updateLineItem(lineId, 'product_id', product.id)
    
    // Use sales price from product, fallback to cost if no sales price
    const salePrice = (product as any).selling_price || (inventoryItem as any)?.purchase_price || 0
    updateLineItem(lineId, 'rate', salePrice)
    updateLineItem(lineId, 'amount', salePrice * 1) // qty is 1 by default
    
    // Apply default tax setting from product
    updateLineItem(lineId, 'is_taxable', (product as any).is_taxable || false)
    
    setActiveItemDropdowns(prev => ({ ...prev, [lineId]: false }))
  }

  // Handle save
  const handleSave = async () => {
    const validLineItems = lineItems.filter(item => item.description.trim())
    
    // Validate line items for partial invoicing constraints when editing SO-linked invoices
    if (invoice.sales_order_id) {
      const validationErrors: string[] = []
      validLineItems.forEach((item, index) => {
        if (item.sales_order_line_id && item.so_qty_remaining !== undefined && item.original_qty) {
          // For edits, allow the original quantity plus any remaining quantity
          const maxAllowed = item.so_qty_remaining + item.original_qty
          if (item.qty > maxAllowed) {
            validationErrors.push(`Line ${index + 1}: Quantity (${item.qty}) exceeds available quantity (${maxAllowed}) including original invoice amount`)
          }
          if (item.qty <= 0) {
            validationErrors.push(`Line ${index + 1}: Quantity must be greater than 0`)
          }
        }
      })
      
      if (validationErrors.length > 0) {
        alert(`Validation Errors:\n\n${validationErrors.join('\n')}`)
        setIsSaving(false)
        return
      }
    }
    
    // Prepare validation data
    const validationData = {
      customer_id: customerId,
      invoice_date: date,
      invoice_number: invoiceNumber,
      invoice_sequence: invoice.invoice_sequence,
      line_items: validLineItems.map(item => ({
        description: item.description,
        quantity: item.qty,
        unit_price: item.rate
      })),
      // Include sales order context for validation
      sales_order_id: invoice.sales_order_id,
      is_partial_invoice: invoice.is_partial_invoice
    }

    setIsSaving(true)
    
    const saveResult = await executeSaveOperation(
      'UPDATE_INVOICE',
      'invoice',
      invoice.id,
      async () => {
      // Update invoice
      const updateData = {
        invoice_number: invoiceNumber,
        customer_id: customerId,
        customer_name: customer,
        sales_order_id: sourceSalesOrderId,
        invoice_sequence: invoice.invoice_sequence || null,
        invoice_date: date,
        due_date: dueDate,
        terms: terms,
        status: status,
        bill_to_address: billTo || null,
        ship_to_address: shipTo || null,
        sales_rep_id: salesRepId,
        subtotal: subtotal,
        tax_amount: taxAmount,
        // total_amount: total, // Remove this - database constraint prevents manual update (it's computed automatically)
        amount_paid: amountPaid,
        memo: memo || null,
        customer_message: customerMessage || null,
        last_edited_by: user?.id || null,
        is_partial_invoice: invoice.is_partial_invoice || false,
        is_final_invoice: invoice.is_final_invoice || false
      }
      
      console.log('Update data:', updateData)
      
      const { data: updatedInvoice, error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id)
        .select(`
          *,
          customers (company_name, contact_name)
        `)
        .single()

      console.log('Update result:', { data: updatedInvoice, error })
      
      if (error) {
        console.error('Error updating invoice:', error)
        throw error
      }

      // Delete existing line items and recreate
      const { error: deleteError } = await supabase
        .from('invoice_lines')
        .delete()
        .eq('invoice_id', invoice.id)
      
      if (deleteError) {
        console.error('Error deleting existing invoice lines:', deleteError)
        throw deleteError
      }

      // Create updated line items using new invoice_lines table structure
      const invoiceLines = lineItems
        .filter(item => item.description.trim())
        .map((item, index) => ({
          invoice_id: invoice.id,
          // Line ordering
          line_number: index + 1,
          // Basic line information
          item_name: item.item || 'Item',
          description: item.description,
          quantity: item.qty,
          qty_from_so: item.sales_order_line_id ? item.qty : null, // Track SO quantities
          unit_price: item.rate,
          unit_of_measure: item.unit_of_measure,
          // Reference data
          product_id: item.product_id || null,
          sales_order_line_id: item.sales_order_line_id || null,
          // Tax information
          is_taxable: item.is_taxable || false,
          tax_rate: item.is_taxable ? defaultTaxRate : 0,
          tax_amount: item.is_taxable ? (item.amount * defaultTaxRate / 100) : 0,
          // Audit
          created_by: user?.id || null,
          last_modified_by: user?.id || null
        }))

      if (invoiceLines.length > 0) {
        console.log('Inserting invoice lines:', invoiceLines)
        const { error: linesError } = await supabase
          .from('invoice_lines')
          .insert(invoiceLines)

        if (linesError) {
          console.error('Error inserting invoice lines:', linesError)
          console.error('Lines data that failed:', invoiceLines)
          throw linesError
        }
        console.log('Successfully inserted invoice lines')
      }

      // TODO: Finalize inventory when invoice status changes to sent/paid
      // For now, just track the invoice update

        setHasUnsavedChanges(false)
        return updatedInvoice
      },
      validationData
    )

    // Handle the result
    if (saveResult.success) {
      onSave(saveResult.data!)
    } else {
      // Display user-friendly error message
      const errorMsg = displayError(saveResult.error!, process.env.NODE_ENV === 'development')
      
      // Add specific handling for invoice constraints
      if (saveResult.error!.message.includes('duplicate key')) {
        if (saveResult.error!.message.includes('invoice_number')) {
          alert(`Invoice number ${invoiceNumber} already exists.\n\nPlease use a different invoice number.`)
        } else {
          alert(errorMsg)
        }
      } else if (saveResult.error!.message.includes('violates foreign key constraint')) {
        if (saveResult.error!.message.includes('sales_order')) {
          alert('Cannot update invoice that references a sales order.\n\nThe sales order may have been deleted or the reference is invalid.')
        } else {
          alert(errorMsg)
        }
      } else {
        alert(errorMsg)
      }
    }
    
    setIsSaving(false)
  }

  // Handle cancel
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return
      }
    }
    onCancel()
  }

  // Generate PDF functionality
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

    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .company-info { margin-bottom: 20px; }
            .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .address-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .address-box { width: 48%; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background-color: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
            .totals { text-align: right; margin-top: 20px; }
            .totals table { width: 300px; margin-left: auto; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            .partial-invoice-banner { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin-bottom: 20px; border-radius: 5px; }
          </style>
          ${forDownload ? `
          <script>
            window.onload = function() {
              // Auto-download as HTML file
              const filename = 'Invoice_${invoiceNumber}_${customer.replace(/[^a-zA-Z0-9]/g, '_')}.html';
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
            <h1>INVOICE</h1>
          </div>
          
          ${invoice.sales_order_id && invoice.is_partial_invoice ? `
          <div class="partial-invoice-banner">
            <strong>⚠️ PARTIAL INVOICE</strong> - This is invoice ${invoice.invoice_sequence || 1} from Sales Order
          </div>
          ` : ''}
          
          <div class="company-info">
            <strong>${companySettings?.company_name || '[Your Company Name]'}</strong><br>
            ${getBillingAddress().replace(/\n/g, '<br>')}
          </div>
          
          <div class="invoice-info">
            <div>
              <strong>Invoice #:</strong> ${invoiceNumber}<br>
              <strong>Date:</strong> ${date}<br>
              <strong>Due Date:</strong> ${dueDate}<br>
              ${sourceSalesOrderId && documentRelationships.salesOrder ? `<strong>Sales Order #:</strong> ${documentRelationships.salesOrder.number}<br>` : ''}
              ${(() => {
                const rep = salesReps.find(r => r.id === salesRepId)
                return rep ? `<strong>Sales Rep:</strong> ${rep.first_name} ${rep.last_name}<br>` : ''
              })()}
            </div>
            <div>
              <strong>Status:</strong> ${status.charAt(0).toUpperCase() + status.slice(1)}<br>
              <strong>Terms:</strong> ${terms}<br>
              ${amountPaid > 0 ? `<strong>Amount Paid:</strong> $${amountPaid.toFixed(2)}<br>` : ''}
              ${total - amountPaid > 0 ? `<strong>Balance Due:</strong> $${(total - amountPaid).toFixed(2)}` : ''}
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
              ${amountPaid > 0 ? `
              <tr>
                <td>Amount Paid:</td>
                <td style="text-align: right;">($${amountPaid.toFixed(2)})</td>
              </tr>
              <tr class="total-row">
                <td><strong>Balance Due:</strong></td>
                <td style="text-align: right;"><strong>$${(total - amountPaid).toFixed(2)}</strong></td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          ${customerMessage ? `<div style="margin-top: 30px;"><strong>Message:</strong><br>${customerMessage.replace(/\n/g, '<br>')}</div>` : ''}
          ${memo ? `<div style="margin-top: 15px; color: #666; font-style: italic;"><strong>Internal Memo:</strong><br>${memo.replace(/\n/g, '<br>')}</div>` : ''}
        </body>
      </html>
    `
    
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(invoiceHTML)
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
    try {
      // Auto-mark as sent and save when email is clicked
      if (status !== 'SENT') {
        setStatus('SENT')
        setHasUnsavedChanges(true)
        await handleSave()
      }

      // Generate downloadable PDF
      const printWindow = await generatePDF(true)
      if (!printWindow) {
        alert('Failed to generate PDF. Please try again.')
        return
      }

      // Small delay to ensure download starts, then open email
      setTimeout(() => {
        const customerEmail = customers.find(c => c.id === customerId)?.email
        const subject = `Invoice ${invoiceNumber} for ${customer}`
        const body = `Dear ${customer},

Please find attached Invoice ${invoiceNumber}.

Invoice Summary:
- Date: ${date}
- Due Date: ${new Date(dueDate).toLocaleDateString()}
- Total: ${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(total)}
- Terms: ${terms}
${amountPaid > 0 ? `- Balance Due: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total - amountPaid)}` : ''}

${customerMessage || 'Thank you for your business!'}

Best regards,
${companySettings?.company_name || 'Your Company'}`
        
        const mailtoUrl = customerEmail 
          ? `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
          : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        
        window.location.href = mailtoUrl
      }, 2000)
    } catch (error) {
      console.error('Error during email process:', error)
      // Still open email even if save failed
      setTimeout(() => {
        window.location.href = `mailto:?subject=${encodeURIComponent(`Invoice ${invoiceNumber}`)}&body=${encodeURIComponent('Please find attached the invoice.')}`
      }, 2000)
    }
  }

  const handleMarkAsSent = async () => {
    if (!confirm('Mark this invoice as sent? This will change the status from Draft to Sent.')) {
      return
    }
    
    try {
      setStatus('SENT')
      setHasUnsavedChanges(true)
      
      // Optionally auto-save after status change
      await handleSave()
    } catch (error) {
      console.error('Error marking invoice as sent:', error)
      alert('Failed to mark invoice as sent')
    }
  }

  // Duplicate functionality
  const handleDuplicate = async () => {
    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      const shouldSave = confirm('You have unsaved changes. Would you like to save the current invoice before duplicating?')
      if (shouldSave) {
        // In create mode, we save first, then duplicate
        await handleSave()
        // After saving, generate unique number for duplicate
        await generateInvoiceNumber()
        
        setDate(new Date().toISOString().split('T')[0])
        const today = new Date()
        const due = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
        setDueDate(due.toISOString().split('T')[0])
        setStatus('draft')
        setHasUnsavedChanges(true)
        
        alert(`Invoice duplicated successfully with number: ${invoiceNumber}!\n\nRemember to save this new invoice.`)
        return
      }
    }
    
    // Generate new invoice number
    await generateInvoiceNumber()
    setDate(new Date().toISOString().split('T')[0])
    const today = new Date()
    const due = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    setDueDate(due.toISOString().split('T')[0])
    setStatus('draft')
    setHasUnsavedChanges(true)
    
    alert(`Invoice duplicated with new number: ${invoiceNumber}`)
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'sent': return 'bg-blue-100 text-blue-800'
      case 'paid': return 'bg-green-100 text-green-800'
      case 'partial': return 'bg-yellow-100 text-yellow-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      case 'cancelled': return 'bg-gray-100 text-gray-600'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredCustomers = customers.filter(c =>
    ((c as any).company_name || c.name).toLowerCase().includes(customer.toLowerCase())
  ).slice(0, 8)

  const getFilteredProducts = (lineId: string) => {
    const searchTerm = lineItems.find(l => l.id === lineId)?.item?.toLowerCase() || ''
    return products.filter(p =>
      p.name.toLowerCase().includes(searchTerm) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm))
    ).slice(0, 8)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header Bar - Matching Sales Orders and Purchase Orders Structure */}
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
                title="Navigate to previous invoice"
              >
                <ArrowLeft className={`w-4 h-4 ${canNavigatePrevious ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0" 
                disabled={!canNavigateNext}
                onClick={handleNext}
                title="Navigate to next invoice"
              >
                <ArrowRight className={`w-4 h-4 ${canNavigateNext ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
            </div>

            {/* Title with unsaved indicator */}
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-gray-800">Edit Invoice</h1>
              {hasUnsavedChanges && (
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-xs">Unsaved</span>
                </div>
              )}
              <Badge className={getStatusBadgeColor(status)}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
              {invoice.qbo_sync_status === 'synced' && (
                <Badge className="bg-purple-100 text-purple-800">QBO</Badge>
              )}
            </div>
          </div>

          {/* Invoice Number Display */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Invoice #:</label>
            <span className="text-sm font-medium text-gray-800">{invoiceNumber}</span>
          </div>
        </div>

        {/* Bottom Row - Action Buttons */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1">
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
              <FileText className="w-3 h-3 mr-1" /> Print
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleEmail}>
              <Mail className="w-3 h-3 mr-1" /> Email
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleDuplicate}>
              <Copy className="w-3 h-3 mr-1" /> Duplicate
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {/* Status Actions for Draft Invoices */}
            {status === 'DRAFT' && (
              <>
                <Button size="sm" variant="outline" className="text-xs h-7 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200" onClick={handleMarkAsSent}>
                  <CheckCircle className="w-3 h-3 mr-1" /> Mark as Sent
                </Button>
                
                {/* Divider */}
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
            currentDocument="invoice"
            currentDocumentId={invoice.id}
            onNavigate={(type, id) => {
              if (type === 'estimate') {
                window.location.href = `/estimates?open=${id}`
              } else if (type === 'salesOrder') {
                window.location.href = `/sales-orders?open=${id}`
              } else if (type === 'purchaseOrder') {
                window.location.href = `/purchase-orders?open=${id}`
              } else if (type === 'invoice') {
                window.location.href = `/invoices?open=${id}`
              }
            }}
          />
        </div>
      )}


      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto p-6 space-y-6">
          {/* Header Section */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer <span className="text-red-500">*</span>
                  </label>
                  <div className="relative" ref={customerDropdownRef}>
                    <Input
                      value={customer}
                      onChange={(e) => handleCustomerSearch(e.target.value)}
                      placeholder="Select or type customer..."
                      className="w-full"
                    />
                    {customerDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map(c => (
                            <div
                              key={c.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => selectCustomer(c)}
                            >
                              <div className="font-medium">{(c as any).company_name || c.name}</div>
                              {c.email && <div className="text-sm text-gray-600">{c.email}</div>}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2">
                            <div className="text-gray-600">No customers found</div>
                            {customer.trim() && (
                              <button
                                className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                onClick={handleQuickAddCustomer}
                              >
                                + Add "{customer}" as new customer
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sales Rep</label>
                  <select
                    value={salesRepId || ''}
                    onChange={(e) => setSalesRepId(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select sales rep...</option>
                    {salesReps.map(rep => (
                      <option key={rep.id} value={rep.id}>{rep.first_name} {rep.last_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                  <select
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                    <option value="2/10 Net 30">2/10 Net 30</option>
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice #</label>
                    <Input
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={async (e) => {
                        const newStatus = e.target.value
                        setStatus(newStatus)
                        
                        // Auto-save when status changes to SENT
                        if (newStatus === 'SENT') {
                          setHasUnsavedChanges(true)
                          try {
                            await handleSave()
                          } catch (error) {
                            console.error('Error auto-saving when marking as sent:', error)
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="SENT">Sent</option>
                      <option value="PAID">Paid</option>
                      <option value="PARTIAL">Partial</option>
                      <option value="OVERDUE">Overdue</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Addresses Section */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bill To</label>
                <Textarea
                  value={billTo}
                  onChange={(e) => {
                    setBillTo(e.target.value)
                    if (shipSameAsBill) {
                      setShipTo(e.target.value)
                    }
                  }}
                  placeholder="Billing address..."
                  rows={4}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Ship To</label>
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
                      className="rounded border-gray-300"
                    />
                    Same as billing
                  </label>
                </div>
                <Textarea
                  value={shipTo}
                  onChange={(e) => setShipTo(e.target.value)}
                  placeholder="Shipping address..."
                  rows={4}
                  disabled={shipSameAsBill}
                />
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="bg-white rounded-lg shadow-sm border" style={{ position: 'relative' }}>
            <div className="overflow-x-auto">
              <table className="w-full" ref={tableRef}>
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700" style={{ width: columnWidths.item }}>
                      Item
                      <div
                        className="inline-block w-1 h-full cursor-col-resize hover:bg-gray-400 ml-2"
                        onMouseDown={() => handleStartResize('item')}
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700" style={{ width: columnWidths.description }}>
                      Description
                      <div
                        className="inline-block w-1 h-full cursor-col-resize hover:bg-gray-400 ml-2"
                        onMouseDown={() => handleStartResize('description')}
                      />
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700" style={{ width: columnWidths.qty }}>
                      Qty
                      <div
                        className="inline-block w-1 h-full cursor-col-resize hover:bg-gray-400 ml-2"
                        onMouseDown={() => handleStartResize('qty')}
                      />
                    </th>
                    {invoice.sales_order_id && (
                      <th className="text-center py-3 px-4 font-medium text-gray-700" style={{ width: columnWidths.fulfillment }}>
                        SO Fulfillment
                        <div
                          className="inline-block w-1 h-full cursor-col-resize hover:bg-gray-400 ml-2"
                          onMouseDown={() => handleStartResize('fulfillment')}
                        />
                      </th>
                    )}
                    <th className="text-right py-3 px-4 font-medium text-gray-700" style={{ width: columnWidths.rate }}>
                      Rate
                      <div
                        className="inline-block w-1 h-full cursor-col-resize hover:bg-gray-400 ml-2"
                        onMouseDown={() => handleStartResize('rate')}
                      />
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700" style={{ width: columnWidths.tax }}>
                      Tax
                      <div
                        className="inline-block w-1 h-full cursor-col-resize hover:bg-gray-400 ml-2"
                        onMouseDown={() => handleStartResize('tax')}
                      />
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700" style={{ width: columnWidths.amount }}>
                      Amount
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4">
                        <div className="relative" ref={el => { itemDropdownRefs.current[item.id] = el; }}>
                          <Input
                            value={item.item}
                            onChange={(e) => {
                              updateLineItem(item.id, 'item', e.target.value)
                              setActiveItemDropdowns(prev => ({ ...prev, [item.id]: true }))
                              // Update position on change as well
                              const inputEl = e.target
                              if (inputEl) {
                                const rect = inputEl.getBoundingClientRect()
                                setDropdownPosition({
                                  top: rect.bottom,
                                  left: rect.left,
                                  width: rect.width
                                })
                              }
                            }}
                            onFocus={() => {
                              // Calculate position for fixed dropdown
                              const inputEl = itemDropdownRefs.current[item.id]?.querySelector('input')
                              if (inputEl) {
                                const rect = inputEl.getBoundingClientRect()
                                setDropdownPosition({
                                  top: rect.bottom,
                                  left: rect.left,
                                  width: rect.width
                                })
                              }
                              setActiveItemDropdowns(prev => ({ ...prev, [item.id]: true }))
                            }}
                            placeholder="Item code..."
                            className="w-full text-sm"
                          />
                          {activeItemDropdowns[item.id] && (
                            <div 
                              className="fixed z-[9999] w-72 bg-white border-2 border-gray-300 rounded-md shadow-2xl overflow-auto" 
                              style={{ 
                                minWidth: '300px',
                                maxHeight: '300px',
                                top: `${dropdownPosition?.top || 0}px`,
                                left: `${dropdownPosition?.left || 0}px`
                              }}
                            >
                              {getFilteredProducts(item.id).length > 0 ? (
                                getFilteredProducts(item.id).map(p => (
                                  <div
                                    key={p.id}
                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                    onClick={() => selectProduct(item.id, p)}
                                  >
                                    <div className="font-medium text-sm">{p.sku || p.name}</div>
                                    <div className="text-xs text-gray-600">{p.name}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Price: ${(p as any).default_price?.toFixed(2) || '0.00'}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-gray-600">No products found</div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          placeholder="Description..."
                          className="w-full text-sm"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <Input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateLineItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                          className={`w-full text-right text-sm ${
                            item.sales_order_line_id && item.so_qty_remaining && 
                            item.qty > (item.so_qty_remaining + (item.original_qty || 0))
                              ? 'border-red-300 bg-red-50' : ''
                          }`}
                          step="0.01"
                        />
                        {item.sales_order_line_id && item.so_qty_remaining && 
                         item.qty > (item.so_qty_remaining + (item.original_qty || 0)) && (
                          <div className="text-xs text-red-600 mt-1">
                            Exceeds available: {item.so_qty_remaining + (item.original_qty || 0)}
                          </div>
                        )}
                      </td>
                      {invoice.sales_order_id && (
                        <td className="py-2 px-4 text-center text-sm">
                          {item.sales_order_line_id ? (
                            <div className="space-y-1">
                              <div className="text-xs text-gray-600">
                                <span className="font-medium">{item.so_qty_invoiced || 0}</span> / 
                                <span className="font-medium">{item.so_qty_ordered}</span>
                              </div>
                              <div className="text-xs">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  item.so_fulfillment_status === 'complete' 
                                    ? 'bg-green-100 text-green-800' 
                                    : item.so_fulfillment_status === 'partial'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {item.so_qty_remaining ? `${item.so_qty_remaining} left` : 'Complete'}
                                </span>
                              </div>
                              {item.original_qty && (
                                <div className="text-xs text-blue-600">
                                  Original: {item.original_qty}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="py-2 px-4">
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full text-right text-sm"
                          step="0.01"
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={item.is_taxable || false}
                          onChange={(e) => updateLineItem(item.id, 'is_taxable', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-4 text-right font-medium">
                        ${item.amount.toFixed(2)}
                      </td>
                      <td className="py-2 px-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeLineItem(item.id)}
                          className="h-7 w-7 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Add Line Button */}
            <div className="p-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={addLineItem}
                className="text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Line
              </Button>
            </div>
          </div>

          {/* Footer Section */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column - Notes */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Memo (Internal)</label>
                  <Textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="Internal notes (not visible to customer)..."
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message to Customer</label>
                  <Textarea
                    value={customerMessage}
                    onChange={(e) => setCustomerMessage(e.target.value)}
                    placeholder="Message visible on invoice..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Right Column - Totals */}
              <div className="space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Tax ({defaultTaxRate}%):</span>
                  <span className="font-medium">${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-3 border-t text-lg font-semibold">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Audit Trail Section */}
            <div className="pt-4 border-t">
              <AuditInfo
                lastEditedBy={invoice.last_edited_by}
                lastEditedAt={invoice.last_edited_at}
                createdBy={invoice.created_by}
                createdAt={invoice.created_at}
                showCreated={true}
                className="flex flex-col gap-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      {newCustomerModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Quick Add Customer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <Input
                  value={newCustomerModal.name}
                  onChange={(e) => setNewCustomerModal(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Company name..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input
                  type="email"
                  value={newCustomerModal.email}
                  onChange={(e) => setNewCustomerModal(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Email address..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <Input
                  value={newCustomerModal.phone}
                  onChange={(e) => setNewCustomerModal(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone number..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <Textarea
                  value={newCustomerModal.address}
                  onChange={(e) => setNewCustomerModal(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Address..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setNewCustomerModal({ show: false, name: '', email: '', phone: '', address: '' })}
              >
                Cancel
              </Button>
              <Button onClick={saveNewCustomer} className="bg-blue-600 hover:bg-blue-700">
                Save Customer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">Invoice Preview</h3>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div dangerouslySetInnerHTML={{
                __html: `
                  <div style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h1>INVOICE</h1>
                    </div>
                    
                    ${invoice.sales_order_id && invoice.is_partial_invoice ? `
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin-bottom: 20px; border-radius: 5px;">
                      <strong>⚠️ PARTIAL INVOICE</strong> - This is invoice ${invoice.invoice_sequence || 1} from Sales Order
                    </div>
                    ` : ''}
                    
                    <div style="margin-bottom: 20px;">
                      <strong>${companySettings?.company_name || '[Your Company Name]'}</strong><br>
                      ${getBillingAddress().replace(/\n/g, '<br>')}
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                      <div>
                        <strong>Invoice #:</strong> ${invoiceNumber}<br>
                        <strong>Date:</strong> ${date}<br>
                        <strong>Due Date:</strong> ${dueDate}<br>
                        ${sourceSalesOrderId && documentRelationships.salesOrder ? `<strong>Sales Order #:</strong> ${documentRelationships.salesOrder.number}<br>` : ''}
                        ${(() => {
                const rep = salesReps.find(r => r.id === salesRepId)
                return rep ? `<strong>Sales Rep:</strong> ${rep.first_name} ${rep.last_name}<br>` : ''
              })()}
                      </div>
                      <div>
                        <strong>Status:</strong> ${status.charAt(0).toUpperCase() + status.slice(1)}<br>
                        <strong>Terms:</strong> ${terms}<br>
                        ${amountPaid > 0 ? `<strong>Amount Paid:</strong> $${amountPaid.toFixed(2)}<br>` : ''}
                        ${total - amountPaid > 0 ? `<strong>Balance Due:</strong> $${(total - amountPaid).toFixed(2)}` : ''}
                      </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                      <div style="width: 48%;">
                        <strong>Bill To:</strong><br>
                        ${billTo.replace(/\n/g, '<br>') || customer + '<br>[Address]'}
                      </div>
                      <div style="width: 48%;">
                        <strong>Ship To:</strong><br>
                        ${shipTo.replace(/\n/g, '<br>') || billTo.replace(/\n/g, '<br>') || customer + '<br>[Address]'}
                      </div>
                    </div>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                      <thead>
                        <tr>
                          <th style="background-color: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item/SKU</th>
                          <th style="background-color: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Description</th>
                          <th style="background-color: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Qty</th>
                          <th style="background-color: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Rate</th>
                          <th style="background-color: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${lineItems.filter(item => item.description).map(item => `
                          <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.item}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.qty}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.rate.toFixed(2)}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.amount.toFixed(2)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                    
                    <div style="text-align: right; margin-top: 20px;">
                      <table style="width: 300px; margin-left: auto;">
                        <tr>
                          <td>Subtotal:</td>
                          <td style="text-align: right;">$${subtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td>Tax (${defaultTaxRate}%):</td>
                          <td style="text-align: right;">$${taxAmount.toFixed(2)}</td>
                        </tr>
                        <tr style="font-weight: bold; background-color: #f9f9f9;">
                          <td><strong>Total:</strong></td>
                          <td style="text-align: right;"><strong>$${total.toFixed(2)}</strong></td>
                        </tr>
                        ${amountPaid > 0 ? `
                        <tr>
                          <td>Amount Paid:</td>
                          <td style="text-align: right;">($${amountPaid.toFixed(2)})</td>
                        </tr>
                        <tr style="font-weight: bold; background-color: #f9f9f9;">
                          <td><strong>Balance Due:</strong></td>
                          <td style="text-align: right;"><strong>$${(total - amountPaid).toFixed(2)}</strong></td>
                        </tr>
                        ` : ''}
                      </table>
                    </div>
                    
                    ${customerMessage ? `<div style="margin-top: 30px;"><strong>Message:</strong><br>${customerMessage.replace(/\n/g, '<br>')}</div>` : ''}
                  </div>
                `
              }} />
            </div>
            <div className="border-t p-4 flex justify-end gap-2">
              <Button variant="outline" onClick={handlePrint}>
                <FileText className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" onClick={handleEmail}>
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
              <Button onClick={() => setShowPreview(false)}>
                Close
              </Button>
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
                      {lineItems.filter(item => item.description?.trim()).map((item, index) => {
                        const inventoryItem = inventory.find(inv => inv.product_id === item.product_id)
                        const product = products.find(p => p.id === item.product_id)
                        const costEach = (inventoryItem as any)?.weighted_average_cost ||
                                         (inventoryItem as any)?.last_cost ||
                                         (inventoryItem as any)?.purchase_price ||
                                         (product as any)?.cost || 0
                        const totalItemCost = costEach * Number(item.qty || 0)
                        const totalItemRevenue = Number(item.amount || 0)
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
                            <td className="px-4 py-2 text-sm text-right">${Number(item.rate || 0).toFixed(2)}</td>
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
                    </tbody>
                  </table>
                </div>
                
                {profitMargin < 20 && subtotal > 0 && (
                  <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded text-sm text-red-800">
                    <strong>Low Margin Alert:</strong> This invoice has a profit margin of {profitMargin.toFixed(1)}%, 
                    which may be below your target. Consider reviewing pricing or costs.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <TemplateEditor
          isOpen={showTemplateEditor}
          onClose={() => setShowTemplateEditor(false)}
          templateType="invoice"
          currentTemplateId={selectedTemplateId}
        />
      )}
    </div>
  )
}