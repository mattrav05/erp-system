'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Download, 
  FileText, 
  Settings, 
  Database,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye
} from 'lucide-react'
import { generateCSV } from '@/lib/csv-utils'
import { ExportService } from '@/lib/export-service'

interface ExportField {
  field: string
  label: string
  selected: boolean
  type?: string
}

const MODULE_EXPORT_FIELDS: Record<string, ExportField[]> = {
  customers: [
    { field: 'company_name', label: 'Company Name', selected: true, type: 'string' },
    { field: 'contact_name', label: 'Contact Name', selected: true, type: 'string' },
    { field: 'email', label: 'Email', selected: true, type: 'email' },
    { field: 'phone', label: 'Phone', selected: true, type: 'phone' },
    { field: 'address_line_1', label: 'Address Line 1', selected: false, type: 'string' },
    { field: 'address_line_2', label: 'Address Line 2', selected: false, type: 'string' },
    { field: 'city', label: 'City', selected: false, type: 'string' },
    { field: 'state', label: 'State', selected: false, type: 'string' },
    { field: 'zip_code', label: 'ZIP Code', selected: false, type: 'string' },
    { field: 'country', label: 'Country', selected: false, type: 'string' },
    { field: 'customer_type', label: 'Customer Type', selected: true, type: 'string' },
    { field: 'payment_terms', label: 'Payment Terms', selected: false, type: 'string' },
    { field: 'credit_limit', label: 'Credit Limit', selected: false, type: 'currency' },
    { field: 'tax_exempt', label: 'Tax Exempt', selected: false, type: 'boolean' },
    { field: 'is_active', label: 'Active', selected: true, type: 'boolean' },
    { field: 'created_at', label: 'Created Date', selected: false, type: 'date' }
  ],
  vendors: [
    { field: 'vendor_name', label: 'Vendor Name', selected: true, type: 'string' },
    { field: 'contact_name', label: 'Contact Name', selected: true, type: 'string' },
    { field: 'email', label: 'Email', selected: true, type: 'email' },
    { field: 'phone', label: 'Phone', selected: true, type: 'phone' },
    { field: 'address_line_1', label: 'Address Line 1', selected: false, type: 'string' },
    { field: 'city', label: 'City', selected: false, type: 'string' },
    { field: 'state', label: 'State', selected: false, type: 'string' },
    { field: 'zip_code', label: 'ZIP Code', selected: false, type: 'string' },
    { field: 'payment_terms', label: 'Payment Terms', selected: false, type: 'string' },
    { field: 'tax_id', label: 'Tax ID', selected: false, type: 'string' },
    { field: 'is_active', label: 'Active', selected: true, type: 'boolean' },
    { field: 'created_at', label: 'Created Date', selected: false, type: 'date' }
  ],
  products: [
    { field: 'name', label: 'Product Name', selected: true, type: 'string' },
    { field: 'sku', label: 'SKU', selected: true, type: 'string' },
    { field: 'description', label: 'Description', selected: false, type: 'string' },
    { field: 'category', label: 'Category', selected: true, type: 'string' },
    { field: 'brand', label: 'Brand', selected: false, type: 'string' },
    { field: 'cost', label: 'Cost', selected: true, type: 'currency' },
    { field: 'price', label: 'Price', selected: true, type: 'currency' },
    { field: 'weight', label: 'Weight', selected: false, type: 'number' },
    { field: 'track_inventory', label: 'Track Inventory', selected: false, type: 'boolean' },
    { field: 'is_active', label: 'Active', selected: true, type: 'boolean' }
  ],
  inventory: [
    // Core Product Info
    { field: 'product_sku', label: 'Product SKU', selected: true, type: 'string' },
    { field: 'product_name', label: 'Product Name', selected: true, type: 'string' },
    { field: 'product_category', label: 'Product Category', selected: false, type: 'string' },
    
    // Location & Storage
    { field: 'location_code', label: 'Location/Warehouse', selected: true, type: 'string' },
    { field: 'bin_location', label: 'Bin Location', selected: false, type: 'string' },
    
    // Quantities
    { field: 'quantity_on_hand', label: 'Quantity on Hand', selected: true, type: 'number' },
    { field: 'quantity_allocated', label: 'Quantity Allocated', selected: true, type: 'number' },
    { field: 'quantity_available', label: 'Quantity Available', selected: true, type: 'number' },
    { field: 'safety_stock', label: 'Safety Stock', selected: false, type: 'number' },
    { field: 'max_stock_level', label: 'Max Stock Level', selected: false, type: 'number' },
    
    // Costing & Pricing
    { field: 'weighted_average_cost', label: 'Weighted Avg Cost', selected: true, type: 'currency' },
    { field: 'last_cost', label: 'Last Cost', selected: false, type: 'currency' },
    { field: 'sales_price', label: 'Sales Price', selected: true, type: 'currency' },
    { field: 'margin_percent', label: 'Margin %', selected: false, type: 'percentage' },
    { field: 'markup_percent', label: 'Markup %', selected: false, type: 'percentage' },
    
    // Inventory Value Calculations
    { field: 'inventory_value', label: 'Inventory Value (calculated)', selected: false, type: 'currency' },
    { field: 'available_value', label: 'Available Value (calculated)', selected: false, type: 'currency' },
    
    // Tax & Accounting
    { field: 'default_tax_code', label: 'Tax Code', selected: false, type: 'string' },
    { field: 'default_tax_rate', label: 'Tax Rate %', selected: false, type: 'percentage' },
    { field: 'income_account', label: 'Income Account (QB)', selected: false, type: 'string' },
    { field: 'asset_account', label: 'Asset Account (QB)', selected: false, type: 'string' },
    { field: 'expense_account', label: 'Expense Account (QB)', selected: false, type: 'string' },
    
    // Tracking & Classification
    { field: 'track_serial_numbers', label: 'Track Serial Numbers', selected: false, type: 'boolean' },
    { field: 'track_lot_numbers', label: 'Track Lot Numbers', selected: false, type: 'boolean' },
    { field: 'abc_classification', label: 'ABC Classification', selected: false, type: 'string' },
    
    // Management Fields
    { field: 'lead_time_days', label: 'Lead Time (Days)', selected: false, type: 'number' },
    { field: 'last_physical_count_date', label: 'Last Count Date', selected: false, type: 'date' },
    { field: 'variance_tolerance_percent', label: 'Variance Tolerance %', selected: false, type: 'percentage' },
    
    // Stock Status Indicators
    { field: 'stock_status', label: 'Stock Status', selected: true, type: 'string' },
    { field: 'reorder_needed', label: 'Reorder Needed', selected: false, type: 'boolean' },
    { field: 'days_of_supply', label: 'Days of Supply (calculated)', selected: false, type: 'number' },
    
    // QuickBooks Integration
    { field: 'qb_item_id', label: 'QB Item ID', selected: false, type: 'string' },
    { field: 'qb_sync_status', label: 'QB Sync Status', selected: false, type: 'string' },
    { field: 'qb_last_sync', label: 'QB Last Sync', selected: false, type: 'date' },
    { field: 'qb_quantity_on_hand', label: 'QB Quantity', selected: false, type: 'number' },
    { field: 'qb_quantity_variance', label: 'QB Quantity Variance', selected: false, type: 'number' },
    { field: 'qb_average_cost', label: 'QB Average Cost', selected: false, type: 'currency' },
    
    // Status & Notes
    { field: 'is_active', label: 'Active Status', selected: true, type: 'boolean' },
    { field: 'notes', label: 'Notes', selected: false, type: 'string' },
    { field: 'created_at', label: 'Created Date', selected: false, type: 'date' },
    { field: 'updated_at', label: 'Last Updated', selected: false, type: 'date' }
  ]
}

const AVAILABLE_MODULES = [
  { id: 'customers', name: 'Customers', icon: '👥', description: 'Export customer data' },
  { id: 'vendors', name: 'Vendors', icon: '🏭', description: 'Export vendor information' },
  { id: 'products', name: 'Products', icon: '📦', description: 'Export product catalog' },
  { id: 'inventory', name: 'Inventory', icon: '📊', description: 'Export inventory levels' },
  { id: 'sales_orders', name: 'Sales Orders', icon: '📋', description: 'Export sales orders' },
  { id: 'purchase_orders', name: 'Purchase Orders', icon: '🛒', description: 'Export purchase orders' },
  { id: 'estimates', name: 'Estimates', icon: '💰', description: 'Export estimates' },
  { id: 'invoices', name: 'Invoices', icon: '🧾', description: 'Export invoices' }
]

export default function ExportWizard() {
  const [selectedModule, setSelectedModule] = useState('')
  const [exportFields, setExportFields] = useState<ExportField[]>([])
  const [exportName, setExportName] = useState('')
  const [includeHeaders, setIncludeHeaders] = useState(true)
  const [delimiter, setDelimiter] = useState(',')
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY')
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<any>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (selectedModule && MODULE_EXPORT_FIELDS[selectedModule]) {
      setExportFields([...MODULE_EXPORT_FIELDS[selectedModule]])
      setExportName(`${selectedModule}_export_${new Date().toISOString().split('T')[0]}`)
    }
  }, [selectedModule])

  const handleModuleSelect = (moduleId: string) => {
    setSelectedModule(moduleId)
    setExportResult(null)
  }

  const handleFieldToggle = (fieldIndex: number) => {
    const newFields = [...exportFields]
    newFields[fieldIndex].selected = !newFields[fieldIndex].selected
    setExportFields(newFields)
  }

  const handleSelectAll = () => {
    const newFields = exportFields.map(field => ({ ...field, selected: true }))
    setExportFields(newFields)
  }

  const handleSelectNone = () => {
    const newFields = exportFields.map(field => ({ ...field, selected: false }))
    setExportFields(newFields)
  }

  const handlePreview = async () => {
    if (!selectedModule) return

    try {
      setIsExporting(true)
      
      // Simulate fetching preview data
      const sampleData = generateSampleData(selectedModule, 5)
      setPreviewData(sampleData)
      setShowPreview(true)
      
    } catch (error) {
      console.error('Preview error:', error)
      alert('Error generating preview')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExport = async () => {
    if (!selectedModule || !exportFields.some(f => f.selected)) {
      alert('Please select a module and at least one field to export')
      return
    }

    try {
      setIsExporting(true)
      setExportResult(null)
      
      console.log(`📤 Starting export for ${selectedModule}`)
      
      // Use the real export service instead of mock data
      const csvContent = await ExportService.exportModule(selectedModule, exportFields, {
        delimiter,
        includeHeaders
      });
      
      // Count records (subtract 1 for header if included, -1 for empty last line)
      const lines = csvContent.split('\n').filter(line => line.trim() !== '');
      const recordCount = lines.length - (includeHeaders ? 1 : 0);
      
      // Download the file
      const filename = `${exportName || selectedModule}_export_${new Date().toISOString().split('T')[0]}.csv`;
      ExportService.downloadCSV(csvContent, filename);
      
      setExportResult({
        success: true,
        fileName: filename,
        recordCount: recordCount,
        fieldCount: exportFields.filter(f => f.selected).length
      })
      
      console.log('✅ Export completed successfully')
      
    } catch (error) {
      console.error('❌ Export error:', error)
      setExportResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsExporting(false)
    }
  }

  const generateSampleData = (module: string, count: number) => {
    // Generate sample data based on module
    const data = []
    
    for (let i = 1; i <= count; i++) {
      switch (module) {
        case 'customers':
          data.push({
            company_name: `Company ${i}`,
            contact_name: `Contact ${i}`,
            email: `contact${i}@company${i}.com`,
            phone: `(555) ${String(i).padStart(3, '0')}-${String(i).padStart(4, '0')}`,
            address_line_1: `${i} Business St`,
            city: 'Business City',
            state: 'BC',
            zip_code: String(12345 + i),
            customer_type: i % 3 === 0 ? 'WHOLESALE' : 'RETAIL',
            payment_terms: 'Net 30',
            credit_limit: (i * 1000) + Math.random() * 10000,
            tax_exempt: i % 10 === 0,
            is_active: true,
            created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
          })
          break
        case 'vendors':
          data.push({
            vendor_name: `Vendor ${i}`,
            contact_name: `Vendor Contact ${i}`,
            email: `vendor${i}@supplier${i}.com`,
            phone: `(555) ${String(i + 100).padStart(3, '0')}-${String(i).padStart(4, '0')}`,
            address_line_1: `${i} Industrial Ave`,
            city: 'Industrial City',
            state: 'IC',
            zip_code: String(54321 + i),
            payment_terms: i % 2 === 0 ? 'Net 15' : 'Net 30',
            tax_id: `TAX${String(i).padStart(6, '0')}`,
            is_active: true,
            created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
          })
          break
        case 'products':
          data.push({
            name: `Product ${i}`,
            sku: `SKU-${String(i).padStart(4, '0')}`,
            description: `Description for product ${i}`,
            category: `Category ${Math.ceil(i / 10)}`,
            brand: `Brand ${Math.ceil(i / 5)}`,
            cost: Math.round((Math.random() * 50 + 10) * 100) / 100,
            price: Math.round((Math.random() * 100 + 20) * 100) / 100,
            weight: Math.round(Math.random() * 10 * 100) / 100,
            track_inventory: i % 5 !== 0,
            is_active: true
          })
          break
        default:
          data.push({ id: i, name: `Item ${i}` })
      }
    }
    
    return data
  }

  return (
    <div className="space-y-6">
      {/* Module Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Module to Export</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {AVAILABLE_MODULES.map((module) => (
              <Card
                key={module.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedModule === module.id ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                }`}
                onClick={() => handleModuleSelect(module.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-2xl mb-2">{module.icon}</div>
                  <h3 className="font-medium text-sm">{module.name}</h3>
                  <p className="text-xs text-gray-600 mt-1">{module.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Field Selection */}
      {selectedModule && exportFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Select Fields to Export</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleSelectNone}>
                  Select None
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exportFields.map((field, index) => (
                <div key={field.field} className="flex items-center space-x-2">
                  <Checkbox
                    id={field.field}
                    checked={field.selected}
                    onCheckedChange={() => handleFieldToggle(index)}
                  />
                  <label
                    htmlFor={field.field}
                    className="flex-1 text-sm font-medium cursor-pointer flex items-center gap-2"
                  >
                    {field.label}
                    {field.type && (
                      <Badge variant="outline" className="text-xs">
                        {field.type}
                      </Badge>
                    )}
                  </label>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">
                Selected: <strong>{exportFields.filter(f => f.selected).length}</strong> of {exportFields.length} fields
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Settings */}
      {selectedModule && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Export Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="exportName">File Name</Label>
                <Input
                  id="exportName"
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                  placeholder="Enter export file name"
                />
              </div>
              
              <div>
                <Label htmlFor="delimiter">Delimiter</Label>
                <select
                  id="delimiter"
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="\t">Tab</option>
                  <option value="|">Pipe (|)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeHeaders"
                checked={includeHeaders}
                onCheckedChange={(checked) => setIncludeHeaders(checked === true)}
              />
              <label htmlFor="includeHeaders" className="text-sm">
                Include column headers in export
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {selectedModule && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={isExporting || !exportFields.some(f => f.selected)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              
              <Button
                onClick={handleExport}
                disabled={isExporting || !exportFields.some(f => f.selected)}
                className="bg-green-600 hover:bg-green-700"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export to CSV
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {showPreview && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    {exportFields
                      .filter(f => f.selected)
                      .map((field) => (
                        <th key={field.field} className="border border-gray-300 px-3 py-2 text-left font-medium">
                          {field.label}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      {exportFields
                        .filter(f => f.selected)
                        .map((field) => (
                          <td key={field.field} className="border border-gray-300 px-3 py-2">
                            {formatCellValue(row[field.field], field.type)}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Showing first 5 rows of {previewData.length} records
            </p>
          </CardContent>
        </Card>
      )}

      {/* Export Results */}
      {exportResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {exportResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              Export Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exportResult.success ? (
              <div className="space-y-2">
                <p className="text-green-800">Export completed successfully!</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">File:</span>
                    <span className="font-medium ml-2">{exportResult.fileName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Records:</span>
                    <span className="font-medium ml-2">{exportResult.recordCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Fields:</span>
                    <span className="font-medium ml-2">{exportResult.fieldCount}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-red-800">
                <p>Export failed: {exportResult.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper function to format cell values
function formatCellValue(value: any, type?: string): string {
  if (value === null || value === undefined) return ''
  
  switch (type) {
    case 'currency':
      return typeof value === 'number' ? `$${value.toFixed(2)}` : String(value)
    case 'boolean':
      return value ? 'Yes' : 'No'
    case 'date':
      return value instanceof Date ? value.toLocaleDateString() : String(value)
    default:
      return String(value)
  }
}