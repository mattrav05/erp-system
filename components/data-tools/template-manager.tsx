'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Download, 
  Upload,
  FileText,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Users,
  Lock
} from 'lucide-react'

interface ImportTemplate {
  id: string
  name: string
  module: string
  description?: string
  fieldMappings: FieldMapping[]
  validationRules: ValidationRule[]
  defaultValues: Record<string, any>
  skipHeaderRows: number
  delimiter: string
  encoding: string
  dateFormat: string
  duplicateHandling: 'skip' | 'update' | 'create_new' | 'merge'
  timesUsed: number
  lastUsed?: string
  isPublic: boolean
  userId: string
  createdAt: string
  updatedAt: string
}

interface FieldMapping {
  csvColumn: string
  dbField: string
  required?: boolean
  dataType?: string
  transform?: string
  defaultValue?: any
  maxLength?: number
  validValues?: any[]
}

interface ValidationRule {
  field: string
  rule: string
  message?: string
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<ImportTemplate[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<ImportTemplate[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ImportTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Form state for creating/editing templates
  const [templateForm, setTemplateForm] = useState({
    name: '',
    module: '',
    description: '',
    isPublic: false
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    filterTemplates()
  }, [templates, searchTerm, moduleFilter])

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockTemplates: ImportTemplate[] = [
        {
          id: '1',
          name: 'Standard Customer Import',
          module: 'customers',
          description: 'Standard template for importing customer data with basic fields',
          fieldMappings: [
            { csvColumn: 'Company Name', dbField: 'company_name', required: true, dataType: 'string' },
            { csvColumn: 'Contact Name', dbField: 'contact_name', required: false, dataType: 'string' },
            { csvColumn: 'Email', dbField: 'email', required: false, dataType: 'email' },
            { csvColumn: 'Phone', dbField: 'phone', required: false, dataType: 'phone' },
            { csvColumn: 'Address', dbField: 'address_line_1', required: false, dataType: 'string' },
            { csvColumn: 'City', dbField: 'city', required: false, dataType: 'string' },
            { csvColumn: 'State', dbField: 'state', required: false, dataType: 'string' },
            { csvColumn: 'ZIP', dbField: 'zip_code', required: false, dataType: 'string' }
          ],
          validationRules: [
            { field: 'email', rule: 'email_format', message: 'Must be a valid email address' },
            { field: 'phone', rule: 'phone_format', message: 'Must be a valid phone number' }
          ],
          defaultValues: { is_active: true, customer_type: 'RETAIL' },
          skipHeaderRows: 1,
          delimiter: ',',
          encoding: 'UTF-8',
          dateFormat: 'MM/DD/YYYY',
          duplicateHandling: 'skip',
          timesUsed: 15,
          lastUsed: '2025-01-15T10:30:00Z',
          isPublic: true,
          userId: 'user1',
          createdAt: '2025-01-01T10:00:00Z',
          updatedAt: '2025-01-15T10:30:00Z'
        },
        {
          id: '2',
          name: 'Product Catalog Import',
          module: 'products',
          description: 'Template for importing product catalog with pricing and inventory',
          fieldMappings: [
            { csvColumn: 'Product Name', dbField: 'name', required: true, dataType: 'string' },
            { csvColumn: 'SKU', dbField: 'sku', required: true, dataType: 'string' },
            { csvColumn: 'Description', dbField: 'description', required: false, dataType: 'string' },
            { csvColumn: 'Category', dbField: 'category', required: false, dataType: 'string' },
            { csvColumn: 'Cost', dbField: 'cost', required: false, dataType: 'currency', transform: 'currency_to_number' },
            { csvColumn: 'Price', dbField: 'price', required: false, dataType: 'currency', transform: 'currency_to_number' },
            { csvColumn: 'Weight', dbField: 'weight', required: false, dataType: 'number' }
          ],
          validationRules: [
            { field: 'sku', rule: 'unique', message: 'SKU must be unique' },
            { field: 'cost', rule: 'positive_number', message: 'Cost must be positive' },
            { field: 'price', rule: 'positive_number', message: 'Price must be positive' }
          ],
          defaultValues: { is_active: true, track_inventory: true },
          skipHeaderRows: 1,
          delimiter: ',',
          encoding: 'UTF-8',
          dateFormat: 'MM/DD/YYYY',
          duplicateHandling: 'update',
          timesUsed: 8,
          lastUsed: '2025-01-14T16:20:00Z',
          isPublic: false,
          userId: 'user1',
          createdAt: '2025-01-05T14:00:00Z',
          updatedAt: '2025-01-14T16:20:00Z'
        },
        {
          id: '3',
          name: 'Vendor Master Data',
          module: 'vendors',
          description: 'Comprehensive vendor import with contact and payment information',
          fieldMappings: [
            { csvColumn: 'Vendor Name', dbField: 'vendor_name', required: true, dataType: 'string' },
            { csvColumn: 'Contact Person', dbField: 'contact_name', required: true, dataType: 'string' },
            { csvColumn: 'Email Address', dbField: 'email', required: false, dataType: 'email' },
            { csvColumn: 'Phone Number', dbField: 'phone', required: false, dataType: 'phone', transform: 'phone_normalize' },
            { csvColumn: 'Street Address', dbField: 'address_line_1', required: false, dataType: 'string' },
            { csvColumn: 'City', dbField: 'city', required: false, dataType: 'string' },
            { csvColumn: 'State', dbField: 'state', required: false, dataType: 'string', transform: 'uppercase' },
            { csvColumn: 'ZIP Code', dbField: 'zip_code', required: false, dataType: 'string' },
            { csvColumn: 'Payment Terms', dbField: 'payment_terms', required: false, dataType: 'string' },
            { csvColumn: 'Tax ID', dbField: 'tax_id', required: false, dataType: 'string' }
          ],
          validationRules: [
            { field: 'email', rule: 'email_format', message: 'Must be a valid email address' },
            { field: 'phone', rule: 'phone_format', message: 'Must be a valid phone number' }
          ],
          defaultValues: { is_active: true },
          skipHeaderRows: 1,
          delimiter: ',',
          encoding: 'UTF-8',
          dateFormat: 'MM/DD/YYYY',
          duplicateHandling: 'skip',
          timesUsed: 3,
          lastUsed: '2025-01-10T09:15:00Z',
          isPublic: true,
          userId: 'user1',
          createdAt: '2025-01-08T11:30:00Z',
          updatedAt: '2025-01-10T09:15:00Z'
        }
      ]
      
      setTemplates(mockTemplates)
      
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterTemplates = () => {
    let filtered = templates

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase()
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(lowerSearchTerm) ||
        template.module.toLowerCase().includes(lowerSearchTerm) ||
        template.description?.toLowerCase().includes(lowerSearchTerm)
      )
    }

    if (moduleFilter !== 'all') {
      filtered = filtered.filter(template => template.module === moduleFilter)
    }

    // Sort by usage frequency and last used
    filtered.sort((a, b) => {
      if (a.timesUsed !== b.timesUsed) {
        return b.timesUsed - a.timesUsed
      }
      return new Date(b.lastUsed || b.updatedAt).getTime() - new Date(a.lastUsed || a.updatedAt).getTime()
    })

    setFilteredTemplates(filtered)
  }

  const handleCreateTemplate = () => {
    setTemplateForm({
      name: '',
      module: '',
      description: '',
      isPublic: false
    })
    setEditingTemplate(null)
    setShowCreateModal(true)
  }

  const handleEditTemplate = (template: ImportTemplate) => {
    setTemplateForm({
      name: template.name,
      module: template.module,
      description: template.description || '',
      isPublic: template.isPublic
    })
    setEditingTemplate(template)
    setShowCreateModal(true)
  }

  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.module) {
      alert('Please fill in required fields')
      return
    }

    try {
      // TODO: Implement actual save API call
      console.log('Saving template:', templateForm)
      
      if (editingTemplate) {
        // Update existing template
        const updatedTemplates = templates.map(t => 
          t.id === editingTemplate.id 
            ? { ...t, ...templateForm, updatedAt: new Date().toISOString() }
            : t
        )
        setTemplates(updatedTemplates)
      } else {
        // Create new template
        const newTemplate: ImportTemplate = {
          id: Date.now().toString(),
          ...templateForm,
          fieldMappings: [],
          validationRules: [],
          defaultValues: {},
          skipHeaderRows: 1,
          delimiter: ',',
          encoding: 'UTF-8',
          dateFormat: 'MM/DD/YYYY',
          duplicateHandling: 'skip',
          timesUsed: 0,
          userId: 'user1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        setTemplates([...templates, newTemplate])
      }
      
      setShowCreateModal(false)
      setEditingTemplate(null)
      
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }

    try {
      // TODO: Implement actual delete API call
      const updatedTemplates = templates.filter(t => t.id !== templateId)
      setTemplates(updatedTemplates)
      
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Failed to delete template')
    }
  }

  const handleDuplicateTemplate = async (template: ImportTemplate) => {
    try {
      const newTemplate: ImportTemplate = {
        ...template,
        id: Date.now().toString(),
        name: `${template.name} (Copy)`,
        timesUsed: 0,
        lastUsed: undefined,
        isPublic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      setTemplates([...templates, newTemplate])
      
    } catch (error) {
      console.error('Error duplicating template:', error)
      alert('Failed to duplicate template')
    }
  }

  const exportTemplate = (template: ImportTemplate) => {
    const exportData = {
      name: template.name,
      module: template.module,
      description: template.description,
      fieldMappings: template.fieldMappings,
      validationRules: template.validationRules,
      defaultValues: template.defaultValues,
      settings: {
        skipHeaderRows: template.skipHeaderRows,
        delimiter: template.delimiter,
        encoding: template.encoding,
        dateFormat: template.dateFormat,
        duplicateHandling: template.duplicateHandling
      }
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${template.name.replace(/[^a-zA-Z0-9]/g, '_')}_template.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getModuleName = (module: string) => {
    const moduleNames: Record<string, string> = {
      customers: 'Customers',
      vendors: 'Vendors',
      products: 'Products',
      inventory: 'Inventory',
      sales_orders: 'Sales Orders',
      purchase_orders: 'Purchase Orders',
      estimates: 'Estimates',
      invoices: 'Invoices'
    }
    return moduleNames[module] || module
  }

  const getModuleFields = (module: string) => {
    const fieldDefinitions: Record<string, Array<{
      key: string
      label: string
      type: string
      required?: boolean
      description?: string
      examples?: string[]
    }>> = {
      customers: [
        { key: 'company_name', label: 'Company Name', type: 'text', required: true, description: 'Primary business name', examples: ['Acme Corp', 'Smith LLC'] },
        { key: 'contact_name', label: 'Contact Name', type: 'text', description: 'Primary contact person', examples: ['John Smith', 'Jane Doe'] },
        { key: 'email', label: 'Email', type: 'email', description: 'Primary email address', examples: ['john@acme.com', 'info@company.com'] },
        { key: 'phone', label: 'Phone', type: 'text', description: 'Primary phone number', examples: ['(555) 123-4567', '+1-555-123-4567'] },
        { key: 'address_line_1', label: 'Address Line 1', type: 'text', description: 'Street address', examples: ['123 Main St', '456 Oak Avenue'] },
        { key: 'address_line_2', label: 'Address Line 2', type: 'text', description: 'Apartment, suite, etc.', examples: ['Suite 100', 'Apt 2B'] },
        { key: 'city', label: 'City', type: 'text', description: 'City name', examples: ['New York', 'Los Angeles'] },
        { key: 'state', label: 'State', type: 'text', description: 'State or province', examples: ['NY', 'CA', 'Texas'] },
        { key: 'zip', label: 'ZIP Code', type: 'text', description: 'Postal code', examples: ['10001', '90210'] },
        { key: 'country', label: 'Country', type: 'text', description: 'Country name', examples: ['United States', 'Canada'] },
      ],
      vendors: [
        { key: 'vendor_name', label: 'Vendor Name', type: 'text', required: true, description: 'Supplier company name', examples: ['ABC Supplies', 'Global Materials'] },
        { key: 'contact_name', label: 'Contact Name', type: 'text', description: 'Primary contact person', examples: ['John Smith', 'Jane Doe'] },
        { key: 'email', label: 'Email', type: 'email', description: 'Primary email address', examples: ['supplier@abc.com'] },
        { key: 'phone', label: 'Phone', type: 'text', description: 'Primary phone number', examples: ['(555) 123-4567'] },
        { key: 'address_line_1', label: 'Address Line 1', type: 'text', description: 'Street address', examples: ['123 Industrial Blvd'] },
        { key: 'city', label: 'City', type: 'text', description: 'City name', examples: ['Chicago', 'Dallas'] },
        { key: 'state', label: 'State', type: 'text', description: 'State or province', examples: ['IL', 'TX'] },
        { key: 'zip', label: 'ZIP Code', type: 'text', description: 'Postal code', examples: ['60601'] },
        { key: 'payment_terms', label: 'Payment Terms', type: 'text', description: 'Payment terms', examples: ['Net 30', 'Due on Receipt'] },
      ],
      products: [
        // Basic Product Info (QB Required)
        { key: 'name', label: 'Product Name', type: 'text', required: true, description: 'Product display name (QB: Name)', examples: ['Widget Pro', 'Service Package A'] },
        { key: 'sku', label: 'SKU', type: 'text', required: true, description: 'Unique product identifier (QB: Sku)', examples: ['WID-001', 'SRV-PKG-A'] },
        { key: 'description', label: 'Description', type: 'text', description: 'Product description (QB: Description)', examples: ['High-quality widget for industrial use'] },
        
        // QB Item Type & Classification  
        { key: 'item_type', label: 'Item Type', type: 'choice', description: 'QB Item type', examples: ['Inventory', 'NonInventory', 'Service'] },
        { key: 'category', label: 'Category', type: 'text', description: 'Product category', examples: ['Electronics', 'Services', 'Materials'] },
        
        // Pricing (QB Required for Sales)
        { key: 'unit_price', label: 'Unit Price', type: 'number', description: 'Selling price per unit (QB: UnitPrice)', examples: ['99.99', '1500.00'] },
        { key: 'cost', label: 'Cost', type: 'number', description: 'Cost per unit (QB: UnitCost)', examples: ['75.50', '1200.00'] },
        
        // Inventory Management (QB Specific)
        { key: 'track_inventory', label: 'Track Inventory', type: 'boolean', description: 'Whether to track stock levels (QB: Type=Inventory)', examples: ['true', 'false', 'yes', 'no'] },
        { key: 'quantity_on_hand', label: 'Quantity on Hand', type: 'number', description: 'Current stock level (QB: QtyOnHand)', examples: ['100', '25.5', '0'] },
        { key: 'reorder_point', label: 'Reorder Point', type: 'number', description: 'Reorder threshold (QB: ReorderPoint)', examples: ['10', '5', '25'] },
        
        // Units & Measurement
        { key: 'unit_of_measure', label: 'Unit of Measure', type: 'text', description: 'How the product is sold (QB: UOMSetRef)', examples: ['each', 'lb', 'ft', 'hour', 'case'] },
        
        // QB Account References (Critical for QB)
        { key: 'income_account', label: 'Income Account', type: 'text', description: 'QB Income account name/ID', examples: ['Sales', 'Product Sales', 'Service Revenue'] },
        { key: 'expense_account', label: 'Expense Account', type: 'text', description: 'QB Expense account name/ID', examples: ['Cost of Goods Sold', 'Materials', 'Supplies'] },
        { key: 'asset_account', label: 'Asset Account', type: 'text', description: 'QB Asset account for inventory', examples: ['Inventory Asset', 'Raw Materials'] },
        
        // Additional QB Fields
        { key: 'taxable', label: 'Taxable', type: 'boolean', description: 'Subject to tax (QB: Taxable)', examples: ['true', 'false', 'yes', 'no'] },
        { key: 'tax_code', label: 'Tax Code', type: 'text', description: 'QB Tax code reference', examples: ['TAX', 'NON'] },
        { key: 'manufacturer_part_number', label: 'Manufacturer Part #', type: 'text', description: 'Mfg part number (QB: ManPartNum)', examples: ['MFG-12345', 'PART-ABC-001'] },
        
        // Status & Control
        { key: 'is_active', label: 'Is Active', type: 'boolean', description: 'Active status (QB: Active)', examples: ['true', 'false', 'yes', 'no'] },
        
        // QB Integration Fields  
        { key: 'qb_item_id', label: 'QB Item ID', type: 'text', description: 'QuickBooks Item ID (for sync)', examples: ['123', 'qb-item-456'] },
        { key: 'qb_sync_token', label: 'QB Sync Token', type: 'text', description: 'QB version control token', examples: ['1', '5', '12'] },
      ],
      inventory: [
        // Core Inventory Fields  
        { key: 'product_sku', label: 'Product SKU', type: 'text', required: true, description: 'Must match existing product SKU', examples: ['WIDGET-001', 'SRV-A'] },
        { key: 'location_code', label: 'Location/Warehouse', type: 'text', required: true, description: 'Warehouse or location code', examples: ['MAIN', 'WH-001', 'NYC'] },
        { key: 'bin_location', label: 'Bin Location', type: 'text', description: 'Specific shelf or bin', examples: ['A-1-5', 'SHELF-12'] },
        
        // Quantity Management
        { key: 'quantity_on_hand', label: 'Quantity on Hand', type: 'number', required: true, description: 'Current physical quantity', examples: ['100', '25.5', '0'] },
        { key: 'quantity_allocated', label: 'Quantity Allocated', type: 'number', description: 'Reserved for orders', examples: ['10', '5.25'] },
        { key: 'quantity_available', label: 'Quantity Available', type: 'number', description: 'Available for sale (on hand - allocated)', examples: ['90', '20.25'] },
        { key: 'safety_stock', label: 'Safety Stock', type: 'number', description: 'Minimum safety stock level', examples: ['10', '5'] },
        { key: 'max_stock_level', label: 'Max Stock Level', type: 'number', description: 'Maximum stock threshold', examples: ['500', '100'] },
        
        // Cost & Pricing
        { key: 'weighted_average_cost', label: 'Weighted Average Cost', type: 'number', description: 'Current weighted avg cost', examples: ['75.50', '1200.00'] },
        { key: 'last_cost', label: 'Last Cost', type: 'number', description: 'Most recent purchase cost', examples: ['80.00', '1250.00'] },
        { key: 'sales_price', label: 'Sales Price', type: 'number', description: 'Current selling price', examples: ['99.99', '1500.00'] },
        { key: 'margin_percent', label: 'Margin %', type: 'number', description: 'Profit margin (0-100)', examples: ['25.5', '15.0'] },
        { key: 'markup_percent', label: 'Markup %', type: 'number', description: 'Markup over cost', examples: ['30.0', '20.0'] },
        
        // Tax Configuration
        { key: 'default_tax_code', label: 'Default Tax Code', type: 'text', description: 'Tax code for this item', examples: ['TAX', 'NON', 'GST'] },
        { key: 'default_tax_rate', label: 'Default Tax Rate', type: 'number', description: 'Tax rate % (0-100)', examples: ['8.25', '10.0', '0'] },
        
        // Tracking Options
        { key: 'track_serial_numbers', label: 'Track Serial Numbers', type: 'boolean', description: 'Enable serial tracking', examples: ['true', 'false', 'yes', 'no'] },
        { key: 'track_lot_numbers', label: 'Track Lot Numbers', type: 'boolean', description: 'Enable lot/batch tracking', examples: ['true', 'false', 'yes', 'no'] },
        { key: 'abc_classification', label: 'ABC Classification', type: 'choice', description: 'ABC analysis class', examples: ['A', 'B', 'C'] },
        
        // Inventory Management
        { key: 'lead_time_days', label: 'Lead Time (Days)', type: 'number', description: 'Replenishment lead time', examples: ['7', '14', '30'] },
        { key: 'last_physical_count_date', label: 'Last Count Date', type: 'date', description: 'Last physical count', examples: ['2024-01-15', '01/15/2024'] },
        { key: 'variance_tolerance_percent', label: 'Variance Tolerance %', type: 'number', description: 'Acceptable variance %', examples: ['5.0', '2.5'] },
        
        // QB Integration Fields
        { key: 'qb_item_id', label: 'QB Item ID', type: 'text', description: 'QuickBooks Item ID', examples: ['123', 'qb-item-456'] },
        { key: 'qb_sync_token', label: 'QB Sync Token', type: 'text', description: 'QB sync token', examples: ['1', '5'] },
        { key: 'qb_last_sync', label: 'QB Last Sync', type: 'date', description: 'Last QB sync date', examples: ['2024-01-15'] },
        { key: 'qb_quantity_on_hand', label: 'QB Quantity', type: 'number', description: 'QB tracked quantity', examples: ['100', '25'] },
        { key: 'qb_average_cost', label: 'QB Average Cost', type: 'number', description: 'QB calculated cost', examples: ['75.50'] },
        { key: 'income_account', label: 'Income Account (QB)', type: 'text', description: 'QB income account', examples: ['Sales', 'Product Revenue'] },
        { key: 'asset_account', label: 'Asset Account (QB)', type: 'text', description: 'QB inventory asset account', examples: ['Inventory Asset'] },
        { key: 'expense_account', label: 'Expense Account (QB)', type: 'text', description: 'QB COGS account', examples: ['Cost of Goods Sold'] },
        
        // Status & Notes
        { key: 'is_active', label: 'Is Active', type: 'boolean', description: 'Active status', examples: ['true', 'false', 'yes', 'no'] },
        { key: 'notes', label: 'Notes', type: 'text', description: 'Additional notes', examples: ['Located in main warehouse', 'Fragile items'] },
      ],
      sales_orders: [
        // Header fields
        { key: 'so_number', label: 'Sales Order Number', type: 'text', required: true, description: 'Unique sales order identifier', examples: ['SO-2024-001', 'ORDER-12345'] },
        { key: 'customer_name', label: 'Customer Name', type: 'text', description: 'Customer company name', examples: ['Acme Corp', 'Smith LLC'] },
        { key: 'customer_id', label: 'Customer ID', type: 'text', description: 'Existing customer ID (alternative to name)', examples: ['CUST-001', 'uuid-string'] },
        { key: 'order_date', label: 'Order Date', type: 'date', description: 'Order date', examples: ['2024-01-15', '01/15/2024'] },
        { key: 'ship_date', label: 'Ship Date', type: 'date', description: 'Expected ship date', examples: ['2024-01-20'] },
        { key: 'reference_number', label: 'Reference Number', type: 'text', description: 'Customer reference', examples: ['PO-12345', 'REF-ABC'] },
        { key: 'job_name', label: 'Job Name', type: 'text', description: 'Project or job name', examples: ['Office Renovation', 'Q1 Materials'] },
        
        // Line item fields  
        { key: 'line_number', label: 'Line Number', type: 'number', description: 'Line item sequence', examples: ['1', '2', '3'] },
        { key: 'product_name', label: 'Product Name', type: 'text', description: 'Product being ordered', examples: ['Widget Pro', 'Service Package'] },
        { key: 'quantity', label: 'Quantity', type: 'number', description: 'Quantity ordered', examples: ['10', '2.5', '100'] },
        { key: 'unit_price', label: 'Unit Price', type: 'number', description: 'Price per unit', examples: ['99.99', '1500.00'] },
        { key: 'line_description', label: 'Line Description', type: 'text', description: 'Line item description', examples: ['Premium quality widgets'] },
      ],
      purchase_orders: [
        // Header fields
        { key: 'po_number', label: 'Purchase Order Number', type: 'text', required: true, description: 'Unique PO identifier', examples: ['PO-2024-001', 'PUR-12345'] },
        { key: 'vendor_name', label: 'Vendor Name', type: 'text', description: 'Supplier company name', examples: ['ABC Supplies', 'Global Materials'] },
        { key: 'vendor_id', label: 'Vendor ID', type: 'text', description: 'Existing vendor ID', examples: ['VEND-001', 'uuid-string'] },
        { key: 'order_date', label: 'Order Date', type: 'date', description: 'PO date', examples: ['2024-01-15', '01/15/2024'] },
        { key: 'expected_delivery_date', label: 'Expected Delivery', type: 'date', description: 'Expected delivery date', examples: ['2024-01-25'] },
        { key: 'vendor_reference', label: 'Vendor Reference', type: 'text', description: 'Vendor quote reference', examples: ['QUOTE-12345', 'REF-XYZ'] },
        
        // Line item fields
        { key: 'line_number', label: 'Line Number', type: 'number', description: 'Line item sequence', examples: ['1', '2', '3'] },
        { key: 'product_name', label: 'Product Name', type: 'text', description: 'Product being purchased', examples: ['Raw Materials', 'Office Supplies'] },
        { key: 'line_description', label: 'Line Description', type: 'text', required: true, description: 'Item description', examples: ['Steel rods 1/4 inch', 'Copy paper 500 sheets'] },
        { key: 'quantity', label: 'Quantity', type: 'number', description: 'Quantity ordered', examples: ['50', '10.5', '1000'] },
        { key: 'unit_price', label: 'Unit Price', type: 'number', description: 'Cost per unit', examples: ['15.99', '25.50'] },
      ],
      estimates: [
        // Header fields
        { key: 'estimate_number', label: 'Estimate Number', type: 'text', required: true, description: 'Unique estimate identifier', examples: ['EST-2024-001', 'QUOTE-12345'] },
        { key: 'customer_name', label: 'Customer Name', type: 'text', description: 'Customer company name', examples: ['Acme Corp', 'Smith LLC'] },
        { key: 'customer_id', label: 'Customer ID', type: 'text', description: 'Existing customer ID', examples: ['CUST-001', 'uuid-string'] },
        { key: 'estimate_date', label: 'Estimate Date', type: 'date', description: 'Quote date', examples: ['2024-01-15', '01/15/2024'] },
        { key: 'expiration_date', label: 'Expiration Date', type: 'date', description: 'Quote expiration', examples: ['2024-02-15'] },
        { key: 'job_name', label: 'Job Name', type: 'text', description: 'Project name', examples: ['Office Renovation', 'Website Redesign'] },
        
        // Line item fields
        { key: 'line_number', label: 'Line Number', type: 'number', description: 'Line item sequence', examples: ['1', '2', '3'] },
        { key: 'line_description', label: 'Line Description', type: 'text', required: true, description: 'Service or product description', examples: ['Design consultation', 'Materials and labor'] },
        { key: 'quantity', label: 'Quantity', type: 'number', description: 'Quantity estimated', examples: ['1', '40', '2.5'] },
        { key: 'unit_price', label: 'Unit Price', type: 'number', description: 'Price per unit', examples: ['150.00', '45.99'] },
        { key: 'item_type', label: 'Item Type', type: 'choice', description: 'Type of line item', examples: ['PRODUCT', 'SERVICE', 'LABOR', 'MATERIAL'] },
      ]
    }
    
    return fieldDefinitions[module] || []
  }

  const getModuleTips = (module: string) => {
    const tips: Record<string, string[]> = {
      customers: [
        'Company name is required for all customers',
        'Email format must be valid (e.g., user@domain.com)',
        'Phone numbers can include formatting like (555) 123-4567'
      ],
      vendors: [
        'Vendor name is required for all suppliers',
        'Payment terms examples: Net 30, Due on Receipt, 2/10 Net 30'
      ],
      products: [
        'Both name and SKU are required',
        'SKU must be unique across all products',
        'Use decimal format for prices (e.g., 99.99 not $99.99)',
        'Track inventory: use true/false or yes/no'
      ],
      inventory: [
        'Product SKU must match existing products in system',
        'Each product can have multiple inventory records (different locations)',
        'Quantity Available = On Hand - Allocated (auto-calculated if not provided)',
        'Use decimal format for all quantities (e.g., 25.5 not 25½)',
        'Location codes should be consistent (e.g., MAIN, WH-001)',
        'ABC Classification: A=high value, B=medium, C=low value items'
      ],
      sales_orders: [
        'Each sales order can have multiple line items',
        'Use the same SO number for all lines in one order',
        'Customer must exist in system (use name or ID)',
        'Dates should be in YYYY-MM-DD format'
      ],
      purchase_orders: [
        'Each PO can have multiple line items',
        'Use the same PO number for all lines in one order',
        'Vendor must exist in system (use name or ID)',
        'Line description is required for all line items'
      ],
      estimates: [
        'Each estimate can have multiple line items',
        'Use the same estimate number for all lines',
        'Customer must exist in system (use name or ID)',
        'Line description is required for all items'
      ]
    }
    
    return tips[module] || []
  }

  const downloadCSVTemplate = (module: string) => {
    const fields = getModuleFields(module)
    
    // Create three options: headers only, with one example row, or with multiple example rows
    const headers = fields.map(field => field.key)
    
    // Headers only CSV (most common use case)
    const headersOnlyContent = headers.join(',')
    
    // Create and download the headers-only CSV file
    const blob = new Blob([headersOnlyContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${module}_import_template.csv`)
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const downloadCSVWithExamples = (module: string) => {
    const fields = getModuleFields(module)
    const headers = fields.map(field => field.key)
    
    // Create example rows with realistic data
    const exampleRows = []
    
    if (module === 'customers') {
      exampleRows.push([
        'Acme Corporation', 'John Smith', 'john@acme.com', '(555) 123-4567',
        '123 Main Street', 'Suite 100', 'New York', 'NY', '10001', 'United States'
      ])
      exampleRows.push([
        'Global Industries', 'Jane Doe', 'jane@global.com', '(555) 987-6543',
        '456 Oak Avenue', '', 'Los Angeles', 'CA', '90210', 'United States'
      ])
    } else if (module === 'products') {
      exampleRows.push([
        'Premium Widget', 'WIDGET-001', 'High-quality industrial widget', 'Electronics',
        '199.99', '150.00', 'each', 'true'
      ])
      exampleRows.push([
        'Service Package A', 'SRV-PKG-A', 'Complete service package', 'Services',
        '500.00', '400.00', 'hour', 'false'
      ])
    } else if (module === 'inventory') {
      exampleRows.push([
        'WIDGET-001', 'MAIN', 'A-1-5', '100', '15', '85', '10', '500',
        '150.00', '145.00', '199.99', '25.0', '33.3', 'TAX', '8.25',
        'false', 'false', 'A', '14', '2024-01-01', '5.0',
        '', '0', '', '100', '150.00', 'Sales', 'Inventory Asset', 'COGS',
        'true', 'Main warehouse stock'
      ])
      exampleRows.push([
        'WIDGET-001', 'WH-002', 'B-2-3', '50', '5', '45', '5', '200',
        '150.00', '148.00', '199.99', '25.0', '33.3', 'TAX', '8.25',
        'true', 'true', 'A', '7', '2024-01-15', '2.0',
        'QB-123', '5', '2024-01-20', '50', '150.00', 'Sales', 'Inventory Asset', 'COGS',
        'true', 'Secondary warehouse with serial tracking'
      ])
    } else if (module === 'sales_orders') {
      // Sales order with header info repeated for each line
      exampleRows.push([
        'SO-2024-001', 'Acme Corporation', '', '2024-01-15', '2024-01-20', 'PO-12345', 'Office Renovation',
        '1', 'Premium Widget', '10', '199.99', 'High-quality widgets for office'
      ])
      exampleRows.push([
        'SO-2024-001', 'Acme Corporation', '', '2024-01-15', '2024-01-20', 'PO-12345', 'Office Renovation',
        '2', 'Service Package A', '5', '500.00', 'Installation services'
      ])
    } else {
      // Generic examples for other modules
      exampleRows.push(fields.map(field => {
        if (field.examples && field.examples.length > 0) {
          return field.examples[0]
        }
        switch (field.type) {
          case 'text': return field.required ? 'Required Text' : 'Sample Text'
          case 'number': return field.key.includes('price') || field.key.includes('cost') ? '99.99' : '1'
          case 'date': return '2024-01-15'
          case 'email': return 'example@company.com'
          case 'boolean': return 'true'
          default: return field.required ? 'REQUIRED' : 'Sample'
        }
      }))
    }
    
    const csvContent = [
      headers.join(','),
      ...exampleRows.map(row => row.join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${module}_template_with_examples.csv`)
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const copyColumnNames = (module: string) => {
    const fields = getModuleFields(module)
    const headers = fields.map(field => field.key).join(', ')
    
    navigator.clipboard.writeText(headers).then(() => {
      // You could add a toast notification here
      alert('Column names copied to clipboard!')
    }).catch(err => {
      console.error('Failed to copy: ', err)
    })
  }

  const getModules = () => {
    const moduleSet = new Set(templates.map(t => t.module))
    return Array.from(moduleSet)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Template Manager</h2>
          <p className="text-gray-600">Create and manage reusable import templates</p>
        </div>
        <Button onClick={handleCreateTemplate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Modules</option>
              {getModules().map(module => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || moduleFilter !== 'all' 
                    ? 'No templates match your current filters.'
                    : 'Create your first import template to get started.'}
                </p>
                <Button onClick={handleCreateTemplate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{template.name}</CardTitle>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {template.module}
                      </Badge>
                      {template.isPublic && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          Public
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {template.description && (
                  <p className="text-sm text-gray-600">{template.description}</p>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Fields:</span>
                    <span className="font-medium ml-2">{template.fieldMappings.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Used:</span>
                    <span className="font-medium ml-2">{template.timesUsed} times</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <span className="font-medium ml-2">{formatDate(template.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Updated:</span>
                    <span className="font-medium ml-2">{formatDate(template.updatedAt)}</span>
                  </div>
                </div>

                {template.lastUsed && (
                  <div className="text-sm text-gray-600">
                    Last used: {formatDate(template.lastUsed)}
                  </div>
                )}

                {/* Field Mappings Preview */}
                <div>
                  <h5 className="font-medium text-sm mb-2">Field Mappings ({template.fieldMappings.length})</h5>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {template.fieldMappings.slice(0, 5).map((mapping, index) => (
                      <div key={index} className="text-xs bg-gray-50 p-2 rounded flex items-center justify-between">
                        <span className="font-mono">{mapping.csvColumn}</span>
                        <span>→</span>
                        <span className="text-blue-600">{mapping.dbField}</span>
                        {mapping.required && (
                          <Badge className="bg-red-100 text-red-800 text-xs">Required</Badge>
                        )}
                      </div>
                    ))}
                    {template.fieldMappings.length > 5 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{template.fieldMappings.length - 5} more fields
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditTemplate(template)}
                    className="flex-1"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicateTemplate(template)}
                    className="flex-1"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportTemplate(template)}
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Label htmlFor="templateName">Template Name *</Label>
                <Input
                  id="templateName"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                  placeholder="Enter template name"
                />
              </div>

              <div>
                <Label htmlFor="templateModule">Module *</Label>
                <select
                  id="templateModule"
                  value={templateForm.module}
                  onChange={(e) => setTemplateForm({...templateForm, module: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select module</option>
                  <option value="customers">Customers</option>
                  <option value="vendors">Vendors</option>
                  <option value="products">Products</option>
                  <option value="inventory">Inventory</option>
                  <option value="sales_orders">Sales Orders</option>
                  <option value="purchase_orders">Purchase Orders</option>
                  <option value="estimates">Estimates</option>
                  <option value="invoices">Invoices</option>
                </select>
              </div>

              {/* CSV Template Guide */}
              {templateForm.module && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    CSV Template Guide for {getModuleName(templateForm.module)}
                  </h4>
                  <p className="text-sm text-blue-800 mb-4">
                    Use these exact column headings in your CSV file. Required fields are marked with *.
                  </p>
                  
                  <div className="max-h-64 overflow-y-auto bg-gray-50 rounded p-2">
                    <div className="grid gap-1">
                      {getModuleFields(templateForm.module).map((field) => (
                        <div key={field.key} className="flex items-center justify-between p-2 bg-white rounded text-xs border">
                          <div className="flex items-center gap-2 flex-1">
                            <code className="font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs min-w-fit">
                              {field.key}
                            </code>
                            {field.required && (
                              <Badge className="bg-red-100 text-red-700 text-xs px-1">*</Badge>
                            )}
                            <span className="text-gray-600 text-xs">{field.label}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs px-1 py-0">
                              {field.type}
                            </Badge>
                            {field.examples && field.examples.length > 0 && (
                              <span className="text-green-600 text-xs" title={`Example: ${field.examples[0]}`}>
                                📝
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <h5 className="font-medium text-yellow-800 text-sm mb-2">💡 Tips:</h5>
                    <ul className="text-xs text-yellow-700 space-y-1">
                      <li>• Use the exact column names shown above (case-sensitive)</li>
                      <li>• Include all required fields marked with *</li>
                      <li>• Save your file as CSV format (UTF-8 encoding recommended)</li>
                      <li>• First row should contain column headers</li>
                      {getModuleTips(templateForm.module).map((tip, index) => (
                        <li key={index}>• {tip}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => downloadCSVTemplate(templateForm.module)}
                      className="text-xs"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Empty Template
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => downloadCSVWithExamples(templateForm.module)}
                      className="text-xs"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      With Examples
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => copyColumnNames(templateForm.module)}
                      className="text-xs"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Columns
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="templateDescription">Description</Label>
                <Input
                  id="templateDescription"
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({...templateForm, description: e.target.value})}
                  placeholder="Optional description"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={templateForm.isPublic}
                  onChange={(e) => setTemplateForm({...templateForm, isPublic: e.target.checked})}
                />
                <Label htmlFor="isPublic" className="text-sm">
                  Make this template public (visible to all users)
                </Label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveTemplate} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {editingTemplate ? 'Update' : 'Create'} Template
                </Button>
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}