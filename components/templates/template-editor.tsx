'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { 
  X, Save, Eye, Palette, Type, Layout, Image, FileText, 
  Settings, ChevronDown, ChevronRight, Upload, Download,
  Copy, Trash2, Plus, Check, Calculator
} from 'lucide-react'

type EstimateTemplate = Database['public']['Tables']['estimate_templates']['Row']
type SOTemplate = Database['public']['Tables']['so_templates']['Row']

interface TemplateEditorProps {
  onClose: () => void
  templateType?: 'estimate' | 'invoice' | 'sales_order' | 'purchase_order'
  currentTemplateId?: string
}

interface TemplateSettings {
  // Basic Info
  name: string
  description: string
  isDefault: boolean
  
  // Page Layout
  pageSize: 'letter' | 'legal' | 'a4'
  orientation: 'portrait' | 'landscape'
  margins: {
    top: number
    bottom: number
    left: number
    right: number
  }
  
  // Header Settings
  showLogo: boolean
  logoUrl: string
  logoPosition: 'left' | 'center' | 'right'
  logoSize: 'small' | 'medium' | 'large'
  showCompanyName: boolean
  companyNameSize: number
  showCompanyAddress: boolean
  showCompanyContact: boolean
  headerBackgroundColor: string
  headerTextColor: string
  headerHeight: number
  
  // Document Title
  documentTitleText: string // e.g., "ESTIMATE", "INVOICE", "PURCHASE ORDER"
  documentTitleSize: number
  documentTitleColor: string
  documentTitlePosition: 'left' | 'center' | 'right'
  showDocumentNumber: boolean
  showDocumentDate: boolean
  
  // Customer/Vendor Section
  showBillTo: boolean
  showShipTo: boolean
  addressBoxStyle: 'bordered' | 'shaded' | 'plain'
  addressBoxColor: string
  
  // Line Items Table
  tableHeaderColor: string
  tableHeaderTextColor: string
  tableAlternateRows: boolean
  tableAlternateRowColor: string
  tableBorderStyle: 'none' | 'horizontal' | 'full' | 'minimal'
  tableBorderColor: string
  showItemImages: boolean
  showItemDescriptions: boolean
  showItemSKU: boolean
  showUnitPrice: boolean
  showQuantity: boolean
  showAmount: boolean
  columnOrder: string[]
  
  // Totals Section
  totalsPosition: 'right' | 'left' | 'full-width'
  showSubtotal: boolean
  showTax: boolean
  showShipping: boolean
  showDiscount: boolean
  totalBackgroundColor: string
  totalTextColor: string
  
  // Footer
  showFooter: boolean
  footerText: string
  showTermsAndConditions: boolean
  termsAndConditionsText: string
  showNotes: boolean
  footerBackgroundColor: string
  footerTextColor: string
  footerHeight: number
  
  // Typography
  primaryFont: string
  secondaryFont: string
  baseFontSize: number
  lineHeight: number
  
  // Colors
  primaryColor: string
  secondaryColor: string
  accentColor: string
  textColor: string
  mutedTextColor: string
  
  // Business Rules
  requireSignature: boolean
  showPaymentTerms: boolean
  defaultPaymentTerms: string
  showTaxID: boolean
  taxIDNumber: string
  
  // Numbering
  numberPrefix: string
  numberSuffix: string
  startingNumber: number
  numberPadding: number
  
  // Branding
  watermark: string
  showWatermark: boolean
  watermarkOpacity: number
  
  // Email Settings
  emailSubject: string
  emailBody: string
  
  // Custom CSS
  customCSS: string
}

const defaultTemplate: TemplateSettings = {
  name: 'Standard Template',
  description: 'Default business document template',
  isDefault: false,
  
  pageSize: 'letter',
  orientation: 'portrait',
  margins: { top: 0.75, bottom: 0.75, left: 0.75, right: 0.75 },
  
  showLogo: true,
  logoUrl: '',
  logoPosition: 'left',
  logoSize: 'medium',
  showCompanyName: true,
  companyNameSize: 24,
  showCompanyAddress: true,
  showCompanyContact: true,
  headerBackgroundColor: '#ffffff',
  headerTextColor: '#000000',
  headerHeight: 120,
  
  documentTitleText: 'ESTIMATE',
  documentTitleSize: 20,
  documentTitleColor: '#000000',
  documentTitlePosition: 'right',
  showDocumentNumber: true,
  showDocumentDate: true,
  
  showBillTo: true,
  showShipTo: true,
  addressBoxStyle: 'bordered',
  addressBoxColor: '#f3f4f6',
  
  tableHeaderColor: '#1e40af',
  tableHeaderTextColor: '#ffffff',
  tableAlternateRows: true,
  tableAlternateRowColor: '#f9fafb',
  tableBorderStyle: 'horizontal',
  tableBorderColor: '#e5e7eb',
  showItemImages: false,
  showItemDescriptions: true,
  showItemSKU: true,
  showUnitPrice: true,
  showQuantity: true,
  showAmount: true,
  columnOrder: ['item', 'description', 'qty', 'price', 'amount'],
  
  totalsPosition: 'right',
  showSubtotal: true,
  showTax: true,
  showShipping: false,
  showDiscount: false,
  totalBackgroundColor: '#f3f4f6',
  totalTextColor: '#000000',
  
  showFooter: true,
  footerText: 'Thank you for your business!',
  showTermsAndConditions: true,
  termsAndConditionsText: 'Payment due within 30 days.',
  showNotes: true,
  footerBackgroundColor: '#ffffff',
  footerTextColor: '#6b7280',
  footerHeight: 100,
  
  primaryFont: 'Arial, sans-serif',
  secondaryFont: 'Georgia, serif',
  baseFontSize: 11,
  lineHeight: 1.5,
  
  primaryColor: '#1e40af',
  secondaryColor: '#64748b',
  accentColor: '#059669',
  textColor: '#000000',
  mutedTextColor: '#6b7280',
  
  requireSignature: false,
  showPaymentTerms: true,
  defaultPaymentTerms: 'Net 30',
  showTaxID: false,
  taxIDNumber: '',
  
  numberPrefix: 'EST-',
  numberSuffix: '',
  startingNumber: 1001,
  numberPadding: 4,
  
  watermark: '',
  showWatermark: false,
  watermarkOpacity: 0.1,
  
  emailSubject: 'New Estimate #{number} - {customer}',
  emailBody: 'Please find your estimate attached.',
  
  customCSS: ''
}

export default function TemplateEditor({ onClose, templateType = 'estimate', currentTemplateId }: TemplateEditorProps) {
  const [template, setTemplate] = useState<TemplateSettings>(defaultTemplate)
  const [activeSection, setActiveSection] = useState('basic')
  const [showPreview, setShowPreview] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savedTemplates, setSavedTemplates] = useState<(EstimateTemplate | SOTemplate)[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(currentTemplateId || '')

  // Helper function to get table name based on template type
  const getTableName = () => {
    switch (templateType) {
      case 'sales_order':
        return 'so_templates'
      case 'estimate':
      default:
        return 'estimate_templates'
    }
  }

  useEffect(() => {
    fetchTemplates()
    if (currentTemplateId) {
      loadTemplate(currentTemplateId)
    }
  }, [currentTemplateId])

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from(getTableName())
      .select('*')
      .order('name')
    
    if (data) setSavedTemplates(data)
  }

  const loadTemplate = async (templateId: string) => {
    const { data } = await supabase
      .from(getTableName())
      .select('*')
      .eq('id', templateId)
      .single()
    
    if (data) {
      // Parse template settings from database
      setTemplate({
        ...defaultTemplate,
        name: data.name,
        description: data.description || '',
        isDefault: data.is_default,
        documentTitleText: templateType.toUpperCase().replace('_', ' '),
        headerBackgroundColor: data.primary_color || '#1e40af',
        primaryColor: data.primary_color || '#1e40af',
        secondaryColor: data.secondary_color || '#64748b',
        accentColor: data.accent_color || '#059669',
        primaryFont: data.font_family || 'Arial, sans-serif',
        baseFontSize: data.font_size || 11,
        footerText: data.footer_text || '',
        termsAndConditionsText: data.terms_and_conditions || '',
        showItemDescriptions: data.show_item_descriptions ?? true,
        showItemImages: data.show_item_images ?? false,
      })
      setSelectedTemplateId(templateId)
    }
  }

  const saveTemplate = async () => {
    setIsSaving(true)
    
    try {
      const templateData = {
        name: template.name,
        description: template.description,
        template_type: 'GENERAL' as const,
        is_default: template.isDefault,
        header_logo_url: template.logoUrl || null,
        header_text: `Company Name: ${template.showCompanyName}, Address: ${template.showCompanyAddress}`,
        footer_text: template.footerText,
        terms_and_conditions: template.termsAndConditionsText,
        show_item_descriptions: template.showItemDescriptions,
        show_item_images: template.showItemImages,
        show_labor_section: false,
        show_materials_section: false,
        show_subtotals: template.showSubtotal,
        show_taxes: template.showTax,
        show_shipping: template.showShipping,
        primary_color: template.primaryColor,
        secondary_color: template.secondaryColor,
        accent_color: template.accentColor,
        font_family: template.primaryFont,
        font_size: template.baseFontSize,
      }

      if (selectedTemplateId) {
        // Update existing
        await supabase
          .from(getTableName())
          .update(templateData)
          .eq('id', selectedTemplateId)
      } else {
        // Create new
        const { data } = await supabase
          .from(getTableName())
          .insert(templateData)
          .select()
          .single()
        
        if (data) {
          setSelectedTemplateId(data.id)
        }
      }

      await fetchTemplates()
      alert('Template saved successfully!')
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  const sections = [
    { id: 'basic', label: 'Basic Info', icon: FileText },
    { id: 'layout', label: 'Page Layout', icon: Layout },
    { id: 'header', label: 'Header', icon: Type },
    { id: 'addresses', label: 'Addresses', icon: FileText },
    { id: 'table', label: 'Line Items', icon: Layout },
    { id: 'totals', label: 'Totals', icon: Calculator },
    { id: 'footer', label: 'Footer', icon: FileText },
    { id: 'business', label: 'Business Rules', icon: Settings },
    { id: 'numbering', label: 'Numbering', icon: FileText },
    { id: 'branding', label: 'Branding', icon: Image },
    { id: 'colors', label: 'Colors & Fonts', icon: Palette },
    { id: 'advanced', label: 'Advanced', icon: Settings },
  ]

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'basic':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Template Name</label>
              <Input
                value={template.name}
                onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Professional Invoice"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea
                value={template.description}
                onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                placeholder="Brief description of this template"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={template.isDefault}
                onChange={(e) => setTemplate(prev => ({ ...prev, isDefault: e.target.checked }))}
                className="rounded"
              />
              <label className="text-sm">Set as default template</label>
            </div>
          </div>
        )

      case 'layout':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Page Size</label>
              <select
                value={template.pageSize}
                onChange={(e) => setTemplate(prev => ({ ...prev, pageSize: e.target.value as any }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="letter">Letter (8.5" × 11")</option>
                <option value="legal">Legal (8.5" × 14")</option>
                <option value="a4">A4 (210mm × 297mm)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Orientation</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={template.orientation === 'portrait'}
                    onChange={() => setTemplate(prev => ({ ...prev, orientation: 'portrait' }))}
                  />
                  <span className="text-sm">Portrait</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={template.orientation === 'landscape'}
                    onChange={() => setTemplate(prev => ({ ...prev, orientation: 'landscape' }))}
                  />
                  <span className="text-sm">Landscape</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Margins (inches)</label>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Top</label>
                  <Input
                    type="number"
                    step="0.25"
                    value={template.margins.top}
                    onChange={(e) => setTemplate(prev => ({
                      ...prev,
                      margins: { ...prev.margins, top: parseFloat(e.target.value) }
                    }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Bottom</label>
                  <Input
                    type="number"
                    step="0.25"
                    value={template.margins.bottom}
                    onChange={(e) => setTemplate(prev => ({
                      ...prev,
                      margins: { ...prev.margins, bottom: parseFloat(e.target.value) }
                    }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Left</label>
                  <Input
                    type="number"
                    step="0.25"
                    value={template.margins.left}
                    onChange={(e) => setTemplate(prev => ({
                      ...prev,
                      margins: { ...prev.margins, left: parseFloat(e.target.value) }
                    }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Right</label>
                  <Input
                    type="number"
                    step="0.25"
                    value={template.margins.right}
                    onChange={(e) => setTemplate(prev => ({
                      ...prev,
                      margins: { ...prev.margins, right: parseFloat(e.target.value) }
                    }))}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 'header':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={template.showLogo}
                onChange={(e) => setTemplate(prev => ({ ...prev, showLogo: e.target.checked }))}
                className="rounded"
              />
              <label className="text-sm">Show Logo</label>
            </div>
            
            {template.showLogo && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Logo URL</label>
                  <Input
                    value={template.logoUrl || localStorage.getItem('companyLogoUrl') || ''}
                    onChange={(e) => setTemplate(prev => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="https://... (or upload in Settings > Document Templates)"
                  />
                  {(template.logoUrl || localStorage.getItem('companyLogoUrl')) && (
                    <div className="mt-2">
                      <img
                        src={template.logoUrl || localStorage.getItem('companyLogoUrl') || ''}
                        alt="Logo Preview"
                        className="h-12 object-contain bg-gray-50 rounded border p-1"
                      />
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Logo Position</label>
                  <select
                    value={template.logoPosition}
                    onChange={(e) => setTemplate(prev => ({ ...prev, logoPosition: e.target.value as any }))}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Logo Size</label>
                  <select
                    value={template.logoSize}
                    onChange={(e) => setTemplate(prev => ({ ...prev, logoSize: e.target.value as any }))}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </>
            )}
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={template.showCompanyName}
                onChange={(e) => setTemplate(prev => ({ ...prev, showCompanyName: e.target.checked }))}
                className="rounded"
              />
              <label className="text-sm">Show Company Name</label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={template.showCompanyAddress}
                onChange={(e) => setTemplate(prev => ({ ...prev, showCompanyAddress: e.target.checked }))}
                className="rounded"
              />
              <label className="text-sm">Show Company Address</label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={template.showCompanyContact}
                onChange={(e) => setTemplate(prev => ({ ...prev, showCompanyContact: e.target.checked }))}
                className="rounded"
              />
              <label className="text-sm">Show Company Contact Info</label>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Document Title</label>
              <Input
                value={template.documentTitleText}
                onChange={(e) => setTemplate(prev => ({ ...prev, documentTitleText: e.target.value }))}
                placeholder="e.g., ESTIMATE, INVOICE"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Title Position</label>
              <select
                value={template.documentTitlePosition}
                onChange={(e) => setTemplate(prev => ({ ...prev, documentTitlePosition: e.target.value as any }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        )

      case 'addresses':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={template.showBillTo}
                onChange={(e) => setTemplate(prev => ({ ...prev, showBillTo: e.target.checked }))}
                className="rounded"
              />
              <label className="text-sm">Show Bill To Address</label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={template.showShipTo}
                onChange={(e) => setTemplate(prev => ({ ...prev, showShipTo: e.target.checked }))}
                className="rounded"
              />
              <label className="text-sm">Show Ship To Address</label>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Address Box Style</label>
              <select
                value={template.addressBoxStyle}
                onChange={(e) => setTemplate(prev => ({ ...prev, addressBoxStyle: e.target.value as any }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="plain">Plain</option>
                <option value="bordered">Bordered</option>
                <option value="shaded">Shaded Background</option>
              </select>
            </div>
            
            {template.addressBoxStyle === 'shaded' && (
              <div>
                <label className="block text-sm font-medium mb-1">Background Color</label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={template.addressBoxColor}
                    onChange={(e) => setTemplate(prev => ({ ...prev, addressBoxColor: e.target.value }))}
                    className="w-12 h-8"
                  />
                  <Input
                    value={template.addressBoxColor}
                    onChange={(e) => setTemplate(prev => ({ ...prev, addressBoxColor: e.target.value }))}
                    placeholder="#f3f4f6"
                    className="flex-1"
                  />
                </div>
              </div>
            )}
          </div>
        )

      case 'table':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Table Style</label>
              <select
                value={template.tableBorderStyle}
                onChange={(e) => setTemplate(prev => ({ ...prev, tableBorderStyle: e.target.value as any }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="none">No Borders</option>
                <option value="minimal">Minimal</option>
                <option value="horizontal">Horizontal Lines</option>
                <option value="full">Full Grid</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={template.tableAlternateRows}
                onChange={(e) => setTemplate(prev => ({ ...prev, tableAlternateRows: e.target.checked }))}
                className="rounded"
              />
              <label className="text-sm">Alternate Row Colors</label>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Show Columns</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showItemSKU}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showItemSKU: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Item/SKU</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showItemDescriptions}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showItemDescriptions: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Description</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showQuantity}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showQuantity: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Quantity</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showUnitPrice}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showUnitPrice: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Unit Price</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showAmount}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showAmount: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Amount</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showItemImages}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showItemImages: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Product Images</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Header Background</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={template.tableHeaderColor}
                  onChange={(e) => setTemplate(prev => ({ ...prev, tableHeaderColor: e.target.value }))}
                  className="w-12 h-8"
                />
                <Input
                  value={template.tableHeaderColor}
                  onChange={(e) => setTemplate(prev => ({ ...prev, tableHeaderColor: e.target.value }))}
                  placeholder="#1e40af"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        )

      case 'totals':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Totals Position</label>
              <select
                value={template.totalsPosition}
                onChange={(e) => setTemplate(prev => ({ ...prev, totalsPosition: e.target.value as any }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="right">Right Aligned</option>
                <option value="left">Left Aligned</option>
                <option value="full-width">Full Width</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Show in Totals</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showSubtotal}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showSubtotal: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Subtotal</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showTax}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showTax: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Tax</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showShipping}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showShipping: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Shipping</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showDiscount}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showDiscount: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Discount</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Totals Background</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={template.totalBackgroundColor}
                  onChange={(e) => setTemplate(prev => ({ ...prev, totalBackgroundColor: e.target.value }))}
                  className="w-12 h-8"
                />
                <Input
                  value={template.totalBackgroundColor}
                  onChange={(e) => setTemplate(prev => ({ ...prev, totalBackgroundColor: e.target.value }))}
                  placeholder="#f3f4f6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        )

      case 'footer':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={template.showFooter}
                onChange={(e) => setTemplate(prev => ({ ...prev, showFooter: e.target.checked }))}
                className="rounded"
              />
              <label className="text-sm">Show Footer</label>
            </div>
            
            {template.showFooter && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Footer Text</label>
                  <Textarea
                    value={template.footerText}
                    onChange={(e) => setTemplate(prev => ({ ...prev, footerText: e.target.value }))}
                    rows={2}
                    placeholder="Thank you for your business!"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showTermsAndConditions}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showTermsAndConditions: e.target.checked }))}
                    className="rounded"
                  />
                  <label className="text-sm">Show Terms & Conditions</label>
                </div>
                
                {template.showTermsAndConditions && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Terms & Conditions</label>
                    <Textarea
                      value={template.termsAndConditionsText}
                      onChange={(e) => setTemplate(prev => ({ ...prev, termsAndConditionsText: e.target.value }))}
                      rows={3}
                      placeholder="Payment terms, warranty information, etc."
                    />
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={template.showNotes}
                    onChange={(e) => setTemplate(prev => ({ ...prev, showNotes: e.target.checked }))}
                    className="rounded"
                  />
                  <label className="text-sm">Show Notes Section</label>
                </div>
              </>
            )}
          </div>
        )

      case 'colors':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Primary Color</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={template.primaryColor}
                  onChange={(e) => setTemplate(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-12 h-8"
                />
                <Input
                  value={template.primaryColor}
                  onChange={(e) => setTemplate(prev => ({ ...prev, primaryColor: e.target.value }))}
                  placeholder="#1e40af"
                  className="flex-1"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Secondary Color</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={template.secondaryColor}
                  onChange={(e) => setTemplate(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="w-12 h-8"
                />
                <Input
                  value={template.secondaryColor}
                  onChange={(e) => setTemplate(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  placeholder="#64748b"
                  className="flex-1"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Accent Color</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={template.accentColor}
                  onChange={(e) => setTemplate(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="w-12 h-8"
                />
                <Input
                  value={template.accentColor}
                  onChange={(e) => setTemplate(prev => ({ ...prev, accentColor: e.target.value }))}
                  placeholder="#059669"
                  className="flex-1"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Primary Font</label>
              <select
                value={template.primaryFont}
                onChange={(e) => setTemplate(prev => ({ ...prev, primaryFont: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Helvetica Neue', sans-serif">Helvetica</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value="Tahoma, sans-serif">Tahoma</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Base Font Size (pt)</label>
              <Input
                type="number"
                value={template.baseFontSize}
                onChange={(e) => setTemplate(prev => ({ ...prev, baseFontSize: parseInt(e.target.value) }))}
                min="8"
                max="16"
              />
            </div>
          </div>
        )

      case 'business':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requireSignature"
                checked={template.requireSignature}
                onChange={(e) => setTemplate(prev => ({ ...prev, requireSignature: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="requireSignature" className="text-sm font-medium">Require customer signature</label>
            </div>
            
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showPaymentTerms"
                checked={template.showPaymentTerms}
                onChange={(e) => setTemplate(prev => ({ ...prev, showPaymentTerms: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="showPaymentTerms" className="text-sm font-medium">Show payment terms</label>
            </div>
            
            {template.showPaymentTerms && (
              <div>
                <label className="block text-sm font-medium mb-1">Default Payment Terms</label>
                <Input
                  value={template.defaultPaymentTerms}
                  onChange={(e) => setTemplate(prev => ({ ...prev, defaultPaymentTerms: e.target.value }))}
                  placeholder="Net 30, Due on Receipt, etc."
                />
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showTaxID"
                checked={template.showTaxID}
                onChange={(e) => setTemplate(prev => ({ ...prev, showTaxID: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="showTaxID" className="text-sm font-medium">Show Tax ID number</label>
            </div>
            
            {template.showTaxID && (
              <div>
                <label className="block text-sm font-medium mb-1">Tax ID Number</label>
                <Input
                  value={template.taxIDNumber}
                  onChange={(e) => setTemplate(prev => ({ ...prev, taxIDNumber: e.target.value }))}
                  placeholder="12-3456789"
                />
              </div>
            )}
          </div>
        )

      case 'numbering':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Number Prefix</label>
              <Input
                value={template.numberPrefix}
                onChange={(e) => setTemplate(prev => ({ ...prev, numberPrefix: e.target.value }))}
                placeholder="EST-, INV-, SO-, etc."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Number Suffix</label>
              <Input
                value={template.numberSuffix}
                onChange={(e) => setTemplate(prev => ({ ...prev, numberSuffix: e.target.value }))}
                placeholder="-DRAFT, -FINAL, etc."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Starting Number</label>
              <Input
                type="number"
                value={template.startingNumber}
                onChange={(e) => setTemplate(prev => ({ ...prev, startingNumber: parseInt(e.target.value) || 1001 }))}
                min="1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Number Padding (Digits)</label>
              <Input
                type="number"
                value={template.numberPadding}
                onChange={(e) => setTemplate(prev => ({ ...prev, numberPadding: parseInt(e.target.value) || 4 }))}
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: {template.numberPrefix}{String(template.startingNumber).padStart(template.numberPadding, '0')}{template.numberSuffix}
              </p>
            </div>
            
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Preview:</strong> Next document number will be<br/>
                <code className="bg-blue-100 px-1 rounded">
                  {template.numberPrefix}{String(template.startingNumber).padStart(template.numberPadding, '0')}{template.numberSuffix}
                </code>
              </p>
            </div>
          </div>
        )

      case 'branding':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showWatermark"
                checked={template.showWatermark}
                onChange={(e) => setTemplate(prev => ({ ...prev, showWatermark: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="showWatermark" className="text-sm font-medium">Show watermark</label>
            </div>
            
            {template.showWatermark && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Watermark Text</label>
                  <Input
                    value={template.watermark}
                    onChange={(e) => setTemplate(prev => ({ ...prev, watermark: e.target.value }))}
                    placeholder="DRAFT, CONFIDENTIAL, etc."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Watermark Opacity</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0.05"
                      max="0.5"
                      step="0.05"
                      value={template.watermarkOpacity}
                      onChange={(e) => setTemplate(prev => ({ ...prev, watermarkOpacity: parseFloat(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12">
                      {(template.watermarkOpacity * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium mb-1">Email Subject Template</label>
              <Input
                value={template.emailSubject}
                onChange={(e) => setTemplate(prev => ({ ...prev, emailSubject: e.target.value }))}
                placeholder="New Estimate #{number} - {customer}"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use {`{number}`} for document number, {`{customer}`} for customer name
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Email Body Template</label>
              <Textarea
                value={template.emailBody}
                onChange={(e) => setTemplate(prev => ({ ...prev, emailBody: e.target.value }))}
                rows={4}
                placeholder="Please find your estimate attached. Let us know if you have any questions."
              />
              <p className="text-xs text-gray-500 mt-1">
                Use {`{number}`}, {`{customer}`}, {`{total}`} for dynamic content
              </p>
            </div>
          </div>
        )

      case 'advanced':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Custom CSS</label>
              <Textarea
                value={template.customCSS}
                onChange={(e) => setTemplate(prev => ({ ...prev, customCSS: e.target.value }))}
                rows={10}
                placeholder="/* Add custom CSS here */&#10;.invoice-header { }&#10;.line-items { }"
                className="font-mono text-xs"
              />
            </div>
            
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Custom CSS allows advanced customization but may affect template stability. 
                Use with caution and test thoroughly.
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const renderPreview = () => {
    return (
      <div 
        className="bg-white p-8 shadow-lg"
        style={{ 
          fontFamily: template.primaryFont,
          fontSize: `${template.baseFontSize}pt`,
          minHeight: '11in',
          width: '8.5in',
          margin: '0 auto'
        }}
      >
        {/* Header */}
        <div 
          className="mb-6 pb-4 border-b"
          style={{ backgroundColor: template.headerBackgroundColor }}
        >
          <div className="flex justify-between items-start">
            <div>
              {template.showLogo && (
                <div className="mb-2">
                  <div className="w-24 h-12 bg-gray-300 rounded flex items-center justify-center text-xs">Logo</div>
                </div>
              )}
              {template.showCompanyName && (
                <h1 style={{ fontSize: `${template.companyNameSize}pt`, color: template.primaryColor }}>
                  Your Company Name
                </h1>
              )}
              {template.showCompanyAddress && (
                <p className="text-sm mt-1" style={{ color: template.mutedTextColor }}>
                  123 Main Street<br />
                  City, State 12345<br />
                  Phone: (555) 123-4567
                </p>
              )}
            </div>
            
            <div className={`text-${template.documentTitlePosition}`}>
              <h2 
                style={{ 
                  fontSize: `${template.documentTitleSize}pt`,
                  color: template.documentTitleColor,
                  fontWeight: 'bold'
                }}
              >
                {template.documentTitleText}
              </h2>
              {template.showDocumentNumber && (
                <p className="mt-2">
                  <strong>Number:</strong> EST-2024-001
                </p>
              )}
              {template.showDocumentDate && (
                <p>
                  <strong>Date:</strong> {new Date().toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {template.showBillTo && (
            <div 
              className={`p-3 ${template.addressBoxStyle === 'bordered' ? 'border' : ''}`}
              style={{ 
                backgroundColor: template.addressBoxStyle === 'shaded' ? template.addressBoxColor : 'transparent'
              }}
            >
              <h3 className="font-semibold mb-2">Bill To:</h3>
              <p className="text-sm">
                Customer Name<br />
                123 Customer St<br />
                Customer City, ST 12345
              </p>
            </div>
          )}
          
          {template.showShipTo && (
            <div 
              className={`p-3 ${template.addressBoxStyle === 'bordered' ? 'border' : ''}`}
              style={{ 
                backgroundColor: template.addressBoxStyle === 'shaded' ? template.addressBoxColor : 'transparent'
              }}
            >
              <h3 className="font-semibold mb-2">Ship To:</h3>
              <p className="text-sm">
                Customer Name<br />
                456 Shipping Ave<br />
                Ship City, ST 54321
              </p>
            </div>
          )}
        </div>

        {/* Line Items */}
        <table className="w-full mb-6">
          <thead>
            <tr style={{ backgroundColor: template.tableHeaderColor, color: template.tableHeaderTextColor }}>
              {template.showItemSKU && <th className="p-2 text-left text-sm">Item</th>}
              {template.showItemDescriptions && <th className="p-2 text-left text-sm">Description</th>}
              {template.showQuantity && <th className="p-2 text-right text-sm">Qty</th>}
              {template.showUnitPrice && <th className="p-2 text-right text-sm">Price</th>}
              {template.showAmount && <th className="p-2 text-right text-sm">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(i => (
              <tr 
                key={i}
                style={{ 
                  backgroundColor: template.tableAlternateRows && i % 2 === 0 ? template.tableAlternateRowColor : 'transparent'
                }}
              >
                {template.showItemSKU && <td className="p-2 text-sm">ITEM-00{i}</td>}
                {template.showItemDescriptions && <td className="p-2 text-sm">Sample Product {i}</td>}
                {template.showQuantity && <td className="p-2 text-right text-sm">1</td>}
                {template.showUnitPrice && <td className="p-2 text-right text-sm">$100.00</td>}
                {template.showAmount && <td className="p-2 text-right text-sm">$100.00</td>}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className={`${template.totalsPosition === 'right' ? 'ml-auto' : ''} w-64`}>
          <div 
            className="p-3 rounded"
            style={{ backgroundColor: template.totalBackgroundColor }}
          >
            {template.showSubtotal && (
              <div className="flex justify-between mb-1">
                <span>Subtotal:</span>
                <span>$300.00</span>
              </div>
            )}
            {template.showTax && (
              <div className="flex justify-between mb-1">
                <span>Tax:</span>
                <span>$30.00</span>
              </div>
            )}
            {template.showShipping && (
              <div className="flex justify-between mb-1">
                <span>Shipping:</span>
                <span>$10.00</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Total:</span>
              <span style={{ color: template.primaryColor }}>$340.00</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        {template.showFooter && (
          <div 
            className="mt-8 pt-4 border-t"
            style={{ color: template.footerTextColor }}
          >
            {template.footerText && (
              <p className="text-center mb-2">{template.footerText}</p>
            )}
            {template.showTermsAndConditions && (
              <div className="mt-2">
                <h4 className="font-semibold text-sm">Terms & Conditions:</h4>
                <p className="text-xs mt-1">{template.termsAndConditionsText}</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Template Editor</h1>
          <p className="text-sm text-gray-600">Customize your document templates</p>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={selectedTemplateId}
            onChange={(e) => {
              setSelectedTemplateId(e.target.value)
              if (e.target.value) loadTemplate(e.target.value)
            }}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="">New Template</option>
            {savedTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          
          <Button size="sm" variant="outline">
            <Upload className="w-3 h-3 mr-1" />
            Import
          </Button>
          
          <Button size="sm" variant="outline">
            <Download className="w-3 h-3 mr-1" />
            Export
          </Button>
          
          <Button 
            size="sm" 
            onClick={saveTemplate}
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-3 h-3 mr-1" />
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
          
          <Button size="sm" variant="outline" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r overflow-y-auto">
          <div className="p-4 space-y-1">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  activeSection === section.id 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'hover:bg-gray-100'
                }`}
              >
                <section.icon className="w-4 h-4" />
                <span>{section.label}</span>
                {activeSection === section.id && (
                  <ChevronRight className="w-3 h-3 ml-auto" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Panel */}
        <div className="w-80 bg-white border-r overflow-y-auto">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              {sections.find(s => s.id === activeSection)?.label}
            </h2>
            {renderSectionContent()}
          </div>
        </div>

        {/* Preview Panel */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Preview</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline">
                <Eye className="w-3 h-3 mr-1" />
                Full Screen
              </Button>
            </div>
          </div>
          
          {renderPreview()}
        </div>
      </div>
    </div>
  )
}