'use client'

// ⚠️ CRITICAL: WHEN EDITING THIS FILE, ALSO UPDATE THE CORRESPONDING CREATE VERSION
// Components: edit-purchase-order-quickbooks-style.tsx ↔ create-purchase-order-quickbooks-style.tsx  
// These components share similar functionality and BOTH must be maintained in sync

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDefaultTaxRate } from '@/hooks/useDefaultTaxRate'
import { useCompanySettings } from '@/hooks/useCompanySettings'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import { useAuth } from '@/components/providers/auth-provider'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { executeSaveOperation } from '@/lib/error-handling'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { X, Save, Plus, Trash2, ShoppingCart, FileText, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, Printer, Mail, Copy, Settings2, ArrowLeft, ArrowRight, Search, Eye, Calculator, Receipt, FileCheck, Truck, Package } from 'lucide-react'
import ContextMenu from '@/components/ui/context-menu'
import TemplateEditor from '@/components/templates/template-editor'
import DocumentFlowTracker, { DocumentRelationship } from '@/components/ui/document-flow-tracker'
import AuditInfo from '@/components/ui/audit-info'

type Vendor = Database['public']['Tables']['vendors']['Row']
type Product = Database['public']['Tables']['products']['Row']
type PurchaseOrder = any
type POTemplate = any
type PurchaseOrderLine = any

interface InventoryItem {
  id: string
  product_id: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  purchase_price: number | null
  last_cost: number | null
  products: Product
}

interface LineItem {
  id: string
  item: string
  description: string
  qty: number
  rate: number
  amount: number
  product_id?: string
  unit_of_measure: string
  is_taxable?: boolean
}

interface NewVendorModal {
  show: boolean
  company_name: string
  contact_name: string
  email: string
  phone: string
  address: string
}

interface EditPurchaseOrderQuickBooksStyleProps {
  purchaseOrder: PurchaseOrder
  onSave: (purchaseOrder: PurchaseOrder) => void
  onCancel: () => void
  onDelete?: (purchaseOrder: PurchaseOrder) => void
  purchaseOrders?: PurchaseOrder[]
  onNavigate?: (purchaseOrder: PurchaseOrder) => void
}

export default function EditPurchaseOrderQuickBooksStyle({ 
  purchaseOrder, 
  onSave, 
  onCancel, 
  onDelete, 
  purchaseOrders = [], 
  onNavigate 
}: EditPurchaseOrderQuickBooksStyleProps) {
  const router = useRouter()
  
  // Data
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [templates, setTemplates] = useState<POTemplate[]>([])
  const [purchaseOrderLines, setPurchaseOrderLines] = useState<PurchaseOrderLine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Header fields
  const [vendor, setVendor] = useState(purchaseOrder.vendors?.company_name || '')
  const [vendorId, setVendorId] = useState(purchaseOrder.vendor_id)
  const [vendorDropdown, setVendorDropdown] = useState(false)
  const [poNumber, setPONumber] = useState(purchaseOrder.po_number)
  const [date, setDate] = useState(purchaseOrder.order_date)
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(purchaseOrder.expected_delivery_date || '')
  const [vendorReference, setVendorReference] = useState(purchaseOrder.vendor_reference || '')
  const [terms, setTerms] = useState(purchaseOrder.terms_and_conditions || '')
  const [status, setStatus] = useState(purchaseOrder.status)

  // Address fields
  const [shipToAddress, setShipToAddress] = useState(purchaseOrder.ship_to_address || '')
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
  const [subtotal, setSubtotal] = useState(purchaseOrder.subtotal || 0)
  const [taxAmount, setTaxAmount] = useState(purchaseOrder.tax_amount || 0)
  const [total, setTotal] = useState(purchaseOrder.total_amount || 0)
  
  // Get backend-controlled tax rate from settings
  const { defaultTaxRate } = useDefaultTaxRate()
  
  // Get company settings for addresses
  const { companySettings, getBillingAddress, getShippingAddress } = useCompanySettings()
  
  // Get current authenticated user
  const { user } = useAuth()

  // Notes
  const [memo, setMemo] = useState(purchaseOrder.internal_notes || '')
  const [vendorMessage, setVendorMessage] = useState(purchaseOrder.vendor_notes || '')

  // New vendor modal and search
  const [vendorSearch, setVendorSearch] = useState('')
  const [newVendorModal, setNewVendorModal] = useState<NewVendorModal>({
    show: false,
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: ''
  })

  // UI state
  const [showPreview, setShowPreview] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  
  // Add browser-level unsaved changes warning
  useUnsavedChangesWarning(hasUnsavedChanges, 'You have unsaved changes to this purchase order. Are you sure you want to leave?')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [isDuplicating, setIsDuplicating] = useState(false)

  // Document relationships for flow tracking
  const [documentRelationships, setDocumentRelationships] = useState<DocumentRelationship>({})

  // Navigation
  const currentIndex = purchaseOrders.findIndex(po => po.id === purchaseOrder.id)
  const canNavigatePrevious = currentIndex > 0
  const canNavigateNext = currentIndex < purchaseOrders.length - 1

  // Refs for click outside handling
  const vendorDropdownRef = useRef<HTMLDivElement>(null)
  const itemDropdownRefs = useRef<{[key: string]: HTMLDivElement | null}>({})

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vendorDropdownRef.current && !vendorDropdownRef.current.contains(event.target as Node)) {
        setVendorDropdown(false)
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
  }, [vendorDropdown, activeItemDropdowns])

  useEffect(() => {
    fetchData()
    fetchPurchaseOrderLines()
    loadDocumentRelationships()
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
  }, [purchaseOrder.id])

  // Refresh document flow when status changes
  useEffect(() => {
    loadDocumentRelationships()
  }, [status]) // Refresh when status changes

  // Sync Ship To with company address when "Ship to our company" is checked
  useEffect(() => {
    if (shipSameAsBill && companySettings) {
      setShipToAddress(getShippingAddress())
    }
  }, [shipSameAsBill, companySettings, getShippingAddress])

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

    setSubtotal(newSubtotal)
    setTaxAmount(newTaxAmount)
    setTotal(newTotal)

    setHasUnsavedChanges(true)
  }, [lineItems, defaultTaxRate])

  // Load purchase order lines
  const fetchPurchaseOrderLines = async () => {
    try {
      console.log('Fetching PO lines for PO ID:', purchaseOrder.id)
      
      const { data: lines, error } = await supabase
        .from('purchase_order_lines')
        .select('*')
        .eq('purchase_order_id', purchaseOrder.id)
        .order('line_number')

      console.log('PO lines query result:', { lines, error })

      if (error) throw error

      const items: LineItem[] = lines.map(line => ({
        id: line.id,
        item: line.item_code || '',
        description: line.description || '',
        qty: line.quantity || 1,
        rate: line.unit_price || 0,
        amount: line.line_total || 0,
        unit_of_measure: line.unit_of_measure || 'ea',
        product_id: line.product_id || undefined,
        is_taxable: line.is_taxable ?? false // Use database value, fallback to false
      }))

      setLineItems(items.length > 0 ? items : [
        { id: '1', item: '', description: '', qty: 1, rate: 0, amount: 0, unit_of_measure: 'ea', is_taxable: false }
      ])
    } catch (error) {
      console.error('Error fetching purchase order lines:', error)
      // Set default empty line item on error
      setLineItems([
        { id: '1', item: '', description: '', qty: 1, rate: 0, amount: 0, unit_of_measure: 'ea', is_taxable: false }
      ])
    }
  }

  // Load document relationships
  const loadDocumentRelationships = async () => {
    try {
      const relationships: DocumentRelationship = {
        purchaseOrder: {
          id: purchaseOrder.id,
          number: purchaseOrder.po_number || '',
          status: purchaseOrder.status,
          date: purchaseOrder.order_date,
          amount: purchaseOrder.total_amount || 0
        }
      }

      // Check for related sales order
      if (purchaseOrder.source_sales_order_id) {
        const { data: salesOrder, error: soError } = await supabase
          .from('sales_orders')
          .select('*')
          .eq('id', purchaseOrder.source_sales_order_id)
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
            } else if (estError && estError.code === 'PGRST116') {
              // Estimate was deleted, clear the reference in the SO
              console.log('Referenced estimate no longer exists, clearing SO reference')
              await supabase
                .from('sales_orders')
                .update({ estimate_id: null })
                .eq('id', salesOrder.id)
            }
          } else if (salesOrder.estimate_number) {
            // Fallback: try to find estimate by number
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

          // Check for related invoice through the sales order
          // Multi-invoice model - check for invoices by sales_order_id
          const { data: invoices, error: invoiceError } = await supabase
            .from('invoices')
            .select('*')
            .eq('sales_order_id', salesOrder.id)
            .order('created_at', { ascending: false })
          
          if (!invoiceError && invoices && invoices.length > 0) {
            if (invoices.length === 1) {
              // Single invoice - use legacy format
              const invoice = invoices[0]
              relationships.invoice = {
                id: invoice.id,
                number: invoice.invoice_number,
                status: invoice.status || 'PENDING',
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
          
          // Legacy code (converted_to_invoice_id no longer exists):
          if (false) { // salesOrder.converted_to_invoice_id) {
            const { data: invoice, error: invError } = await supabase
              .from('invoices')
              .select('*')
              .eq('id', salesOrder.converted_to_invoice_id)
              .single()

            if (!invError && invoice) {
              relationships.invoice = {
                id: invoice.id,
                number: invoice.invoice_number,
                status: invoice.status,
                date: invoice.invoice_date,
                amount: invoice.total_amount || 0
              }
            } else if (invError && (invError as any).code === 'PGRST116') {
              // Invoice was deleted, clear the reference in the SO
              // Multi-invoice model - no need to clear SO reference since converted_to_invoice_id doesn't exist
              console.log('Referenced invoice no longer exists (multi-invoice model)')
            }
          }

          // Load ALL purchase orders related to this sales order (including siblings)
          const { data: allPurchaseOrders, error: allPoError } = await supabase
            .from('purchase_orders')
            .select('*')
            .eq('source_sales_order_id', salesOrder.id)
            .order('created_at', { ascending: true })

          if (!allPoError && allPurchaseOrders && allPurchaseOrders.length > 0) {
            // Support multiple POs per SO
            relationships.purchaseOrders = allPurchaseOrders.map(po => ({
              id: po.id,
              number: po.po_number,
              status: po.status,
              date: po.order_date,
              amount: po.total_amount || 0
            }))
            
            console.log(`Found ${allPurchaseOrders.length} total purchase order(s) for this SO`)
          }
        } else if (soError && soError.code === 'PGRST116') {
          // SO was deleted, clear the reference in the PO
          console.log('Referenced SO no longer exists, clearing PO reference')
          await supabase
            .from('purchase_orders')
            .update({ source_sales_order_id: null })
            .eq('id', purchaseOrder.id)
        }
      }

      // Also check for direct invoice reference (when PO is directly included in invoice)
      if (purchaseOrder.invoice_id && !relationships.invoice) {
        const { data: directInvoice, error: directInvError } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', purchaseOrder.invoice_id)
          .single()

        if (!directInvError && directInvoice) {
          relationships.invoice = {
            id: directInvoice.id,
            number: directInvoice.invoice_number,
            status: directInvoice.status,
            date: directInvoice.invoice_date,
            amount: directInvoice.total_amount || 0
          }
        } else if (directInvError && directInvError.code === 'PGRST116') {
          // Invoice was deleted, clear the reference in the PO
          console.log('Referenced invoice no longer exists, clearing PO reference')
          await supabase
            .from('purchase_orders')
            .update({ invoice_id: null })
            .eq('id', purchaseOrder.id)
        }
      }

      setDocumentRelationships(relationships)
    } catch (error) {
      console.error('Error loading document relationships:', error)
    }
  }

  const fetchData = async () => {
    try {
      const [vendorsRes, productsRes, inventoryRes, templatesRes] = await Promise.all([
        supabase.from('vendors').select('*').order('company_name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('inventory').select('*, products(*)').order('products(name)'),
        supabase.from('po_templates').select('*').order('name')
      ])

      if (vendorsRes.data) setVendors(vendorsRes.data)
      if (productsRes.data) setProducts(productsRes.data)
      if (inventoryRes.data) setInventory(inventoryRes.data)
      if (templatesRes.data) setTemplates(templatesRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Navigation handlers
  const handlePrevious = () => {
    if (hasUnsavedChanges) {
      const shouldLeave = window.confirm('You have unsaved changes to this purchase order. Are you sure you want to leave?')
      if (!shouldLeave) {
        return
      }
    }
    if (canNavigatePrevious && onNavigate) {
      onNavigate(purchaseOrders[currentIndex - 1])
    }
  }

  const handleNext = () => {
    if (hasUnsavedChanges) {
      const shouldLeave = window.confirm('You have unsaved changes to this purchase order. Are you sure you want to leave?')
      if (!shouldLeave) {
        return
      }
    }
    if (canNavigateNext && onNavigate) {
      onNavigate(purchaseOrders[currentIndex + 1])
    }
  }

  // Update line item amount when qty or rate changes
  const updateLineItemAmount = (id: string, qty: number, rate: number) => {
    const amount = qty * rate
    setLineItems(prev => prev.map(item => 
      item.id === id ? { ...item, qty, rate, amount } : item
    ))
  }

  // Add new line item
  const addLineItem = () => {
    const newId = String(Math.max(...lineItems.map(item => parseInt(item.id) || 0)) + 1)
    const newLineItem: LineItem = {
      id: newId,
      item: '',
      description: '',
      qty: 1,
      rate: 0,
      amount: 0,
      unit_of_measure: 'ea',
      is_taxable: false
    }
    setLineItems(prev => [...prev, newLineItem])
  }

  // Remove line item
  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(item => item.id !== id))
    }
  }

  // Handle product selection
  const handleProductSelect = (lineId: string, inventoryItem: InventoryItem) => {
    const product = inventoryItem.products
    const purchasePrice = (inventoryItem as any).last_cost || (inventoryItem as any).purchase_price || (product as any).default_purchase_price || 0
    console.log('Product selected:', { 
      sku: product.sku, 
      purchasePrice, 
      lastCost: inventoryItem.last_cost,
      inventoryPrice: inventoryItem.purchase_price,
      defaultPrice: (product as any).default_purchase_price 
    })
    
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        const defaultQty = item.qty || 1
        const lineAmount = defaultQty * purchasePrice
        const updatedItem = {
          ...item,
          item: product.sku,
          description: product.name,
          product_id: product.id,
          unit_of_measure: product.unit_of_measure || 'ea',
          qty: defaultQty,
          rate: purchasePrice,
          amount: lineAmount,
          is_taxable: false // POs are typically tax-exempt
        }
        console.log('Updated line item:', updatedItem)
        return updatedItem
      }
      return item
    }))
    setActiveItemDropdowns(prev => ({ ...prev, [lineId]: false }))
  }

  // Handle vendor selection
  const handleVendorSelect = (selectedVendor: Vendor) => {
    setVendor((selectedVendor as any).company_name || selectedVendor.name)
    setVendorId(selectedVendor.id)
    setVendorDropdown(false)
    setVendorSearch('')
    setHasUnsavedChanges(true)
    
    // Set default ship to address from company settings if not already set
    if (!shipToAddress) {
      const defaultShipTo = getShippingAddress()
      setShipToAddress(defaultShipTo)
    }

    // Set payment terms if available
    if (selectedVendor.payment_terms) {
      setTerms(selectedVendor.payment_terms)
    }
  }

  const handleQuickAddVendor = () => {
    setNewVendorModal({
      show: true,
      company_name: vendorSearch,
      contact_name: '',
      email: '',
      phone: '',
      address: ''
    })
  }

  const saveNewVendor = async () => {
    console.log('=== QUICK ADD VENDOR DEBUG ===');
    console.log('Modal data:', newVendorModal);
    console.log('Current user:', user);
    
    try {
      const vendorData = {
        company_name: newVendorModal.company_name,
        contact_name: newVendorModal.contact_name || null,
        email: newVendorModal.email || null,
        phone: newVendorModal.phone || null,
        address_line_1: newVendorModal.address || null,
        payment_terms: 'NET30',  // Fixed: uppercase to match database constraint
        vendor_type: 'SUPPLIER' as const,
        is_active: true,
        last_edited_by: user?.id || null
      }

      console.log('Vendor data to save:', vendorData);
      
      const { data, error } = await supabase
        .from('vendors')
        .insert([vendorData])
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Vendor saved successfully:', data);

      // Update vendors list and select the new vendor
      setVendors(prev => [...prev, data])
      setVendor(data.company_name)
      setVendorId(data.id)
      setVendorDropdown(false)
      setVendorSearch('')
      setNewVendorModal({ show: false, company_name: '', contact_name: '', email: '', phone: '', address: '' })
      
      alert('Vendor added successfully!')
    } catch (error: any) {
      console.error('Error saving vendor:', error);
      alert(`Failed to save vendor: ${error.message || 'Unknown error'}`);
    }
  }

  // Filter vendors based on search
  const getFilteredVendors = () => {
    if (!vendorSearch) return vendors
    return vendors.filter(v => 
      ((v as any).company_name || v.name).toLowerCase().includes(vendorSearch.toLowerCase()) ||
      ((v as any).contact_name && (v as any).contact_name.toLowerCase().includes(vendorSearch.toLowerCase()))
    )
  }

  // Handle save
  const handleSave = async () => {
    if (!vendorId) {
      alert('Please select a vendor')
      return
    }

    setIsSaving(true)
    
    // Prepare validation data for pre-save validation
    const validationData = {
      vendor_id: vendorId,
      order_date: date,
      po_number: poNumber,
      line_items: lineItems.filter(item => item.description.trim())
    }

    const saveResult = await executeSaveOperation(
      'UPDATE_PURCHASE_ORDER',
      'purchase_order',
      purchaseOrder.id,
      async () => {
        // Update the purchase order
        const { data: updatedPurchaseOrder, error } = await supabase
          .from('purchase_orders')
          .update({
            po_number: poNumber,
            vendor_id: vendorId,
            sales_rep_id: null, // POs don't use sales reps
            order_date: date,
            expected_delivery_date: expectedDeliveryDate || null,
            vendor_reference: vendorReference,
            status,
            subtotal,
            tax_rate: defaultTaxRate,
            tax_amount: taxAmount,
            total_amount: total,
            internal_notes: memo || null,
            vendor_notes: vendorMessage || null,
            terms_and_conditions: terms || null,
            ship_to_address: shipToAddress || null,
            source_sales_order_id: purchaseOrder.source_sales_order_id || null,
            last_edited_by: user?.id || null
          })
          .eq('id', purchaseOrder.id)
          .select(`
            *,
            vendors (company_name, contact_name)
          `)
          .single()

        if (error) throw error

        // Delete existing line items and recreate them
        await supabase
          .from('purchase_order_lines')
          .delete()
          .eq('purchase_order_id', purchaseOrder.id)

        // Create new line items
        const purchaseOrderLines = lineItems
          .filter(item => item.description.trim())
          .map((item, index) => ({
            purchase_order_id: purchaseOrder.id,
            line_number: index + 1,
            product_id: item.product_id,
            item_code: item.item,
            description: item.description,
            quantity: item.qty,
            unit_price: item.rate,
            unit_of_measure: item.unit_of_measure,
            line_total: item.amount,
            is_taxable: item.is_taxable || false,
            tax_code: item.is_taxable ? 'TAX' : 'NON',
            tax_rate: item.is_taxable ? defaultTaxRate : 0,
            tax_amount: item.is_taxable ? (item.amount * defaultTaxRate / 100) : 0
          }))

        if (purchaseOrderLines.length > 0) {
          const { error: linesError } = await supabase
            .from('purchase_order_lines')
            .insert(purchaseOrderLines)

          if (linesError) throw linesError
        }

        return updatedPurchaseOrder
      },
      validationData
    )
    
    setIsSaving(false)
    
    if (saveResult.success && saveResult.data) {
      setHasUnsavedChanges(false)
      onSave(saveResult.data)
    } else {
      // Error is already logged by executeSaveOperation
      alert(saveResult.error?.userMessage || 'An unexpected error occurred while saving the purchase order.')
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete purchase order ${poNumber}?`)) {
      return
    }

    try {
      console.log('Attempting to delete purchase order:', purchaseOrder.id, poNumber)
      
      // First, clear any sales order references to this PO to avoid foreign key constraint
      if (purchaseOrder.source_sales_order_id) {
        console.log('Clearing sales order reference to this PO')
        const { error: soError } = await supabase
          .from('sales_orders')
          .update({ converted_to_purchase_order_id: null })
          .eq('converted_to_purchase_order_id', purchaseOrder.id)
        
        if (soError) {
          console.error('Error clearing sales order reference:', soError)
          // Continue with deletion even if this fails
        } else {
          console.log('Cleared sales order reference to PO')
        }
      }

      // Delete the purchase order (lines will cascade)
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', purchaseOrder.id)

      if (error) throw error

      console.log('Purchase order deleted successfully')
      if (onDelete) onDelete(purchaseOrder)
    } catch (error) {
      console.error('Error deleting purchase order:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      alert(`Error deleting purchase order: ${(error as any).message || 'Unknown error'}`)
    }
  }

  // Handle duplicate
  const handleDuplicate = async () => {
    setIsDuplicating(true)
    try {
      // Generate new PO number
      const { data: existingPOs, error } = await supabase
        .from('purchase_orders')
        .select('po_number')
        .order('po_number', { ascending: false })
        .limit(1)

      let lastNum = 0
      if (existingPOs && existingPOs.length > 0 && existingPOs[0].po_number) {
        const lastPO = existingPOs[0].po_number
        if (lastPO.match(/^PO-\d{6}$/)) {
          lastNum = parseInt(lastPO.split('-')[1])
        }
      }

      const newPONumber = `PO-${String(lastNum + 1).padStart(6, '0')}`

      const duplicateData = {
        po_number: newPONumber,
        vendor_id: purchaseOrder.vendor_id,
        status: 'PENDING' as const,
        order_date: new Date().toISOString().split('T')[0],
        subtotal: subtotal || 0,
        tax_rate: defaultTaxRate,
        tax_amount: taxAmount || 0,
        total_amount: total || 0,
        // Clear doc flow relationships for the duplicate
        source_sales_order_id: null
      }

      const { data: newPurchaseOrder, error: insertError } = await supabase
        .from('purchase_orders')
        .insert(duplicateData)
        .select(`
          *,
          vendors (company_name, contact_name)
        `)
        .single()

      if (insertError) throw insertError

      // Also copy line items
      const purchaseOrderLines = lineItems
        .filter(item => item.description.trim())
        .map((item, index) => ({
          purchase_order_id: newPurchaseOrder.id,
          line_number: index + 1,
          product_id: item.product_id,
          item_code: item.item,
          description: item.description,
          quantity: item.qty,
          unit_price: item.rate,
          unit_of_measure: item.unit_of_measure,
          line_total: item.amount,
          tax_code: item.is_taxable ? 'TAX' : 'NON',
          tax_rate: item.is_taxable ? defaultTaxRate : 0,
          tax_amount: item.is_taxable ? (item.amount * defaultTaxRate / 100) : 0
        }))

      if (purchaseOrderLines.length > 0) {
        await supabase
          .from('purchase_order_lines')
          .insert(purchaseOrderLines)
      }

      // Show success message
      alert(`Purchase Order duplicated successfully with number: ${newPONumber}!\n\nNow opening the duplicate for editing...`)
      
      // Navigate to the duplicate
      console.log('Dispatching openPurchaseOrderForEdit event with:', newPurchaseOrder)
      const event = new CustomEvent('openPurchaseOrderForEdit', {
        detail: { purchaseOrder: newPurchaseOrder }
      })
      window.dispatchEvent(event)
      
      // Small delay to ensure the event is processed
      setTimeout(() => {
        console.log('Event dispatched, navigation should have occurred')
      }, 100)
    } catch (error) {
      console.error('Error duplicating purchase order:', error)
      alert('Error duplicating purchase order. Please try again.')
    } finally {
      setIsDuplicating(false)
    }
  }

  // PDF Generation function
  const generatePDF = async (forDownload = false) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    const poHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order ${poNumber}</title>
        <style>
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .company { font-size: 24px; font-weight: bold; }
          .po-title { font-size: 20px; margin-top: 10px; color: #0066cc; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .address-box { border: 1px solid #ddd; padding: 15px; background-color: #f9f9f9; }
          .address-label { font-weight: bold; color: #0066cc; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background-color: #f0f0f0; padding: 10px; text-align: left; border: 1px solid #ddd; font-weight: bold; }
          td { padding: 10px; border: 1px solid #ddd; }
          .totals { margin-left: auto; width: 300px; }
          .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
          .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; }
          .details-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
          .detail-item { background-color: #f9f9f9; padding: 10px; border-radius: 4px; }
          .detail-label { font-size: 12px; color: #666; margin-bottom: 5px; }
          .detail-value { font-weight: bold; }
        </style>
        ${forDownload ? `
        <script>
          window.onload = function() {
            document.title = 'PO_${poNumber}.html';
            var blob = new Blob([document.documentElement.outerHTML], {type: 'text/html'});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'PO_${poNumber}.html';
            a.click();
          }
        </script>` : ''}
      </head>
      <body>
        <div class="header">
          <div class="company">${companySettings?.company_name || 'Your Company'}</div>
          <div class="po-title">PURCHASE ORDER</div>
        </div>
        
        <div class="details-grid">
          <div class="detail-item">
            <div class="detail-label">PO Number</div>
            <div class="detail-value">${poNumber}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Date</div>
            <div class="detail-value">${date}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Expected Delivery</div>
            <div class="detail-value">${expectedDeliveryDate || 'TBD'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Status</div>
            <div class="detail-value">${status}</div>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="address-box">
            <div class="address-label">Vendor</div>
            <div><strong>${vendor}</strong></div>
            ${(vendors.find(v => v.id === vendorId) as any)?.contact_name ? `<div>Contact: ${(vendors.find(v => v.id === vendorId) as any)?.contact_name}</div>` : ''}
          </div>
          
          <div class="address-box">
            <div class="address-label">Ship To</div>
            <div>${shipToAddress.replace(/\\n/g, '<br>')}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Tax</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems.filter(item => item.description.trim()).map(item => `
              <tr>
                <td>${item.item}</td>
                <td>${item.description}</td>
                <td>${item.qty}</td>
                <td>$${item.rate.toFixed(2)}</td>
                <td>${item.is_taxable ? 'Tax' : '-'}</td>
                <td>$${item.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          ${taxAmount > 0 ? `
          <div class="total-row">
            <span>Tax (${defaultTaxRate}%):</span>
            <span>$${taxAmount.toFixed(2)}</span>
          </div>` : ''}
          <div class="total-row grand-total">
            <span>Total:</span>
            <span>$${total.toFixed(2)}</span>
          </div>
        </div>
        
        ${memo ? `
        <div style="margin-top: 30px;">
          <strong>Internal Notes:</strong><br>
          ${memo.replace(/\\n/g, '<br>')}
        </div>` : ''}
        
        ${vendorMessage ? `
        <div style="margin-top: 20px;">
          <strong>Message to Vendor:</strong><br>
          ${vendorMessage.replace(/\\n/g, '<br>')}
        </div>` : ''}
        
        ${terms ? `
        <div style="margin-top: 20px;">
          <strong>Terms & Conditions:</strong><br>
          ${terms.replace(/\\n/g, '<br>')}
        </div>` : ''}
      </body>
      </html>
    `
    
    printWindow.document.open()
    printWindow.document.write(poHTML)
    printWindow.document.close()
    
    return printWindow
  }

  // Print functionality
  const handlePrint = async () => {
    const printWindow = await generatePDF()
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  // Email functionality
  const handleEmail = async () => {
    // Generate downloadable HTML
    const printWindow = await generatePDF(true)
    if (!printWindow) {
      alert('Failed to generate PO file. Please try again.')
      return
    }
    
    // Small delay to ensure download starts, then open email
    setTimeout(() => {
      const subject = `Purchase Order ${poNumber} for ${vendor}`
      const body = `Dear ${vendor},

Please find attached Purchase Order ${poNumber}.

PO Summary:
- PO Number: ${poNumber}
- Date: ${date}
- Expected Delivery: ${expectedDeliveryDate || 'TBD'}
- Total: $${total.toFixed(2)}
- Terms: ${terms || 'Standard'}

${vendorMessage ? `Additional Message: ${vendorMessage}` : ''}

Thank you for your service.

Best regards,
${companySettings?.company_name || 'Your Company'}`
      
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }, 2000)
  }

  const handleConfirm = async () => {
    setStatus('CONFIRMED')
    // Will trigger save via useEffect
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const shouldLeave = window.confirm('You have unsaved changes to this purchase order. Are you sure you want to leave?')
      if (!shouldLeave) {
        return
      }
    }
    onCancel()
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
      {/* Header Bar - Matching Sales Orders Structure */}
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
                title="Navigate to previous purchase order"
              >
                <ArrowLeft className={`w-4 h-4 ${canNavigatePrevious ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0" 
                disabled={!canNavigateNext}
                onClick={handleNext}
                title="Navigate to next purchase order"
              >
                <ArrowRight className={`w-4 h-4 ${canNavigateNext ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
            </div>

            {/* Title with unsaved indicator */}
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-gray-800">Edit Purchase Order</h1>
              {hasUnsavedChanges && (
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-xs">Unsaved</span>
                </div>
              )}
              <Badge className={`text-xs ${status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' : 
                status === 'RECEIVED' ? 'bg-green-100 text-green-800' : 
                'bg-gray-100 text-gray-800'}`}>
                {status.replace('_', ' ')}
              </Badge>
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
            {/* View Actions */}
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowPreview(true)}>
              <Eye className="w-3 h-3 mr-1" /> Preview
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
            {/* Order Actions based on status */}
            {status === 'PENDING' && (
              <>
                <Button size="sm" variant="outline" className="text-xs h-7 bg-green-50 hover:bg-green-100 text-green-700 border-green-200" onClick={handleConfirm}>
                  <CheckCircle className="w-3 h-3 mr-1" /> Confirm Order
                </Button>
                
                {/* Divider */}
                <div className="h-4 w-px bg-gray-300 mx-1" />
              </>
            )}
            
            {/* Receive Inventory Action for Confirmed/Partial Orders */}
            {(status === 'CONFIRMED' || status === 'PARTIAL') && (
              <>
                <Button size="sm" variant="outline" className="text-xs h-7 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200" onClick={() => router.push(`/inventory?receive=true&po=${purchaseOrder.id}`)}>
                  <Package className="w-3 h-3 mr-1" /> Receive Inventory
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
            currentDocument="purchaseOrder"
            currentDocumentId={purchaseOrder.id}
            onNavigate={(type, id) => {
              if (hasUnsavedChanges) {
                const shouldLeave = window.confirm('You have unsaved changes to this purchase order. Are you sure you want to leave?')
                if (!shouldLeave) {
                  return
                }
              }
              if (type === 'estimate') {
                window.location.href = `/estimates?open=${id}`
              } else if (type === 'salesOrder') {
                window.location.href = `/sales-orders?open=${id}`
              } else if (type === 'invoice') {
                window.location.href = `/invoices?open=${id}`
              } else if (type === 'purchaseOrder') {
                window.location.href = `/purchase-orders?open=${id}`
              }
            }}
          />
        </div>
      )}

      {/* Form Content */}
      <div className="flex-1 overflow-auto p-6 bg-white">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Purchase Order Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column - Vendor Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Vendor *</label>
                <div className="relative" ref={vendorDropdownRef}>
                  {!vendor ? (
                    <div>
                      <Input
                        value={vendorSearch}
                        onChange={(e) => {
                          setVendorSearch(e.target.value)
                          setVendorDropdown(e.target.value.length > 0)
                          setHasUnsavedChanges(true)
                        }}
                        placeholder="Search or type vendor name..."
                        onFocus={() => setVendorDropdown(true)}
                      />
                      {vendorDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          <div className="max-h-48 overflow-auto">
                            {getFilteredVendors().map((v) => (
                              <button
                                key={v.id}
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100"
                                onClick={() => handleVendorSelect(v)}
                              >
                                <div className="font-medium">{(v as any).company_name || v.name}</div>
                                {(v as any).contact_name && (
                                  <div className="text-sm text-gray-500">{(v as any).contact_name}</div>
                                )}
                              </button>
                            ))}
                            
                            {vendorSearch && !getFilteredVendors().find(v => ((v as any).company_name || v.name).toLowerCase() === vendorSearch.toLowerCase()) && (
                              <button
                                onClick={handleQuickAddVendor}
                                className="w-full px-3 py-2 text-left bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100"
                              >
                                <Plus className="w-3 h-3 inline mr-1" />
                                Quick Add: {vendorSearch}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left"
                      onClick={() => {
                        setVendor('')
                        setVendorId('')
                        setVendorSearch('')
                        setVendorDropdown(true)
                        setHasUnsavedChanges(true)
                      }}
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      {vendor}
                      <X className="w-4 h-4 ml-auto" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Order Date</label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value)
                      setHasUnsavedChanges(true)
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expected Delivery</label>
                  <Input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => {
                      setExpectedDeliveryDate(e.target.value)
                      setHasUnsavedChanges(true)
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Middle Column - PO Details */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">PO Number</label>
                <Input
                  value={poNumber}
                  onChange={(e) => {
                    setPONumber(e.target.value)
                    setHasUnsavedChanges(true)
                  }}
                  placeholder="PO-000001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value)
                    setHasUnsavedChanges(true)
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="RECEIVED">Received</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Right Column - Additional Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Vendor Reference</label>
                <Input
                  value={vendorReference}
                  onChange={(e) => {
                    setVendorReference(e.target.value)
                    setHasUnsavedChanges(true)
                  }}
                  placeholder="Enter vendor reference..."
                />
              </div>

            </div>
          </div>

          {/* Vendor and Ship To Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Vendor</label>
              <div className="bg-gray-50 border rounded-lg p-4 min-h-[144px]">
                {vendor ? (
                  <div className="text-sm text-gray-700">
                    <div className="font-semibold">{vendor}</div>
                    <div className="text-gray-500 mt-1">
                      {(vendors.find(v => v.id === vendorId) as any)?.contact_name && (
                        <div>Contact: {(vendors.find(v => v.id === vendorId) as any)?.contact_name}</div>
                      )}
                      {(vendors.find(v => v.id === vendorId) as any)?.contact_phone && (
                        <div>Phone: {(vendors.find(v => v.id === vendorId) as any)?.contact_phone}</div>
                      )}
                      {(vendors.find(v => v.id === vendorId) as any)?.contact_email && (
                        <div>Email: {(vendors.find(v => v.id === vendorId) as any)?.contact_email}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm">No vendor selected</div>
                )}
              </div>
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
                        setShipToAddress(getShippingAddress())
                      }
                      setHasUnsavedChanges(true)
                    }}
                    className="rounded"
                  />
                  Ship to our company
                </label>
              </div>
              <Textarea
                value={shipToAddress}
                onChange={(e) => {
                  setShipToAddress(e.target.value)
                  setHasUnsavedChanges(true)
                }}
                disabled={shipSameAsBill}
                placeholder="Receiving Location
123 Warehouse Drive
City, ST 12345
Attn: Receiving Dept"
                rows={6}
                className={`text-sm font-mono resize-y ${shipSameAsBill ? 'bg-gray-50' : ''}`}
              />
            </div>
          </div>

          {/* Line Items Section */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Line Items</h3>
              <Button onClick={addLineItem} size="sm" className="flex items-center gap-2">
                <Plus className="w-3 h-3" />
                Add Line
              </Button>
            </div>

            {/* Line Items Table */}
            <div className="border rounded-lg relative" style={{overflow: 'visible'}}>
              <table ref={tableRef} className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th style={{ width: columnWidths.item }} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase relative">
                      Item
                      <div 
                        className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-300 transition-colors"
                        onMouseDown={() => handleStartResize('item')}
                      />
                    </th>
                    <th style={{ width: columnWidths.description }} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase relative">
                      Description
                      <div 
                        className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-300 transition-colors"
                        onMouseDown={() => handleStartResize('description')}
                      />
                    </th>
                    <th style={{ width: columnWidths.qty }} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase relative">
                      Qty
                      <div 
                        className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-300 transition-colors"
                        onMouseDown={() => handleStartResize('qty')}
                      />
                    </th>
                    <th style={{ width: columnWidths.rate }} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase relative">
                      Rate
                      <div 
                        className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-300 transition-colors"
                        onMouseDown={() => handleStartResize('rate')}
                      />
                    </th>
                    <th style={{ width: columnWidths.tax }} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase relative">
                      Tax
                      <div 
                        className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-300 transition-colors"
                        onMouseDown={() => handleStartResize('tax')}
                      />
                    </th>
                    <th style={{ width: columnWidths.amount }} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td style={{ width: columnWidths.item, overflow: 'visible', position: 'relative' }} className="px-4 py-3">
                        <div className="relative" ref={el => { itemDropdownRefs.current[item.id] = el; }}>
                          <Input
                            value={item.item}
                            onChange={(e) => {
                              setLineItems(prev => prev.map(li => 
                                li.id === item.id ? { ...li, item: e.target.value } : li
                              ))
                              setHasUnsavedChanges(true)
                            }}
                            onFocus={() => setActiveItemDropdowns(prev => ({ ...prev, [item.id]: true }))}
                            placeholder="Item/SKU"
                            className="text-sm"
                          />
                          
                          {activeItemDropdowns[item.id] && inventory.length > 0 && (
                            <div className="absolute z-50 w-72 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto left-0">
                              {inventory
                                .filter(inv => 
                                  item.item === '' || 
                                  inv.products.sku.toLowerCase().includes(item.item.toLowerCase()) ||
                                  inv.products.name.toLowerCase().includes(item.item.toLowerCase())
                                )
                                .slice(0, 10)
                                .map((inv) => (
                                  <button
                                    key={inv.id}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100"
                                    onClick={() => handleProductSelect(item.id, inv)}
                                  >
                                    <div className="font-medium text-sm">{inv.products.sku}</div>
                                    <div className="text-xs text-gray-500">{inv.products.name}</div>
                                    <div className="text-xs text-gray-400">
                                      ${((inv as any).last_cost || (inv as any).purchase_price || (inv.products as any).default_purchase_price || 0).toFixed(2)} •
                                      {inv.quantity_available} available
                                    </div>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ width: columnWidths.description }} className="px-4 py-3">
                        <Input
                          value={item.description}
                          onChange={(e) => {
                            setLineItems(prev => prev.map(li => 
                              li.id === item.id ? { ...li, description: e.target.value } : li
                            ))
                            setHasUnsavedChanges(true)
                          }}
                          placeholder="Description"
                          className="text-sm"
                        />
                      </td>
                      <td style={{ width: columnWidths.qty }} className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.qty}
                          onChange={(e) => {
                            updateLineItemAmount(item.id, parseFloat(e.target.value) || 0, item.rate)
                            setHasUnsavedChanges(true)
                          }}
                          className="text-sm"
                        />
                      </td>
                      <td style={{ width: columnWidths.rate }} className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => {
                            updateLineItemAmount(item.id, item.qty, parseFloat(e.target.value) || 0)
                            setHasUnsavedChanges(true)
                          }}
                          className="text-sm"
                        />
                      </td>
                      <td style={{ width: columnWidths.tax }} className="px-4 py-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.is_taxable || false}
                            onChange={(e) => {
                              setLineItems(prev => prev.map(li => 
                                li.id === item.id ? { ...li, is_taxable: e.target.checked } : li
                              ))
                              setHasUnsavedChanges(true)
                            }}
                            className="rounded"
                          />
                          <span className="text-xs">Taxable</span>
                        </label>
                      </td>
                      <td style={{ width: columnWidths.amount }} className="px-4 py-3 text-right">
                        <span className="text-sm font-medium">${item.amount.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {lineItems.length > 1 && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => removeLineItem(item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
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
          </div>

          {/* Notes Section */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <label className="block text-sm font-medium mb-2">Internal Memo</label>
              <Textarea
                value={memo}
                onChange={(e) => {
                  setMemo(e.target.value)
                  setHasUnsavedChanges(true)
                }}
                placeholder="Internal notes (not visible to vendor)"
                rows={4}
              />
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <label className="block text-sm font-medium mb-2">Message to Vendor</label>
              <Textarea
                value={vendorMessage}
                onChange={(e) => {
                  setVendorMessage(e.target.value)
                  setHasUnsavedChanges(true)
                }}
                placeholder="Message visible to vendor"
                rows={4}
              />
            </div>
          </div>

          {/* Audit Trail Section */}
          <div className="pt-4 border-t">
            <AuditInfo
              lastEditedBy={purchaseOrder.last_edited_by}
              lastEditedAt={purchaseOrder.last_edited_at}
              createdBy={purchaseOrder.created_by}
              createdAt={purchaseOrder.created_at}
              showCreated={true}
              className="flex flex-col gap-1"
            />
          </div>

          {/* Delete Option */}
          {onDelete && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-red-800">Delete Purchase Order</h3>
                  <p className="text-sm text-red-600">This action cannot be undone.</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleDelete}
                  className="text-red-600 border-red-300 hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Vendor Modal */}
      {newVendorModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 space-y-4">
            <h3 className="text-lg font-semibold">Quick Add Vendor</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <Input
                value={newVendorModal.company_name}
                onChange={(e) => setNewVendorModal(prev => ({ ...prev, company_name: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <Input
                value={newVendorModal.contact_name}
                onChange={(e) => setNewVendorModal(prev => ({ ...prev, contact_name: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                value={newVendorModal.email}
                onChange={(e) => setNewVendorModal(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input
                value={newVendorModal.phone}
                onChange={(e) => setNewVendorModal(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <Textarea
                value={newVendorModal.address}
                onChange={(e) => setNewVendorModal(prev => ({ ...prev, address: e.target.value }))}
                rows={2}
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setNewVendorModal({ show: false, company_name: '', contact_name: '', email: '', phone: '', address: '' })}
              >
                Cancel
              </Button>
              <Button
                onClick={saveNewVendor}
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
          templateType="purchase_order"
          currentTemplateId={selectedTemplateId}
        />
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col">
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Purchase Order Preview</h2>
                <span className="text-sm text-gray-500">
                  {selectedTemplateId ? templates.find(t => t.id === selectedTemplateId)?.name || 'Custom Template' : 'Default Template'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-1" /> Print
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowPreview(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-white shadow-lg max-w-2xl mx-auto" style={{ minHeight: '11in', aspectRatio: '8.5/11' }}>
                {/* Document Header */}
                <div className="p-8 border-b">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">PURCHASE ORDER</h1>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><strong>PO #:</strong> {poNumber}</p>
                        <p><strong>Date:</strong> {new Date(date).toLocaleDateString()}</p>
                        {expectedDeliveryDate && (
                          <p><strong>Expected Delivery:</strong> {new Date(expectedDeliveryDate).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        <p className="font-semibold">Your Company Name</p>
                        <p>123 Business Street</p>
                        <p>City, ST 12345</p>
                        <p>(555) 123-4567</p>
                      </div>
                    </div>
                  </div>

                  {/* Vendor and Shipping */}
                  <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">Vendor:</h3>
                      <div className="text-sm text-gray-600">
                        <div className="font-semibold">{vendor || 'No vendor selected'}</div>
                        {vendorId && vendors.find(v => v.id === vendorId) && (
                          <div className="mt-1 space-y-1">
                            {((vendors.find(v => v.id === vendorId) as any)?.contact_name || vendors.find(v => v.id === vendorId)?.name) && (
                              <div>Contact: {(vendors.find(v => v.id === vendorId) as any)?.contact_name || vendors.find(v => v.id === vendorId)?.name}</div>
                            )}
                            {((vendors.find(v => v.id === vendorId) as any)?.phone || vendors.find(v => v.id === vendorId)?.contact_phone) && (
                              <div>Phone: {(vendors.find(v => v.id === vendorId) as any)?.phone || vendors.find(v => v.id === vendorId)?.contact_phone}</div>
                            )}
                            {((vendors.find(v => v.id === vendorId) as any)?.email || vendors.find(v => v.id === vendorId)?.contact_email) && (
                              <div>Email: {(vendors.find(v => v.id === vendorId) as any)?.email || vendors.find(v => v.id === vendorId)?.contact_email}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">Ship To:</h3>
                      <div className="text-sm text-gray-600 whitespace-pre-line">
                        {shipToAddress || 'Our Company Name\nReceiving Department\n123 Warehouse Drive\nCity, ST 12345'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div className="p-8">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Item</th>
                        <th className="text-left py-2">Description</th>
                        <th className="text-center py-2">Qty</th>
                        <th className="text-right py-2">Rate</th>
                        <th className="text-right py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems
                        .filter(item => item.description.trim())
                        .map((item, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2">{item.item}</td>
                            <td className="py-2">{item.description}</td>
                            <td className="py-2 text-center">{item.qty}</td>
                            <td className="py-2 text-right">${item.rate.toFixed(2)}</td>
                            <td className="py-2 text-right">${item.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="mt-6 flex justify-end">
                    <div className="w-48 space-y-1">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      {taxAmount > 0 && (
                        <div className="flex justify-between">
                          <span>Tax ({defaultTaxRate}%):</span>
                          <span>${taxAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Total:</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {vendorMessage && (
                    <div className="mt-8">
                      <h4 className="font-semibold mb-2">Notes:</h4>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{vendorMessage}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}