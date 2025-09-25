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
import { X, Save, Printer, Mail, Copy, Plus, Trash2, Settings2, Eye, FileText, Calculator, ArrowLeft, ArrowRight, Search, FileCheck, Receipt, AlertTriangle } from 'lucide-react'
import TemplateEditor from '@/components/templates/template-editor'
import CollaborationIndicator from '@/components/ui/collaboration-indicator'
import ContextMenu from '@/components/ui/context-menu'

type Customer = Database['public']['Tables']['customers']['Row']
type SalesRep = Database['public']['Tables']['sales_reps']['Row']
type EstimateTemplate = Database['public']['Tables']['estimate_templates']['Row']
type Product = Database['public']['Tables']['products']['Row']
type Estimate = Database['public']['Tables']['estimates']['Row']

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
}

interface CreateEstimateQuickBooksStyleProps {
  onSave: (estimate: Estimate) => void
  onCancel: () => void
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

export default function CreateEstimateQuickBooksStyle({ onSave, onCancel, estimates = [], onNavigate }: CreateEstimateQuickBooksStyleProps) {
  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [templates, setTemplates] = useState<EstimateTemplate[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Header fields
  const [customer, setCustomer] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerDropdown, setCustomerDropdown] = useState(false)
  const [estimateNumber, setEstimateNumber] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [expirationDate, setExpirationDate] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [salesRep, setSalesRep] = useState('')
  const [terms, setTerms] = useState('')

  // Address fields
  const [billTo, setBillTo] = useState('')
  const [shipTo, setShipTo] = useState('')
  const [shipSameAsBill, setShipSameAsBill] = useState(true)

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', item: '', description: '', qty: 1, rate: 0, amount: 0, unit_of_measure: 'ea', is_taxable: false }
  ])
  const [activeItemDropdowns, setActiveItemDropdowns] = useState<{[key: string]: boolean}>({})

  // Totals
  const [subtotal, setSubtotal] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [total, setTotal] = useState(0)
  
  // Get backend-controlled tax rate from settings
  const { defaultTaxRate } = useDefaultTaxRate()
  const { user } = useAuth()
  
  // Profit calculations
  const [totalCost, setTotalCost] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [profitMargin, setProfitMargin] = useState(0)
  const [showProfitCalculator, setShowProfitCalculator] = useState(false)

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

  // Refs for click outside handling
  const customerDropdownRef = useRef<HTMLDivElement>(null)
  const itemDropdownRefs = useRef<{[key: string]: HTMLDivElement | null}>({})
  
  // Template editor state
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  // Collaboration state
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [currentUserId] = useState('current-user') // This would come from auth context
  
  // Navigation and change tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Add browser-level unsaved changes warning
  useUnsavedChangesWarning(hasUnsavedChanges, 'You have unsaved changes to this estimate. Are you sure you want to leave?')

  // Column ordering state
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
    generateEstimateNumber()
  }, [])

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
    // Calculate totals
    const newSubtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
    
    // Calculate tax using backend tax rate
    const taxableSubtotal = lineItems
      .filter(item => item.is_taxable)
      .reduce((sum, item) => sum + (item.amount || 0), 0)
    const newTaxAmount = (taxableSubtotal * defaultTaxRate) / 100
    const newTotal = newSubtotal + newTaxAmount
    
    // Calculate profit
    const newTotalCost = lineItems.reduce((sum, item) => {
      // Find the inventory item to get its cost (preferred)
      const inventoryItem = inventory.find(inv => inv.product_id === item.product_id)
      // Fallback to product cost if no inventory found
      const product = products.find(p => p.id === item.product_id)
      const itemCost = (inventoryItem?.weighted_average_cost || (product as any)?.cost || 0) * item.qty
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

  useEffect(() => {
    // Update Ship To when Bill To changes and shipSameAsBill is true
    if (shipSameAsBill) {
      setShipTo(billTo)
    }
  }, [billTo, shipSameAsBill])

  // Navigation logic for cycling through estimates
  const canNavigatePrevious = estimates.length > 0
  const canNavigateNext = estimates.length > 0

  const handleNavigateToEstimate = async (direction: 'previous' | 'next') => {
    // Check for unsaved changes
    if (hasUnsavedChanges) {
      const shouldSave = confirm('You have unsaved changes. Would you like to save this estimate before navigating?')
      if (shouldSave) {
        try {
          await handleSave()
        } catch (error) {
          alert('Failed to save estimate. Navigation cancelled.')
          return
        }
      } else {
        const shouldDiscard = confirm('Are you sure you want to discard your changes?')
        if (!shouldDiscard) {
          return
        }
      }
    }

    // Navigate to the appropriate estimate
    if (estimates.length === 0) return

    // For create mode, we'll navigate to the first/last estimate
    const targetEstimate = direction === 'next' 
      ? estimates[0] // Go to first estimate
      : estimates[estimates.length - 1] // Go to last estimate

    if (onNavigate && targetEstimate) {
      onNavigate(targetEstimate)
    }
  }

  const handlePrevious = () => handleNavigateToEstimate('previous')
  const handleNext = () => handleNavigateToEstimate('next')

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
        supabase.from('customers').select('*').order('name'),
        supabase.from('sales_reps').select('*').eq('is_active', true).order('first_name'),
        supabase.from('estimate_templates').select('*').order('name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('inventory').select('*, products(*)').order('products(name)')
      ])

      if (customersResult.data) setCustomers(customersResult.data)
      if (salesRepsResult.data) setSalesReps(salesRepsResult.data)
      if (templatesResult.data) {
        setTemplates(templatesResult.data)
        const defaultTemplate = templatesResult.data.find(t => t.is_default)
        if (defaultTemplate?.terms_and_conditions) {
          setCustomerMessage(defaultTemplate.terms_and_conditions)
        }
      }
      if (productsResult.data) setProducts(productsResult.data)
      if (inventoryResult.data) setInventory(inventoryResult.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateEstimateNumber = () => {
    const today = new Date()
    const year = today.getFullYear().toString().slice(-2)
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const day = today.getDate().toString().padStart(2, '0')
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
    setEstimateNumber(`${year}${month}${day}-${random}`)
  }

  const handleCustomerSearch = (value: string) => {
    setCustomer(value)
    setCustomerDropdown(true)
    
    // Check if this could be a new customer
    const existing = customers.find(c => 
      c.name.toLowerCase() === value.toLowerCase()
    )
    
    if (!existing && value.trim()) {
      // This might be a new customer name
    }
  }

  const selectCustomer = (customerData: Customer) => {
    setCustomer(customerData.name)
    setCustomerId(customerData.id)
    setCustomerDropdown(false)
    
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
        email: newCustomerModal.email || null,
        phone: newCustomerModal.phone || null,
        address_line_1: newCustomerModal.address || null,
        payment_terms: 'NET30',  // Note: uppercase to match enum constraint
        credit_limit: 0,
        tax_exempt: false,
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
          errorMessage = 'Invalid payment terms. Must be one of: NET30, NET60, etc.'
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
        
        const lineAmount = defaultQty * salesPrice
        
        return {
          ...item,
          item: product.sku || product.name,
          description: product.name,
          product_id: product.id,
          unit_of_measure: product.unit_of_measure || 'ea',
          qty: defaultQty,
          rate: salesPrice,
          amount: lineAmount,
          is_taxable: false // Default to non-taxable, user can enable if needed
        }
      }
      return item
    }))
    setActiveItemDropdowns(prev => ({ ...prev, [lineId]: false }))
  }

  // Old column functions removed - now using the new resize handlers above

  // Generate PDF for print/email
  const generatePDF = async (forDownload = false) => {
    // This would typically use a library like jsPDF or react-pdf
    // For now, we'll open the preview in a new window for printing
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const estimateHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Estimate ${estimateNumber}</title>
        <style>
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .company { font-size: 24px; font-weight: bold; }
          .estimate-title { font-size: 20px; margin-top: 10px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .address-box { border: 1px solid #ddd; padding: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background-color: #f0f0f0; padding: 10px; text-align: left; border: 1px solid #ddd; }
          td { padding: 10px; border: 1px solid #ddd; }
          .totals { margin-left: auto; width: 300px; }
          .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
          .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; }
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
              alert('Estimate downloaded as HTML file. You can:\\n1. Open the file and print to PDF\\n2. Or attach the HTML file directly to your email');
            }, 500);
          }
        </script>
        ` : ''}
      </head>
      <body>
        <div class="header">
          <div class="company">Your Company Name</div>
          <div class="estimate-title">ESTIMATE #${estimateNumber}</div>
        </div>
        
        <div class="info-grid">
          <div class="address-box">
            <strong>Bill To:</strong><br>
            ${billTo.replace(/\n/g, '<br>')}
          </div>
          <div class="address-box">
            <strong>Ship To:</strong><br>
            ${shipTo.replace(/\n/g, '<br>')}
          </div>
        </div>
        
        <div>
          <strong>Date:</strong> ${date}<br>
          <strong>Expiration:</strong> ${expirationDate || 'N/A'}<br>
          <strong>Terms:</strong> ${terms || 'N/A'}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th style="text-align: right;">Qty</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems.filter(item => item.description).map(item => `
              <tr>
                <td>${item.item}</td>
                <td>${item.description}</td>
                <td style="text-align: right;">${item.qty}</td>
                <td style="text-align: right;">$${item.rate.toFixed(2)}</td>
                <td style="text-align: right;">$${item.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Tax (${defaultTaxRate}%):</span>
            <span>$${taxAmount.toFixed(2)}</span>
          </div>
          <div class="total-row grand-total">
            <span>Total:</span>
            <span>$${total.toFixed(2)}</span>
          </div>
        </div>
        
        ${customerMessage ? `<div style="margin-top: 30px;"><strong>Notes:</strong><br>${customerMessage.replace(/\n/g, '<br>')}</div>` : ''}
      </body>
      </html>
    `

    printWindow.document.write(estimateHTML)
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

  // Email functionality - auto-downloads HTML and opens email
  const handleEmail = async () => {
    // Generate downloadable PDF
    const printWindow = await generatePDF(true)
    if (!printWindow) {
      alert('Failed to generate estimate file. Please try again.')
      return
    }

    // Small delay to ensure download starts, then open email
    setTimeout(() => {
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
      
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }, 2000)
  }

  // Duplicate functionality - creates new estimate with new number  
  const handleDuplicate = async () => {
    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      const shouldSave = confirm('You have unsaved changes. Would you like to save the current estimate before duplicating?')
      if (shouldSave) {
        // In create mode, we save first, then duplicate
        handleSave().then(async () => {
          // After saving, generate unique number for duplicate
          const newEstimateNumber = await generateUniqueEstimateNumber()
          
          setEstimateNumber(newEstimateNumber)
          setDate(new Date().toISOString().split('T')[0])
          setHasUnsavedChanges(true)
          
          alert(`Estimate duplicated with new number: ${newEstimateNumber}. Remember to save this new estimate.`)
        })
        return
      }
    }

    // Generate unique estimate number
    const newEstimateNumber = await generateUniqueEstimateNumber()
    
    // Update to new number and reset date
    setEstimateNumber(newEstimateNumber)
    setDate(new Date().toISOString().split('T')[0])
    setHasUnsavedChanges(true)
    
    alert(`Estimate duplicated with new number: ${newEstimateNumber}. Remember to save this new estimate.`)
  }

  // Table cell rendering now handled inline in the tbody section

  const updateLineItem = (lineId: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        const updated = { ...item, [field]: value }
        
        // Recalculate amount when qty or rate changes
        if (field === 'qty' || field === 'rate') {
          updated.amount = updated.qty * updated.rate
        }
        
        return updated
      }
      return item
    }))
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
      is_taxable: false
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
      is_taxable: false
    }
    
    setLineItems(prev => {
      const newItems = [...prev]
      newItems.splice(currentIndex + 1, 0, newLineItem)
      return newItems
    })
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const shouldLeave = window.confirm('You have unsaved changes to this estimate. Are you sure you want to leave?')
      if (!shouldLeave) {
        return
      }
    }
    onCancel()
  }

  const handleSave = async () => {
    if (!customerId) {
      alert('Please select a customer')
      return
    }

    if (!estimateNumber.trim()) {
      alert('Please enter an estimate number')
      return
    }

    const validLineItems = lineItems.filter(item => item.description.trim())
    if (validLineItems.length === 0) {
      alert('Please add at least one line item')
      return
    }

    setIsSaving(true)

    try {
      // Generate unique estimate number
      const uniqueNumber = await generateUniqueEstimateNumber()
      setEstimateNumber(uniqueNumber)
      // Parse Bill To for structured data
      const billToLines = billTo.split('\n').filter(line => line.trim())
      const shipToLines = shipTo.split('\n').filter(line => line.trim())

      // Create estimate with all required fields from database schema
      const estimateData = {
        estimate_number: uniqueNumber,
        customer_id: customerId,
        sales_rep_id: salesReps.find(rep => `${rep.first_name} ${rep.last_name}` === salesRep)?.id || null,
        template_id: null, // Optional
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
        estimate_date: date,
        expiration_date: expirationDate || null,
        reference_number: poNumber || null,
        job_name: null, // Not captured in current form
        subtotal,
        tax_rate: defaultTaxRate,
        tax_amount: taxAmount,
        shipping_amount: 0, // Default to 0
        discount_amount: 0, // Default to 0
        total_amount: total,
        status: 'DRAFT' as const,
        internal_notes: memo || null,
        customer_notes: customerMessage || null,
        terms_and_conditions: terms || null,
        last_emailed_at: null,
        email_count: 0
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

      // Create line items with all required fields from database schema
      const lineItemsData = validLineItems.map((item, index) => ({
        estimate_id: estimateResult.id,
        line_number: index + 1,
        item_type: 'PRODUCT' as const,
        product_id: item.product_id || null,
        sku: item.item || null,
        description: item.description,
        long_description: null, // Not captured in current form
        quantity: item.qty || 1,
        unit_of_measure: item.unit_of_measure || 'each',
        unit_price: item.rate || 0,
        line_total: (item.qty || 1) * (item.rate || 0),
        discount_type: 'NONE' as const,
        discount_value: 0,
        discounted_total: null,
        is_taxable: item.is_taxable || false,
        tax_code: item.is_taxable ? 'TAX' : null,
        notes: null,
        sort_order: index + 1
      }))

      const { error: lineItemsError } = await supabase
        .from('estimate_lines')
        .insert(lineItemsData)

      if (lineItemsError) throw lineItemsError

      // Update customer address if it was modified in the estimate
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
            // Don't throw - estimate was saved successfully
          }
        }
      } catch (addressUpdateError) {
        console.warn('Error updating customer address:', addressUpdateError)
        // Don't throw - estimate was saved successfully
      }

      // Clear unsaved changes flag since we just saved successfully
      setHasUnsavedChanges(false)

      onSave(estimateResult)
    } catch (error) {
      console.error('Error creating estimate:', error)
      console.error('Error details:', {
        message: (error as any)?.message,
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint
      })
      alert(`Failed to create estimate: ${(error as any)?.message || 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customer.toLowerCase())
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
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
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
                disabled={!canNavigatePrevious}
                onClick={handlePrevious}
                title="Navigate to last estimate"
              >
                <ArrowLeft className={`w-4 h-4 ${canNavigatePrevious ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0" 
                disabled={!canNavigateNext}
                onClick={handleNext}
                title="Navigate to first estimate"
              >
                <ArrowRight className={`w-4 h-4 ${canNavigateNext ? 'text-gray-600' : 'text-gray-400'}`} />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled>
                <Search className="w-4 h-4 text-gray-400" />
              </Button>
            </div>

            {/* Title with unsaved indicator */}
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-gray-800">Create Estimate</h1>
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
            {/* Conversion Actions - Disabled for create */}
            <Button size="sm" variant="outline" className="text-xs h-7" disabled>
              <FileCheck className="w-3 h-3 mr-1" /> Create SO
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
            <Button size="sm" variant="outline" onClick={handleCancel} className="text-xs h-7">
              <X className="w-3 h-3 mr-1" /> Close
            </Button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-auto p-6 bg-white">
        <div className="max-w-7xl mx-auto space-y-6">
          
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
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.email}</div>
                      </button>
                    ))}
                    
                    {customer && !customers.find(c => c.name.toLowerCase() === customer.toLowerCase()) && (
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
                <Input
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
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
                        <div ref={el => { itemDropdownRefs.current[item.id] = el }}>
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
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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

              {/* Line Item Breakdown */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Line Item Breakdown</h3>
                <div className="overflow-x-auto -mx-2 sm:mx-0 border rounded-lg">
                  <div className="inline-block min-w-full align-middle px-2 sm:px-0">
                    <table className="w-full" style={{ minWidth: '800px' }}>
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

              {/* Profit Analysis */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">Profit Analysis</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Break-even Revenue:</span>
                    <span className="font-medium ml-2">${totalCost.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Items with Missing Costs:</span>
                    <span className="font-medium ml-2 text-amber-600">
                      {lineItems.filter(item => {
                        const inventoryItem = inventory.find(inv => inv.product_id === item.product_id)
                        const product = products.find(p => p.id === item.product_id)
                        const itemCost = inventoryItem?.weighted_average_cost || (product as any)?.cost || 0
                        return item.description.trim() && itemCost === 0
                      }).length}
                    </span>
                  </div>
                </div>
                
                {totalCost === 0 && lineItems.some(item => item.description.trim()) && (
                  <div className="mt-3 p-3 bg-amber-100 border border-amber-300 rounded text-sm text-amber-800">
                    <strong>Warning:</strong> No cost data found for line items. Profit calculations may be inaccurate. 
                    Please ensure products have cost information in the inventory system.
                  </div>
                )}
                
                {profitMargin < 20 && subtotal > 0 && (
                  <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded text-sm text-red-800">
                    <strong>Low Margin Alert:</strong> This estimate has a profit margin of {profitMargin.toFixed(1)}%, 
                    which may be below your target. Consider reviewing pricing or costs.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}