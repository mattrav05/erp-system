'use client'

// ⚠️ CRITICAL: WHEN EDITING THIS FILE, ALSO UPDATE THE CORRESPONDING EDIT VERSION
// Components: create-purchase-order-quickbooks-style.tsx ↔ edit-purchase-order-quickbooks-style.tsx
// These components share similar functionality and BOTH must be maintained in sync

import { useState, useEffect, useRef } from 'react'
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
import { X, Save, Plus, Trash2, ShoppingCart, FileText, ChevronLeft, ChevronRight, Printer, Mail, Copy, Settings2, Calculator, Receipt, ArrowLeft, ArrowRight, Search, FileCheck, AlertTriangle, Eye, Truck } from 'lucide-react'
import ContextMenu from '@/components/ui/context-menu'
import TemplateEditor from '@/components/templates/template-editor'
import DocumentFlowTracker, { DocumentRelationship } from '@/components/ui/document-flow-tracker'

type Vendor = Database['public']['Tables']['vendors']['Row']
type Product = Database['public']['Tables']['products']['Row']
type PurchaseOrder = any
type POTemplate = any

interface InventoryItem {
  id: string
  product_id: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  weighted_average_cost: number
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

interface CreatePurchaseOrderQuickBooksStyleProps {
  onSave: (purchaseOrder: PurchaseOrder) => void
  onCancel: () => void
  purchaseOrders?: PurchaseOrder[]
  onNavigate?: (purchaseOrder: PurchaseOrder) => void
  createFromSalesOrderId?: string | null
}

export default function CreatePurchaseOrderQuickBooksStyle({ 
  onSave, 
  onCancel, 
  purchaseOrders = [],
  onNavigate,
  createFromSalesOrderId 
}: CreatePurchaseOrderQuickBooksStyleProps) {
  // Data
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [templates, setTemplates] = useState<POTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Header fields
  const [vendor, setVendor] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [vendorDropdown, setVendorDropdown] = useState(false)
  const [poNumber, setPONumber] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [vendorReference, setVendorReference] = useState('')
  const [terms, setTerms] = useState('')

  // Address fields
  const [shipToAddress, setShipToAddress] = useState('')
  const [shipSameAsBill, setShipSameAsBill] = useState(true)

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', item: '', description: '', qty: 1, rate: 0, amount: 0, unit_of_measure: 'ea', is_taxable: false }
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
  
  // Get company settings for addresses
  const { companySettings, getBillingAddress, getShippingAddress } = useCompanySettings()
  
  // Get current authenticated user
  const { user } = useAuth()

  // Notes
  const [memo, setMemo] = useState('')
  const [vendorMessage, setVendorMessage] = useState('')

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

  // Document relationships for flow tracking
  const [documentRelationships, setDocumentRelationships] = useState<DocumentRelationship>({})
  const [sourceSalesOrderId, setSourceSalesOrderId] = useState<string | null>(null)

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
    generatePONumber()
    checkForSalesOrderConversion()
    
    // Set default ship-to address from company settings
    if (companySettings && shipSameAsBill) {
      setShipToAddress(getShippingAddress())
    }
  }, [companySettings])

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

  // Check for sales order conversion - use prop instead of URL param
  const checkForSalesOrderConversion = async () => {
    if (createFromSalesOrderId) {
      setSourceSalesOrderId(createFromSalesOrderId)
      await loadSalesOrderData(createFromSalesOrderId)
    }
  }

  // Load sales order data for conversion
  const loadSalesOrderData = async (salesOrderId: string) => {
    try {
      const { data: salesOrder, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers (name, email),
          sales_order_lines (*)
        `)
        .eq('id', salesOrderId)
        .single()

      if (error) throw error

      // Load document relationships
      const relationships: DocumentRelationship = {
        salesOrder: {
          id: salesOrder.id,
          number: salesOrder.so_number || '',
          status: salesOrder.status,
          date: salesOrder.order_date,
          amount: salesOrder.total_amount || 0
        }
      }

      // Check for related estimate using estimate_id field (fallback to estimate_number)
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

      // Check for related invoice - look for invoices that reference this sales order
      // Multi-invoice model - check for invoices by sales_order_id
      const { data: invoices, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('sales_order_id', salesOrder.id)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (!invoiceError && invoices && invoices.length > 0) {
        const invoice = invoices[0]
        relationships.invoice = {
          id: invoice.id,
          number: invoice.invoice_number,
          status: invoice.status || 'PENDING',
          date: invoice.invoice_date,
          amount: invoice.total_amount
        }
      }
      
      // Legacy code (converted_to_invoice_id no longer exists):
      if (false) { // salesOrder.converted_to_invoice_id) {
        // Direct reference via converted_to_invoice_id
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
        }
      } else {
        // Fallback: look for invoices that reference this sales order
        const { data: invoice, error: invError } = await supabase
          .from('invoices')
          .select('*')
          .eq('sales_order_id', salesOrder.id)
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

      // Check for existing purchase orders created from this sales order
      const { data: existingPOs, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('source_sales_order_id', salesOrder.id)
        .order('created_at', { ascending: true })
      
      if (!poError && existingPOs && existingPOs.length > 0) {
        relationships.purchaseOrders = existingPOs.map(po => ({
          id: po.id,
          number: po.po_number,
          status: po.status,
          date: po.order_date,
          amount: po.total_amount || 0
        }))
      }

      setDocumentRelationships(relationships)

      // Convert sales order line items to purchase order format with cost pricing
      if (salesOrder.sales_order_lines) {
        const convertedLines: LineItem[] = []
        
        for (const [index, line] of salesOrder.sales_order_lines.entries()) {
          let costPrice = 0
          
          // Look up cost price from inventory if product_id exists
          if (line.product_id) {
            console.log(`Looking up cost for product_id: ${line.product_id}`)
            
            // First try inventory table
            const { data: inventoryItem, error: invError } = await supabase
              .from('inventory')
              .select('weighted_average_cost, last_cost, product_id')
              .eq('product_id', line.product_id)
              .single()
            
            console.log('Inventory lookup result:', { inventoryItem, error: invError })
            
            if (!invError && inventoryItem) {
              // Use weighted_average_cost first, fallback to last_cost
              costPrice = inventoryItem.weighted_average_cost || inventoryItem.last_cost || 0
              console.log(`Found cost price from inventory: ${costPrice} (weighted_average_cost: ${inventoryItem.weighted_average_cost}, last_cost: ${inventoryItem.last_cost})`)
            } else {
              console.log(`No inventory found for product_id: ${line.product_id}, trying products table...`)
              
              // Fallback: try to get cost from products table 
              const { data: productItem, error: prodError } = await supabase
                .from('products')
                .select('cost, unit_cost, purchase_price')
                .eq('id', line.product_id)
                .single()
              
              console.log('Products lookup result:', { productItem, error: prodError })
              
              if (!prodError && productItem) {
                // Try various cost fields that might exist in products table
                costPrice = productItem.cost || productItem.unit_cost || productItem.purchase_price || 0
                console.log(`Found cost price from products: ${costPrice}`)
              } else {
                console.log(`No cost found in products table for product_id: ${line.product_id}`)
              }
            }
          } else {
            console.log('No product_id for line item:', line)
          }
          
          const qty = line.quantity || 1
          const amount = costPrice * qty
          
          const convertedLine = {
            id: String(index + 1),
            item: line.item_code || '',
            description: line.description || '',
            qty: qty,
            rate: costPrice,
            amount: amount,
            unit_of_measure: line.unit_of_measure || 'ea',
            product_id: line.product_id || undefined,
            is_taxable: false // POs are typically tax-exempt
          }
          
          console.log(`Converting SO line to PO line:`, {
            original: line,
            converted: convertedLine,
            costPrice,
            qty,
            amount
          })
          
          convertedLines.push(convertedLine)
        }
        
        if (convertedLines.length > 0) {
          setLineItems(convertedLines)
        }
      }

      // Set reference to original SO
      setVendorReference(`From SO-${salesOrder.so_number}`)
      
    } catch (error) {
      console.error('Error loading sales order data:', error)
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
      if (templatesRes.data) {
        setTemplates(templatesRes.data)
        const defaultTemplate = templatesRes.data.find(t => t.is_default)
        if (defaultTemplate?.terms_and_conditions) {
          setVendorMessage(defaultTemplate.terms_and_conditions)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generatePONumber = async () => {
    try {
      const { data } = await supabase
        .from('purchase_orders')
        .select('po_number')
        .order('po_number', { ascending: false })
        .limit(1)

      let nextNumber = 1
      if (data && data.length > 0 && data[0].po_number) {
        const lastNumber = data[0].po_number
        if (lastNumber.match(/^PO-\d{6}$/)) {
          nextNumber = parseInt(lastNumber.split('-')[1]) + 1
        }
      }

      const newNumber = `PO-${String(nextNumber).padStart(6, '0')}`
      setPONumber(newNumber)
      return newNumber
    } catch (error) {
      console.error('Error generating PO number:', error)
      const fallbackNumber = `PO-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`
      setPONumber(fallbackNumber)
      return fallbackNumber
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
    const purchasePrice = (inventoryItem as any).weighted_average_cost || (inventoryItem as any).last_cost || (product as any).default_purchase_price || 0
    console.log('Product selected:', { 
      sku: product.sku, 
      purchasePrice, 
      lastCost: inventoryItem.last_cost,
      inventoryPrice: inventoryItem.weighted_average_cost,
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
          is_taxable: (inventoryItem as any).default_tax_code === 'TAX'
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
    
    // Set default ship to address from company settings
    const defaultShipTo = getShippingAddress()
    setShipToAddress(defaultShipTo)

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

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const shouldLeave = window.confirm('You have unsaved changes to this purchase order. Are you sure you want to leave?')
      if (!shouldLeave) {
        return
      }
    }
    onCancel()
  }

  // Handle save
  const handleSave = async () => {
    if (!vendorId) {
      alert('Please select a vendor')
      return
    }

    if (lineItems.filter(item => item.description.trim()).length === 0) {
      alert('Please add at least one line item')
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
      'CREATE_PURCHASE_ORDER',
      'purchase_order', 
      undefined,
      async () => {
        // Create the purchase order
        const insertData = {
            po_number: poNumber,
            vendor_id: vendorId,
            sales_rep_id: null, // Sales reps not needed for POs
            order_date: date,
            expected_delivery_date: expectedDeliveryDate || null,
            vendor_reference: vendorReference || null,
            status: 'PENDING',
            subtotal,
            tax_rate: defaultTaxRate,
            tax_amount: taxAmount,
            total_amount: total,
            internal_notes: memo || null,
            vendor_notes: vendorMessage || null,
            terms_and_conditions: terms || null,
            ship_to_address: shipToAddress || null,
            source_sales_order_id: sourceSalesOrderId,
            last_edited_by: user?.id || null
        }
        
        const { data: newPurchaseOrder, error } = await supabase
          .from('purchase_orders')
          .insert(insertData)
          .select(`
            *,
            vendors (company_name, contact_name)
          `)
          .single()

        if (error) throw error

        // Create line items
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

        // Update sales order if this was converted from one
        if (sourceSalesOrderId) {
          await supabase
            .from('sales_orders')
            .update({ converted_to_purchase_order_id: newPurchaseOrder.id })
            .eq('id', sourceSalesOrderId)
        }

        return newPurchaseOrder
      },
      validationData
    )
    
    setIsSaving(false)
    
    if (saveResult.success && saveResult.data) {
      setHasUnsavedChanges(false)
      
      // Show success message if created from sales order
      if (sourceSalesOrderId) {
        alert(`Purchase Order ${saveResult.data.po_number} created successfully from Sales Order!`)
      }
      
      onSave(saveResult.data)
    } else {
      // Error is already logged by executeSaveOperation
      alert(saveResult.error?.userMessage || 'An unexpected error occurred while saving the purchase order.')
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

  // Duplicate functionality
  const handleDuplicate = async () => {
    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      const shouldSave = confirm('You have unsaved changes. Would you like to save the current purchase order before duplicating?')
      if (shouldSave) {
        // In create mode, we save first, then duplicate
        await handleSave()
        // After saving, generate unique number for duplicate
        const newPONumber = await generatePONumber()
        
        setPONumber(newPONumber)
        setDate(new Date().toISOString().split('T')[0])
        setHasUnsavedChanges(true)
        
        alert(`Purchase Order duplicated successfully with number: ${newPONumber}!\n\nRemember to save this new purchase order.`)
        return
      }
    }
    
    // Generate unique PO number
    await generatePONumber()
    setDate(new Date().toISOString().split('T')[0])
    setHasUnsavedChanges(true)
    
    alert(`Purchase Order duplicated successfully with number: ${poNumber}!\n\nRemember to save this new purchase order.`)
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
                onClick={handleCancel}
                className="text-xs h-7"
              >
                <X className="w-3 h-3 mr-1" /> Close
              </Button>
            </div>

            {/* Title with unsaved indicator */}
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-gray-800">Create Purchase Order</h1>
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
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleDuplicate}>
              <Copy className="w-3 h-3 mr-1" /> Duplicate
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" disabled>
              <Mail className="w-3 h-3 mr-1" /> Email
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

      {/* Document Flow Tracker */}
      {Object.keys(documentRelationships).length > 0 && (
        <div className="px-4 py-2 border-b bg-blue-50">
          <DocumentFlowTracker 
            relationships={documentRelationships} 
            currentDocument="purchaseOrder"
            onNavigate={(type, id) => {
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

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header Section */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="grid grid-cols-2 gap-8">
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
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Expected Delivery</label>
                    <Input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column - PO Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">PO Number</label>
                  <Input
                    value={poNumber}
                    onChange={(e) => setPONumber(e.target.value)}
                    placeholder="PO-000001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Vendor Reference</label>
                  <Input
                    value={vendorReference}
                    onChange={(e) => setVendorReference(e.target.value)}
                    placeholder="Enter vendor reference..."
                  />
                </div>
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
                  <div className="text-gray-400 text-sm">Select a vendor above to see their information</div>
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
                    }}
                    className="rounded"
                  />
                  Ship to our company
                </label>
              </div>
              <Textarea
                value={shipToAddress}
                onChange={(e) => setShipToAddress(e.target.value)}
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
                            onChange={(e) => setLineItems(prev => prev.map(li => 
                              li.id === item.id ? { ...li, item: e.target.value } : li
                            ))}
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
                                      ${((inv as any).weighted_average_cost || (inv as any).last_cost || (inv.products as any).default_purchase_price || 0).toFixed(2)} •
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
                          onChange={(e) => setLineItems(prev => prev.map(li => 
                            li.id === item.id ? { ...li, description: e.target.value } : li
                          ))}
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
                          onChange={(e) => updateLineItemAmount(item.id, parseFloat(e.target.value) || 0, item.rate)}
                          className="text-sm"
                        />
                      </td>
                      <td style={{ width: columnWidths.rate }} className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => updateLineItemAmount(item.id, item.qty, parseFloat(e.target.value) || 0)}
                          className="text-sm"
                        />
                      </td>
                      <td style={{ width: columnWidths.tax }} className="px-4 py-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.is_taxable || false}
                            onChange={(e) => setLineItems(prev => prev.map(li => 
                              li.id === item.id ? { ...li, is_taxable: e.target.checked } : li
                            ))}
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
          <div className="grid grid-cols-2 gap-6 mt-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <label className="block text-sm font-medium mb-2">Internal Memo</label>
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Internal notes (not visible to vendor)"
                rows={4}
              />
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <label className="block text-sm font-medium mb-2">Message to Vendor</label>
              <Textarea
                value={vendorMessage}
                onChange={(e) => setVendorMessage(e.target.value)}
                placeholder="Message visible to vendor"
                rows={4}
              />
            </div>
          </div>
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