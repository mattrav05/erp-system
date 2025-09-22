'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowRight, 
  Settings, 
  Plus, 
  X, 
  Eye, 
  AlertCircle, 
  CheckCircle,
  Wand2
} from 'lucide-react'

interface FieldMapping {
  csvColumn: string
  dbField: string
  required?: boolean
  dataType?: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone' | 'currency'
  transform?: string
  defaultValue?: any
  maxLength?: number
  validValues?: any[]
}

interface FieldMappingEditorProps {
  headers: string[]
  mappings: FieldMapping[]
  module: string
  onMappingsChange: (mappings: FieldMapping[]) => void
  sampleData?: any[]
}

const MODULE_FIELDS: Record<string, any[]> = {
  customers: [
    { field: 'company_name', label: 'Company Name', required: true, type: 'string', maxLength: 255 },
    { field: 'contact_name', label: 'Contact Name', required: false, type: 'string', maxLength: 255 },
    { field: 'email', label: 'Email', required: false, type: 'email', maxLength: 255 },
    { field: 'phone', label: 'Phone', required: false, type: 'phone', maxLength: 50 },
    { field: 'address_line_1', label: 'Address Line 1', required: false, type: 'string', maxLength: 255 },
    { field: 'address_line_2', label: 'Address Line 2', required: false, type: 'string', maxLength: 255 },
    { field: 'city', label: 'City', required: false, type: 'string', maxLength: 100 },
    { field: 'state', label: 'State', required: false, type: 'string', maxLength: 50 },
    { field: 'zip_code', label: 'ZIP Code', required: false, type: 'string', maxLength: 20 },
    { field: 'country', label: 'Country', required: false, type: 'string', maxLength: 100 },
    { field: 'customer_type', label: 'Customer Type', required: false, type: 'string', validValues: ['RETAIL', 'WHOLESALE', 'DISTRIBUTOR'] },
    { field: 'payment_terms', label: 'Payment Terms', required: false, type: 'string', maxLength: 50 },
    { field: 'credit_limit', label: 'Credit Limit', required: false, type: 'currency' },
    { field: 'tax_exempt', label: 'Tax Exempt', required: false, type: 'boolean' },
    { field: 'notes', label: 'Notes', required: false, type: 'string' },
    { field: 'is_active', label: 'Active', required: false, type: 'boolean', defaultValue: true }
  ],
  vendors: [
    { field: 'vendor_name', label: 'Vendor Name', required: true, type: 'string', maxLength: 255 },
    { field: 'contact_name', label: 'Contact Name', required: false, type: 'string', maxLength: 255 },
    { field: 'email', label: 'Email', required: false, type: 'email', maxLength: 255 },
    { field: 'phone', label: 'Phone', required: false, type: 'phone', maxLength: 50 },
    { field: 'address_line_1', label: 'Address Line 1', required: false, type: 'string', maxLength: 255 },
    { field: 'city', label: 'City', required: false, type: 'string', maxLength: 100 },
    { field: 'state', label: 'State', required: false, type: 'string', maxLength: 50 },
    { field: 'zip_code', label: 'ZIP Code', required: false, type: 'string', maxLength: 20 },
    { field: 'payment_terms', label: 'Payment Terms', required: false, type: 'string', maxLength: 50 },
    { field: 'tax_id', label: 'Tax ID', required: false, type: 'string', maxLength: 50 },
    { field: 'is_active', label: 'Active', required: false, type: 'boolean', defaultValue: true }
  ],
  products: [
    { field: 'name', label: 'Product Name', required: true, type: 'string', maxLength: 255 },
    { field: 'sku', label: 'SKU', required: true, type: 'string', maxLength: 100 },
    { field: 'description', label: 'Description', required: false, type: 'string' },
    { field: 'category', label: 'Category', required: false, type: 'string', maxLength: 100 },
    { field: 'brand', label: 'Brand', required: false, type: 'string', maxLength: 100 },
    { field: 'cost', label: 'Cost', required: false, type: 'currency' },
    { field: 'price', label: 'Price', required: false, type: 'currency' },
    { field: 'weight', label: 'Weight', required: false, type: 'number' },
    { field: 'dimensions', label: 'Dimensions', required: false, type: 'string', maxLength: 100 },
    { field: 'track_inventory', label: 'Track Inventory', required: false, type: 'boolean', defaultValue: true },
    { field: 'is_active', label: 'Active', required: false, type: 'boolean', defaultValue: true }
  ],
  sales_orders: [
    // Header fields
    { field: 'so_number', label: 'Sales Order Number', required: true, type: 'string', maxLength: 50 },
    { field: 'customer_name', label: 'Customer Name', required: false, type: 'string' },
    { field: 'customer_id', label: 'Customer ID', required: false, type: 'string' },
    { field: 'sales_rep_name', label: 'Sales Rep Name', required: false, type: 'string' },
    { field: 'sales_rep_id', label: 'Sales Rep ID', required: false, type: 'string' },
    
    // Dates
    { field: 'order_date', label: 'Order Date', required: false, type: 'date' },
    { field: 'ship_date', label: 'Ship Date', required: false, type: 'date' },
    { field: 'due_date', label: 'Due Date', required: false, type: 'date' },
    
    // Reference info
    { field: 'reference_number', label: 'Reference Number', required: false, type: 'string', maxLength: 100 },
    { field: 'job_name', label: 'Job Name', required: false, type: 'string', maxLength: 200 },
    { field: 'source_estimate_number', label: 'Source Estimate Number', required: false, type: 'string' },
    
    // Billing address
    { field: 'bill_to_company', label: 'Bill To Company', required: false, type: 'string', maxLength: 200 },
    { field: 'bill_to_contact', label: 'Bill To Contact', required: false, type: 'string', maxLength: 100 },
    { field: 'bill_to_address_line_1', label: 'Bill To Address Line 1', required: false, type: 'string', maxLength: 200 },
    { field: 'bill_to_city', label: 'Bill To City', required: false, type: 'string', maxLength: 100 },
    { field: 'bill_to_state', label: 'Bill To State', required: false, type: 'string', maxLength: 50 },
    { field: 'bill_to_zip', label: 'Bill To ZIP', required: false, type: 'string', maxLength: 20 },
    { field: 'bill_to_country', label: 'Bill To Country', required: false, type: 'string', maxLength: 100 },
    
    // Shipping address
    { field: 'ship_to_company', label: 'Ship To Company', required: false, type: 'string', maxLength: 200 },
    { field: 'ship_to_contact', label: 'Ship To Contact', required: false, type: 'string', maxLength: 100 },
    { field: 'ship_to_address_line_1', label: 'Ship To Address Line 1', required: false, type: 'string', maxLength: 200 },
    { field: 'ship_to_city', label: 'Ship To City', required: false, type: 'string', maxLength: 100 },
    { field: 'ship_to_state', label: 'Ship To State', required: false, type: 'string', maxLength: 50 },
    { field: 'ship_to_zip', label: 'Ship To ZIP', required: false, type: 'string', maxLength: 20 },
    { field: 'ship_to_same_as_billing', label: 'Ship To Same as Billing', required: false, type: 'boolean' },
    
    // Financial
    { field: 'subtotal', label: 'Subtotal', required: false, type: 'currency' },
    { field: 'tax_rate', label: 'Tax Rate (%)', required: false, type: 'number' },
    { field: 'tax_amount', label: 'Tax Amount', required: false, type: 'currency' },
    { field: 'shipping_amount', label: 'Shipping Amount', required: false, type: 'currency' },
    { field: 'discount_amount', label: 'Discount Amount', required: false, type: 'currency' },
    { field: 'discount_percent', label: 'Discount Percent', required: false, type: 'number' },
    { field: 'total_amount', label: 'Total Amount', required: false, type: 'currency' },
    
    // Status
    { field: 'status', label: 'Status', required: false, type: 'string', 
      validValues: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'SHIPPED', 'DELIVERED', 'INVOICED', 'CANCELLED', 'ON_HOLD'] },
    
    // Notes
    { field: 'internal_notes', label: 'Internal Notes', required: false, type: 'string' },
    { field: 'customer_notes', label: 'Customer Notes', required: false, type: 'string' },
    { field: 'terms_and_conditions', label: 'Terms and Conditions', required: false, type: 'string' },
    
    // Line Items
    { field: 'line_number', label: 'Line Number', required: false, type: 'number' },
    { field: 'product_name', label: 'Product Name', required: false, type: 'string' },
    { field: 'product_id', label: 'Product ID', required: false, type: 'string' },
    { field: 'item_code', label: 'Item Code', required: false, type: 'string' },
    { field: 'line_description', label: 'Line Description', required: false, type: 'string' },
    { field: 'quantity', label: 'Quantity', required: false, type: 'number' },
    { field: 'unit_price', label: 'Unit Price', required: false, type: 'currency' },
    { field: 'unit_of_measure', label: 'Unit of Measure', required: false, type: 'string' },
    { field: 'line_discount_percent', label: 'Line Discount %', required: false, type: 'number' },
    { field: 'line_discount_amount', label: 'Line Discount Amount', required: false, type: 'currency' },
    { field: 'line_tax_code', label: 'Line Tax Code', required: false, type: 'string' },
    { field: 'line_tax_rate', label: 'Line Tax Rate', required: false, type: 'number' },
    { field: 'line_tax_amount', label: 'Line Tax Amount', required: false, type: 'currency' },
    { field: 'line_total', label: 'Line Total', required: false, type: 'currency' },
    { field: 'fulfillment_status', label: 'Fulfillment Status', required: false, type: 'string',
      validValues: ['PENDING', 'PARTIAL', 'COMPLETE', 'CANCELLED'] }
  ],
  purchase_orders: [
    // Header fields
    { field: 'po_number', label: 'Purchase Order Number', required: true, type: 'string', maxLength: 50 },
    { field: 'vendor_name', label: 'Vendor Name', required: false, type: 'string' },
    { field: 'vendor_id', label: 'Vendor ID', required: false, type: 'string' },
    { field: 'sales_rep_name', label: 'Sales Rep Name', required: false, type: 'string' },
    { field: 'sales_rep_id', label: 'Sales Rep ID', required: false, type: 'string' },
    
    // Dates
    { field: 'order_date', label: 'Order Date', required: false, type: 'date' },
    { field: 'expected_delivery_date', label: 'Expected Delivery Date', required: false, type: 'date' },
    { field: 'ship_date', label: 'Ship Date', required: false, type: 'date' },
    
    // Reference info
    { field: 'vendor_reference', label: 'Vendor Reference', required: false, type: 'string', maxLength: 100 },
    
    // Billing address
    { field: 'bill_to_company_name', label: 'Bill To Company', required: false, type: 'string', maxLength: 200 },
    { field: 'bill_to_contact_name', label: 'Bill To Contact', required: false, type: 'string', maxLength: 100 },
    { field: 'bill_to_address_line_1', label: 'Bill To Address Line 1', required: false, type: 'string', maxLength: 200 },
    { field: 'bill_to_city', label: 'Bill To City', required: false, type: 'string', maxLength: 100 },
    { field: 'bill_to_state', label: 'Bill To State', required: false, type: 'string', maxLength: 50 },
    { field: 'bill_to_zip_code', label: 'Bill To ZIP', required: false, type: 'string', maxLength: 20 },
    { field: 'bill_to_country', label: 'Bill To Country', required: false, type: 'string', maxLength: 100 },
    
    // Shipping address
    { field: 'ship_to_company_name', label: 'Ship To Company', required: false, type: 'string', maxLength: 200 },
    { field: 'ship_to_contact_name', label: 'Ship To Contact', required: false, type: 'string', maxLength: 100 },
    { field: 'ship_to_address_line_1', label: 'Ship To Address Line 1', required: false, type: 'string', maxLength: 200 },
    { field: 'ship_to_city', label: 'Ship To City', required: false, type: 'string', maxLength: 100 },
    { field: 'ship_to_state', label: 'Ship To State', required: false, type: 'string', maxLength: 50 },
    { field: 'ship_to_zip_code', label: 'Ship To ZIP', required: false, type: 'string', maxLength: 20 },
    { field: 'ship_to_same_as_billing', label: 'Ship To Same as Billing', required: false, type: 'boolean' },
    
    // Financial
    { field: 'subtotal', label: 'Subtotal', required: false, type: 'currency' },
    { field: 'tax_rate', label: 'Tax Rate (%)', required: false, type: 'number' },
    { field: 'tax_amount', label: 'Tax Amount', required: false, type: 'currency' },
    { field: 'total_amount', label: 'Total Amount', required: false, type: 'currency' },
    
    // Status
    { field: 'status', label: 'Status', required: false, type: 'string', 
      validValues: ['PENDING', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CANCELLED', 'ON_HOLD'] },
    
    // Notes
    { field: 'internal_notes', label: 'Internal Notes', required: false, type: 'string' },
    { field: 'vendor_notes', label: 'Vendor Notes', required: false, type: 'string' },
    { field: 'terms_and_conditions', label: 'Terms and Conditions', required: false, type: 'string' },
    
    // Source tracking
    { field: 'source_sales_order_number', label: 'Source Sales Order Number', required: false, type: 'string' },
    { field: 'source_sales_order_id', label: 'Source Sales Order ID', required: false, type: 'string' },
    
    // Line Items
    { field: 'line_number', label: 'Line Number', required: false, type: 'number' },
    { field: 'product_name', label: 'Product Name', required: false, type: 'string' },
    { field: 'product_id', label: 'Product ID', required: false, type: 'string' },
    { field: 'item_code', label: 'Item Code', required: false, type: 'string' },
    { field: 'line_description', label: 'Line Description', required: false, type: 'string' },
    { field: 'quantity', label: 'Quantity', required: false, type: 'number' },
    { field: 'unit_price', label: 'Unit Price', required: false, type: 'currency' },
    { field: 'unit_of_measure', label: 'Unit of Measure', required: false, type: 'string' },
    { field: 'line_total', label: 'Line Total', required: false, type: 'currency' },
    { field: 'tax_code', label: 'Tax Code', required: false, type: 'string' },
    { field: 'line_tax_rate', label: 'Line Tax Rate', required: false, type: 'number' },
    { field: 'line_tax_amount', label: 'Line Tax Amount', required: false, type: 'currency' },
    { field: 'quantity_received', label: 'Quantity Received', required: false, type: 'number' },
    { field: 'quantity_reserved', label: 'Quantity Reserved', required: false, type: 'number' }
  ],
  estimates: [
    // Header fields
    { field: 'estimate_number', label: 'Estimate Number', required: true, type: 'string', maxLength: 50 },
    { field: 'customer_name', label: 'Customer Name', required: false, type: 'string' },
    { field: 'customer_id', label: 'Customer ID', required: false, type: 'string' },
    { field: 'sales_rep_name', label: 'Sales Rep Name', required: false, type: 'string' },
    { field: 'sales_rep_id', label: 'Sales Rep ID', required: false, type: 'string' },
    { field: 'template_name', label: 'Template Name', required: false, type: 'string' },
    { field: 'template_id', label: 'Template ID', required: false, type: 'string' },
    
    // Dates
    { field: 'estimate_date', label: 'Estimate Date', required: false, type: 'date' },
    { field: 'expiration_date', label: 'Expiration Date', required: false, type: 'date' },
    
    // Reference info
    { field: 'reference_number', label: 'Reference Number', required: false, type: 'string', maxLength: 100 },
    { field: 'job_name', label: 'Job Name', required: false, type: 'string', maxLength: 200 },
    
    // Billing address
    { field: 'bill_to_company', label: 'Bill To Company', required: false, type: 'string', maxLength: 200 },
    { field: 'bill_to_contact', label: 'Bill To Contact', required: false, type: 'string', maxLength: 100 },
    { field: 'bill_to_address_line_1', label: 'Bill To Address Line 1', required: false, type: 'string', maxLength: 200 },
    { field: 'bill_to_city', label: 'Bill To City', required: false, type: 'string', maxLength: 100 },
    { field: 'bill_to_state', label: 'Bill To State', required: false, type: 'string', maxLength: 50 },
    { field: 'bill_to_zip', label: 'Bill To ZIP', required: false, type: 'string', maxLength: 20 },
    { field: 'bill_to_country', label: 'Bill To Country', required: false, type: 'string', maxLength: 100 },
    
    // Shipping address
    { field: 'ship_to_company', label: 'Ship To Company', required: false, type: 'string', maxLength: 200 },
    { field: 'ship_to_contact', label: 'Ship To Contact', required: false, type: 'string', maxLength: 100 },
    { field: 'ship_to_address_line_1', label: 'Ship To Address Line 1', required: false, type: 'string', maxLength: 200 },
    { field: 'ship_to_city', label: 'Ship To City', required: false, type: 'string', maxLength: 100 },
    { field: 'ship_to_state', label: 'Ship To State', required: false, type: 'string', maxLength: 50 },
    { field: 'ship_to_zip', label: 'Ship To ZIP', required: false, type: 'string', maxLength: 20 },
    { field: 'ship_to_same_as_billing', label: 'Ship To Same as Billing', required: false, type: 'boolean' },
    
    // Financial
    { field: 'subtotal', label: 'Subtotal', required: false, type: 'currency' },
    { field: 'tax_rate', label: 'Tax Rate (%)', required: false, type: 'number' },
    { field: 'tax_amount', label: 'Tax Amount', required: false, type: 'currency' },
    { field: 'shipping_amount', label: 'Shipping Amount', required: false, type: 'currency' },
    { field: 'discount_amount', label: 'Discount Amount', required: false, type: 'currency' },
    { field: 'total_amount', label: 'Total Amount', required: false, type: 'currency' },
    
    // Status
    { field: 'status', label: 'Status', required: false, type: 'string', 
      validValues: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'] },
    
    // Notes
    { field: 'internal_notes', label: 'Internal Notes', required: false, type: 'string' },
    { field: 'customer_notes', label: 'Customer Notes', required: false, type: 'string' },
    { field: 'terms_and_conditions', label: 'Terms and Conditions', required: false, type: 'string' },
    
    // Line Items
    { field: 'line_number', label: 'Line Number', required: false, type: 'number' },
    { field: 'item_type', label: 'Item Type', required: false, type: 'string',
      validValues: ['PRODUCT', 'SERVICE', 'LABOR', 'MATERIAL', 'MISC'] },
    { field: 'product_name', label: 'Product Name', required: false, type: 'string' },
    { field: 'product_id', label: 'Product ID', required: false, type: 'string' },
    { field: 'sku', label: 'SKU', required: false, type: 'string' },
    { field: 'line_description', label: 'Line Description', required: false, type: 'string' },
    { field: 'long_description', label: 'Long Description', required: false, type: 'string' },
    { field: 'quantity', label: 'Quantity', required: false, type: 'number' },
    { field: 'unit_of_measure', label: 'Unit of Measure', required: false, type: 'string' },
    { field: 'unit_price', label: 'Unit Price', required: false, type: 'currency' },
    { field: 'line_total', label: 'Line Total', required: false, type: 'currency' },
    { field: 'discount_type', label: 'Discount Type', required: false, type: 'string',
      validValues: ['NONE', 'PERCENT', 'AMOUNT'] },
    { field: 'discount_value', label: 'Discount Value', required: false, type: 'number' },
    { field: 'discounted_total', label: 'Discounted Total', required: false, type: 'currency' },
    { field: 'is_taxable', label: 'Is Taxable', required: false, type: 'boolean' },
    { field: 'tax_code', label: 'Tax Code', required: false, type: 'string' },
    { field: 'line_notes', label: 'Line Notes', required: false, type: 'string' },
    { field: 'sort_order', label: 'Sort Order', required: false, type: 'number' }
  ]
}

const TRANSFORM_OPTIONS = [
  { value: '', label: 'No transformation' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'trim', label: 'Trim whitespace' },
  { value: 'numbers_only', label: 'Numbers only' },
  { value: 'phone_normalize', label: 'Normalize phone' },
  { value: 'currency_to_number', label: 'Currency to number' },
  { value: 'boolean_yes_no', label: 'Yes/No to boolean' }
]

export default function FieldMappingEditor({
  headers,
  mappings,
  module,
  onMappingsChange,
  sampleData = []
}: FieldMappingEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  
  const moduleFields = MODULE_FIELDS[module] || []
  const mappedFields = new Set(mappings.filter(m => m.dbField).map(m => m.dbField))
  
  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    const newMappings = [...mappings]
    newMappings[index] = { ...newMappings[index], ...updates }
    onMappingsChange(newMappings)
  }

  const addMapping = () => {
    const unmappedHeaders = headers.filter(h => !mappings.some(m => m.csvColumn === h))
    if (unmappedHeaders.length === 0) return
    
    const newMapping: FieldMapping = {
      csvColumn: unmappedHeaders[0],
      dbField: '',
      required: false
    }
    onMappingsChange([...mappings, newMapping])
  }

  const removeMapping = (index: number) => {
    const newMappings = mappings.filter((_, i) => i !== index)
    onMappingsChange(newMappings)
  }

  const getFieldInfo = (dbField: string) => {
    return moduleFields.find(f => f.field === dbField)
  }

  const getMappingStatus = (mapping: FieldMapping) => {
    if (!mapping.dbField) return 'unmapped'
    
    const fieldInfo = getFieldInfo(mapping.dbField)
    if (fieldInfo?.required) return 'required'
    
    return 'mapped'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'required':
        return <Badge className="bg-red-100 text-red-800 text-xs">Required</Badge>
      case 'mapped':
        return <Badge className="bg-green-100 text-green-800 text-xs">Mapped</Badge>
      case 'unmapped':
        return <Badge className="bg-gray-100 text-gray-800 text-xs">Unmapped</Badge>
      default:
        return null
    }
  }

  const getSampleValue = (csvColumn: string) => {
    if (!sampleData.length) return null
    const sample = sampleData.find(row => row[csvColumn])
    return sample?.[csvColumn] || sampleData[0]?.[csvColumn] || ''
  }

  const autoMapFields = () => {
    const newMappings = [...mappings]
    
    newMappings.forEach((mapping, index) => {
      if (mapping.dbField) return // Already mapped
      
      const lowerColumn = mapping.csvColumn.toLowerCase()
      const matchingField = moduleFields.find(field => {
        const fieldPatterns = getFieldPatterns(field.field)
        return fieldPatterns.some(pattern => lowerColumn.includes(pattern))
      })
      
      if (matchingField) {
        newMappings[index] = {
          ...mapping,
          dbField: matchingField.field,
          dataType: matchingField.type,
          required: matchingField.required,
          maxLength: matchingField.maxLength,
          validValues: matchingField.validValues,
          defaultValue: matchingField.defaultValue
        }
      }
    })
    
    onMappingsChange(newMappings)
  }

  const getFieldPatterns = (field: string): string[] => {
    const patterns: Record<string, string[]> = {
      company_name: ['company', 'business', 'organization'],
      vendor_name: ['vendor', 'supplier', 'company'],
      contact_name: ['contact', 'name', 'person'],
      email: ['email', 'e-mail', 'mail'],
      phone: ['phone', 'telephone', 'tel'],
      address_line_1: ['address', 'street', 'addr'],
      city: ['city', 'town'],
      state: ['state', 'province'],
      zip_code: ['zip', 'postal', 'postcode'],
      sku: ['sku', 'code', 'item'],
      name: ['name', 'title', 'product'],
      cost: ['cost', 'purchase'],
      price: ['price', 'sell', 'retail'],
      credit_limit: ['credit', 'limit'],
      is_active: ['active', 'enabled'],
      tax_exempt: ['tax', 'exempt']
    }
    
    return patterns[field] || [field]
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" onClick={autoMapFields}>
            <Wand2 className="w-4 h-4 mr-2" />
            Auto Map Fields
          </Button>
          <Button variant="outline" onClick={addMapping} disabled={mappings.length >= headers.length}>
            <Plus className="w-4 h-4 mr-2" />
            Add Mapping
          </Button>
        </div>
        <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
          <Eye className="w-4 h-4 mr-2" />
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </Button>
      </div>

      {/* Mapping Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapping Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{mappings.length}</p>
              <p className="text-sm text-gray-600">Total Columns</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{mappings.filter(m => m.dbField).length}</p>
              <p className="text-sm text-gray-600">Mapped</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {moduleFields.filter(f => f.required && !mappedFields.has(f.field)).length}
              </p>
              <p className="text-sm text-gray-600">Missing Required</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Mappings */}
      <div className="space-y-4">
        {mappings.map((mapping, index) => (
          <Card key={index} className="relative">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* CSV Column */}
                <div className="flex-1">
                  <Label className="text-sm font-medium">CSV Column</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="font-mono text-xs">
                      {mapping.csvColumn}
                    </Badge>
                    {sampleData.length > 0 && (
                      <span className="text-xs text-gray-500">
                        e.g., "{getSampleValue(mapping.csvColumn)}"
                      </span>
                    )}
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />

                {/* Database Field */}
                <div className="flex-1">
                  <Label className="text-sm font-medium">Database Field</Label>
                  <select
                    value={mapping.dbField}
                    onChange={(e) => {
                      const fieldInfo = getFieldInfo(e.target.value)
                      updateMapping(index, {
                        dbField: e.target.value,
                        dataType: fieldInfo?.type,
                        required: fieldInfo?.required,
                        maxLength: fieldInfo?.maxLength,
                        validValues: fieldInfo?.validValues,
                        defaultValue: fieldInfo?.defaultValue
                      })
                    }}
                    className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Select field...</option>
                    {moduleFields.map((field) => (
                      <option key={field.field} value={field.field} disabled={mappedFields.has(field.field) && mapping.dbField !== field.field}>
                        {field.label} {field.required && '*'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status and Transform */}
                <div className="flex-1">
                  <Label className="text-sm font-medium">Transform</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <select
                      value={mapping.transform || ''}
                      onChange={(e) => updateMapping(index, { transform: e.target.value || undefined })}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                      disabled={!mapping.dbField}
                    >
                      {TRANSFORM_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {getStatusBadge(getMappingStatus(mapping))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMapping(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Field Info */}
              {mapping.dbField && (
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
                    {getFieldInfo(mapping.dbField)?.type && (
                      <div>
                        <span className="font-medium">Type:</span> {getFieldInfo(mapping.dbField)?.type}
                      </div>
                    )}
                    {getFieldInfo(mapping.dbField)?.maxLength && (
                      <div>
                        <span className="font-medium">Max Length:</span> {getFieldInfo(mapping.dbField)?.maxLength}
                      </div>
                    )}
                    {getFieldInfo(mapping.dbField)?.validValues && (
                      <div>
                        <span className="font-medium">Valid Values:</span> {getFieldInfo(mapping.dbField)?.validValues.join(', ')}
                      </div>
                    )}
                    {getFieldInfo(mapping.dbField)?.defaultValue !== undefined && (
                      <div>
                        <span className="font-medium">Default:</span> {String(getFieldInfo(mapping.dbField)?.defaultValue)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Required Fields Warning */}
      {moduleFields.filter(f => f.required && !mappedFields.has(f.field)).length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Missing Required Fields</h4>
                <p className="text-sm text-red-700 mt-1">
                  The following required fields are not mapped:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {moduleFields
                    .filter(f => f.required && !mappedFields.has(f.field))
                    .map(field => (
                      <Badge key={field.field} className="bg-red-100 text-red-800">
                        {field.label}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {showPreview && sampleData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {mappings
                      .filter(m => m.dbField)
                      .map((mapping) => (
                        <th key={mapping.csvColumn} className="text-left p-2 font-medium">
                          {getFieldInfo(mapping.dbField)?.label || mapping.dbField}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleData.slice(0, 3).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b">
                      {mappings
                        .filter(m => m.dbField)
                        .map((mapping) => (
                          <td key={mapping.csvColumn} className="p-2">
                            {row[mapping.csvColumn] || '-'}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}