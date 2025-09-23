'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import {
  Users,
  Settings,
  Database,
  Mail,
  Shield,
  Palette,
  Globe,
  Bell,
  FileText,
  Calculator,
  Receipt,
  DollarSign,
  Building2,
  ShoppingCart,
  Hash,
  Layers3,
  Upload,
  Check,
  Download,
  RefreshCw
} from 'lucide-react'
import SalesRepsManagement from './sales-reps-settings'
import TaxCodesManagement from './tax-codes-settings'
import CompanySettings from './company-settings'
import TemplateEditor from '@/components/templates/template-editor'
import TermsEditor from '@/components/terms/terms-editor'
import DocumentNumberingSettings from './document-numbering-settings'
import ModuleSettings from './module-settings'
import UserManagement from './user-management'

type SettingsCategory = 
  | 'sales-reps'
  | 'templates'
  | 'tax-codes'
  | 'payment-terms'
  | 'po-settings'
  | 'document-numbering'
  | 'modules'
  | 'users'
  | 'company'
  | 'integrations'
  | 'notifications'
  | 'security'
  | 'appearance'
  | 'data'

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('sales-reps')
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [showTermsEditor, setShowTermsEditor] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const templateImportRef = useRef<HTMLInputElement>(null)

  // Load saved logo URL on component mount
  useEffect(() => {
    const savedLogoUrl = localStorage.getItem('companyLogoUrl')
    if (savedLogoUrl) {
      setLogoUrl(savedLogoUrl)
    }
  }, [])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, or WebP)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    setIsUploadingLogo(true)
    setUploadSuccess(false)

    try {
      // Create unique file name
      const fileExt = file.name.split('.').pop()
      const fileName = `company-logo-${Date.now()}.${fileExt}`
      const filePath = `logos/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        // If bucket doesn't exist, try to create it
        if (error.message.includes('Bucket not found')) {
          // Create the bucket
          const { data: bucketData, error: bucketError } = await supabase.storage
            .createBucket('company-assets', {
              public: true,
              fileSizeLimit: 5242880 // 5MB
            })

          if (bucketError) {
            throw new Error('Failed to create storage bucket: ' + bucketError.message)
          }

          // Retry upload
          const { data: retryData, error: retryError } = await supabase.storage
            .from('company-assets')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true
            })

          if (retryError) {
            throw retryError
          }
        } else {
          throw error
        }
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath)

      if (urlData?.publicUrl) {
        setLogoUrl(urlData.publicUrl)
        setUploadSuccess(true)

        // Save logo URL to a settings table or localStorage for now
        localStorage.setItem('companyLogoUrl', urlData.publicUrl)

        // Reset success message after 3 seconds
        setTimeout(() => setUploadSuccess(false), 3000)

        console.log('Logo uploaded successfully:', urlData.publicUrl)
      }
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo. Please try again.')
    } finally {
      setIsUploadingLogo(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Export templates to JSON file
  const handleExportTemplates = async () => {
    try {
      // Fetch all templates from database
      const { data: estimateTemplates, error: estError } = await supabase
        .from('estimate_templates')
        .select('*')

      if (estError) throw estError

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        companyLogoUrl: logoUrl || localStorage.getItem('companyLogoUrl'),
        templates: {
          estimates: estimateTemplates || []
        }
      }

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `templates-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      alert('Templates exported successfully!')
    } catch (error) {
      console.error('Error exporting templates:', error)
      alert('Failed to export templates. Please try again.')
    }
  }

  // Import templates from JSON file
  const handleImportTemplates = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const importData = JSON.parse(text)

      if (!importData.templates) {
        throw new Error('Invalid template file format')
      }

      // Import estimate templates
      if (importData.templates.estimates && importData.templates.estimates.length > 0) {
        for (const template of importData.templates.estimates) {
          // Remove id and timestamps to create new entries
          const { id, created_at, updated_at, ...templateData } = template

          // Check if template with same name exists
          const { data: existing } = await supabase
            .from('estimate_templates')
            .select('id')
            .eq('name', templateData.name)
            .single()

          if (existing) {
            // Update existing template
            const { error } = await supabase
              .from('estimate_templates')
              .update(templateData)
              .eq('id', existing.id)

            if (error) throw error
          } else {
            // Insert new template
            const { error } = await supabase
              .from('estimate_templates')
              .insert(templateData)

            if (error) throw error
          }
        }
      }

      // Import logo URL if present
      if (importData.companyLogoUrl) {
        localStorage.setItem('companyLogoUrl', importData.companyLogoUrl)
        setLogoUrl(importData.companyLogoUrl)
      }

      alert('Templates imported successfully!')

      // Reset file input
      if (templateImportRef.current) {
        templateImportRef.current.value = ''
      }
    } catch (error) {
      console.error('Error importing templates:', error)
      alert('Failed to import templates. Please check the file format and try again.')
    }
  }

  // Reset templates to defaults
  const handleResetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all templates to defaults? This will remove all customizations.')) {
      return
    }

    try {
      // Delete all user-created templates (keep system defaults)
      const { error: deleteError } = await supabase
        .from('estimate_templates')
        .delete()
        .eq('template_type', 'USER_SAVED')

      if (deleteError) throw deleteError

      // Reset default templates
      const defaultTemplates = [
        {
          name: 'Standard Estimate',
          description: 'Default estimate template',
          template_type: 'GENERAL',
          is_default: true,
          header_text: 'ESTIMATE',
          footer_text: 'Thank you for your business!',
          terms_and_conditions: 'This estimate is valid for 30 days from the date of issue.',
          show_item_descriptions: true,
          show_taxes: true,
          show_shipping: true,
          primary_color: '#3B82F6',
          secondary_color: '#1F2937',
          accent_color: '#10B981',
          font_family: 'Inter',
          font_size: 12
        },
        {
          name: 'Professional Estimate',
          description: 'Professional estimate template with detailed layout',
          template_type: 'GENERAL',
          is_default: false,
          header_text: 'PROFESSIONAL ESTIMATE',
          footer_text: 'We appreciate your business and look forward to working with you.',
          terms_and_conditions: 'Terms: Net 30. This estimate is valid for 45 days.',
          show_item_descriptions: true,
          show_taxes: true,
          show_shipping: true,
          primary_color: '#4F46E5',
          secondary_color: '#111827',
          accent_color: '#059669',
          font_family: 'Inter',
          font_size: 11
        },
        {
          name: 'Simple Estimate',
          description: 'Minimal estimate template',
          template_type: 'GENERAL',
          is_default: false,
          header_text: 'QUOTE',
          footer_text: 'Thank you!',
          terms_and_conditions: 'Valid for 30 days.',
          show_item_descriptions: false,
          show_taxes: true,
          show_shipping: false,
          primary_color: '#000000',
          secondary_color: '#4B5563',
          accent_color: '#EF4444',
          font_family: 'Inter',
          font_size: 12
        }
      ]

      // Insert default templates
      for (const template of defaultTemplates) {
        const { data: existing } = await supabase
          .from('estimate_templates')
          .select('id')
          .eq('name', template.name)
          .eq('template_type', 'GENERAL')
          .single()

        if (existing) {
          // Update existing default
          const { error } = await supabase
            .from('estimate_templates')
            .update(template)
            .eq('id', existing.id)

          if (error) throw error
        } else {
          // Insert new default
          const { error } = await supabase
            .from('estimate_templates')
            .insert(template)

          if (error) throw error
        }
      }

      // Clear custom logo
      localStorage.removeItem('companyLogoUrl')
      setLogoUrl('')

      alert('Templates have been reset to defaults!')
    } catch (error) {
      console.error('Error resetting templates:', error)
      alert('Failed to reset templates. Please try again.')
    }
  }

  const categories = [
    {
      id: 'sales-reps' as SettingsCategory,
      name: 'Sales Representatives',
      description: 'Manage sales team members, territories, and commissions',
      icon: Users,
      color: 'text-teal-600'
    },
    {
      id: 'templates' as SettingsCategory,
      name: 'Document Templates',
      description: 'Customize estimates, invoices, sales orders, and purchase orders',
      icon: FileText,
      color: 'text-purple-600'
    },
    {
      id: 'tax-codes' as SettingsCategory,
      name: 'Tax Codes',
      description: 'Manage tax rates, tax-exempt codes, and custom tax categories',
      icon: Receipt,
      color: 'text-emerald-600'
    },
    {
      id: 'payment-terms' as SettingsCategory,
      name: 'Payment Terms',
      description: 'Configure payment terms for estimates, sales orders, and invoices',
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      id: 'document-numbering' as SettingsCategory,
      name: 'Document Numbering',
      description: 'Configure starting numbers for estimates, invoices, POs, and receipts',
      icon: Hash,
      color: 'text-indigo-600'
    },
    {
      id: 'modules' as SettingsCategory,
      name: 'Module Settings',
      description: 'Enable or disable optional system modules',
      icon: Layers3,
      color: 'text-cyan-600'
    },
    {
      id: 'po-settings' as SettingsCategory,
      name: 'Purchase Orders / PO',
      description: 'Company settings for purchase orders, billing and shipping addresses',
      icon: ShoppingCart,
      color: 'text-orange-600'
    },
    {
      id: 'users' as SettingsCategory,
      name: 'User Management',
      description: 'Manage user accounts, roles, and permissions',
      icon: Shield,
      color: 'text-blue-600'
    },
    {
      id: 'company' as SettingsCategory,
      name: 'Company Profile',
      description: 'Company information, address, and contact details',
      icon: Globe,
      color: 'text-green-600'
    },
    {
      id: 'integrations' as SettingsCategory,
      name: 'Integrations',
      description: 'Third-party integrations and API connections',
      icon: Database,
      color: 'text-purple-600'
    },
    {
      id: 'notifications' as SettingsCategory,
      name: 'Notifications',
      description: 'Email alerts, system notifications, and preferences',
      icon: Bell,
      color: 'text-orange-600'
    },
    {
      id: 'security' as SettingsCategory,
      name: 'Security',
      description: 'Authentication, access controls, and security policies',
      icon: Shield,
      color: 'text-red-600'
    },
    {
      id: 'appearance' as SettingsCategory,
      name: 'Appearance',
      description: 'Themes, layouts, and display preferences',
      icon: Palette,
      color: 'text-pink-600'
    },
    {
      id: 'data' as SettingsCategory,
      name: 'Data Management',
      description: 'Backup, export, import, and data retention settings',
      icon: FileText,
      color: 'text-indigo-600'
    }
  ]

  const renderSettingsContent = () => {
    switch (activeCategory) {
      case 'sales-reps':
        return <SalesRepsManagement />
      
      case 'tax-codes':
        return <TaxCodesManagement />
      
      case 'po-settings':
        return <CompanySettings />
      
      case 'document-numbering':
        return <DocumentNumberingSettings />
      
      case 'modules':
        return <ModuleSettings />
      
      case 'payment-terms':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Payment Terms Management</h2>
              <p className="text-gray-600">Configure payment terms used across estimates, sales orders, and invoices</p>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Payment Terms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Payment terms define how long customers have to pay invoices and any early payment discounts.
                    These terms are used for invoice aging reports and automatic payment reminders.
                  </p>
                  
                  <Button 
                    onClick={() => setShowTermsEditor(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Manage Payment Terms
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      
      case 'templates':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Document Templates</h2>
              <p className="text-gray-600">Customize the appearance and layout of your business documents</p>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { type: 'estimate', name: 'Estimates', description: 'Quote templates' },
                { type: 'invoice', name: 'Invoices', description: 'Billing templates' },
                { type: 'sales_order', name: 'Sales Orders', description: 'Order confirmation templates' },
                { type: 'purchase_order', name: 'Purchase Orders', description: 'Vendor order templates' }
              ].map(template => (
                <Card key={template.type} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded">
                        <FileText className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        <p className="text-xs text-gray-500">{template.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button
                      size="sm"
                      onClick={() => setShowTemplateEditor(true)}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      <Palette className="w-3 h-3 mr-1" />
                      Edit Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Template Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Global Settings</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <span className="text-sm font-medium">Company Logo</span>
                        {logoUrl && (
                          <div className="mt-2">
                            <img
                              src={logoUrl}
                              alt="Company Logo"
                              className="h-16 object-contain bg-gray-50 rounded border p-2"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUploadingLogo}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {isUploadingLogo ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-900 mr-1" />
                              Uploading...
                            </>
                          ) : uploadSuccess ? (
                            <>
                              <Check className="w-3 h-3 mr-1 text-green-600" />
                              Uploaded!
                            </>
                          ) : (
                            <>
                              <Upload className="w-3 h-3 mr-1" />
                              Upload Logo
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Default Currency</span>
                      <select className="border rounded px-2 py-1 text-sm">
                        <option>USD ($)</option>
                        <option>EUR (€)</option>
                        <option>GBP (£)</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Date Format</span>
                      <select className="border rounded px-2 py-1 text-sm">
                        <option>MM/DD/YYYY</option>
                        <option>DD/MM/YYYY</option>
                        <option>YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Quick Actions</h4>
                  <div className="flex gap-2">
                    <input
                      ref={templateImportRef}
                      type="file"
                      accept=".json"
                      onChange={handleImportTemplates}
                      className="hidden"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => templateImportRef.current?.click()}
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Import Templates
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExportTemplates}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Export Templates
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleResetToDefaults}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Reset to Defaults
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      
      case 'users':
        return <UserManagement />
      
      case 'company':
        return (
          <div className="p-6 text-center">
            <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Company Profile</h3>
            <p className="text-gray-600">Coming soon - Configure company information</p>
          </div>
        )
      
      case 'integrations':
        return (
          <div className="p-6 text-center">
            <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Integrations</h3>
            <p className="text-gray-600">Coming soon - Connect with third-party services</p>
          </div>
        )
      
      case 'notifications':
        return (
          <div className="p-6 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Notifications</h3>
            <p className="text-gray-600">Coming soon - Configure notification preferences</p>
          </div>
        )
      
      case 'security':
        return (
          <div className="p-6 text-center">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Security Settings</h3>
            <p className="text-gray-600">Coming soon - Manage security and access controls</p>
          </div>
        )
      
      case 'appearance':
        return (
          <div className="p-6 text-center">
            <Palette className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Appearance</h3>
            <p className="text-gray-600">Coming soon - Customize themes and layouts</p>
          </div>
        )
      
      case 'data':
        return (
          <div className="p-6 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Data Management</h3>
            <p className="text-gray-600">Coming soon - Backup and data management tools</p>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your ERP system configuration and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Categories Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                {categories.map((category) => {
                  const Icon = category.icon
                  const isActive = activeCategory === category.id
                  return (
                    <button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        isActive
                          ? 'bg-blue-50 border border-blue-200 text-blue-900'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`w-5 h-5 mt-0.5 ${isActive ? 'text-blue-600' : category.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${isActive ? 'text-blue-900' : 'text-gray-900'}`}>
                            {category.name}
                          </p>
                          <p className={`text-xs mt-1 ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>
                            {category.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              {renderSettingsContent()}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <TemplateEditor
          onClose={() => setShowTemplateEditor(false)}
          templateType="estimate"
        />
      )}

      {/* Terms Editor Modal */}
      {showTermsEditor && (
        <TermsEditor
          onClose={() => setShowTermsEditor(false)}
        />
      )}
    </div>
  )
}