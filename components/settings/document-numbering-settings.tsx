'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Hash, 
  FileText, 
  Receipt, 
  ShoppingCart, 
  Package,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Save
} from 'lucide-react'

interface NumberingConfig {
  document_type: string
  current_number: number
  prefix: string
  format: string
}

interface CompanySettings {
  estimate_next_number: number
  invoice_next_number: number
  sales_order_next_number: number
  purchase_order_next_number: number
  estimate_prefix: string
  invoice_prefix: string
  sales_order_prefix: string
  purchase_order_prefix: string
}

interface ValidationResult {
  isValid: boolean
  suggestedNumber?: number
  conflictingNumbers?: string[]
  message: string
}

export default function DocumentNumberingSettings() {
  const [configs, setConfigs] = useState<NumberingConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingConfig, setEditingConfig] = useState<NumberingConfig | null>(null)
  const [newStartNumber, setNewStartNumber] = useState('')
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const documentTypes = [
    { 
      type: 'estimate', 
      name: 'Estimates', 
      icon: FileText, 
      prefix: 'EST',
      description: 'Quote and estimate documents',
      tableName: 'estimates',
      numberColumn: 'estimate_number'
    },
    { 
      type: 'invoice', 
      name: 'Invoices', 
      icon: Receipt, 
      prefix: 'INV',
      description: 'Billing and invoice documents',
      tableName: 'invoices',
      numberColumn: 'invoice_number'
    },
    { 
      type: 'sales_order', 
      name: 'Sales Orders', 
      icon: ShoppingCart, 
      prefix: 'SO',
      description: 'Customer order confirmations',
      tableName: 'sales_orders',
      numberColumn: 'so_number'
    },
    { 
      type: 'purchase_order', 
      name: 'Purchase Orders', 
      icon: Package, 
      prefix: 'PO',
      description: 'Vendor purchase orders',
      tableName: 'purchase_orders',
      numberColumn: 'po_number'
    }
  ]

  useEffect(() => {
    loadCurrentConfigs()
  }, [])

  const loadCurrentConfigs = async () => {
    setIsLoading(true)
    try {
      // Get company settings with numbering configuration
      const { data: companySettings, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('is_active', true)
        .single()

      if (error) throw error

      if (!companySettings) {
        throw new Error('No active company settings found')
      }

      const loadedConfigs: NumberingConfig[] = [
        {
          document_type: 'estimate',
          current_number: companySettings.estimate_next_number - 1, // Show current as one less than next
          prefix: companySettings.estimate_prefix,
          format: `${companySettings.estimate_prefix}-######`
        },
        {
          document_type: 'invoice',
          current_number: companySettings.invoice_next_number - 1,
          prefix: companySettings.invoice_prefix,
          format: `${companySettings.invoice_prefix}-######`
        },
        {
          document_type: 'sales_order',
          current_number: companySettings.sales_order_next_number - 1,
          prefix: companySettings.sales_order_prefix,
          format: `${companySettings.sales_order_prefix}-######`
        },
        {
          document_type: 'purchase_order',
          current_number: companySettings.purchase_order_next_number - 1,
          prefix: companySettings.purchase_order_prefix,
          format: `${companySettings.purchase_order_prefix}-######`
        }
      ]

      setConfigs(loadedConfigs)
    } catch (error) {
      console.error('Error loading numbering configs:', error)
      alert('Failed to load numbering settings. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const validateNewNumber = async (docType: string, startNumber: number): Promise<ValidationResult> => {
    const docTypeInfo = documentTypes.find(dt => dt.type === docType)
    if (!docTypeInfo) {
      return { isValid: false, message: 'Invalid document type' }
    }

    try {
      // Check if the proposed starting number conflicts with existing documents
      const proposedFormat = `${docTypeInfo.prefix}-${String(startNumber).padStart(6, '0')}`
      
      const { data: existingDoc, error } = await supabase
        .from(docTypeInfo.tableName)
        .select(docTypeInfo.numberColumn)
        .eq(docTypeInfo.numberColumn, proposedFormat)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (existingDoc) {
        // Number exists, find the next available number
        const { data: allDocs, error: allError } = await supabase
          .from(docTypeInfo.tableName)
          .select(docTypeInfo.numberColumn)
          .gte(docTypeInfo.numberColumn, proposedFormat)
          .order(docTypeInfo.numberColumn, { ascending: true })

        if (allError) throw allError

        let suggestedNumber = startNumber
        const conflictingNumbers: string[] = []

        if (allDocs) {
          for (const doc of allDocs) {
            const docNumber = (doc as any)[docTypeInfo.numberColumn]
            if (docNumber) {
              conflictingNumbers.push(docNumber)
              const match = docNumber.match(/(\d+)$/)
              if (match) {
                const existingNum = parseInt(match[1])
                if (existingNum >= suggestedNumber) {
                  suggestedNumber = existingNum + 1
                }
              }
            }
          }
        }

        return {
          isValid: false,
          suggestedNumber,
          conflictingNumbers: conflictingNumbers.slice(0, 5), // Show first 5 conflicts
          message: `Number ${proposedFormat} already exists. Suggested starting number: ${suggestedNumber}`
        }
      }

      return {
        isValid: true,
        message: `Number ${proposedFormat} is available and can be used as starting point`
      }
    } catch (error) {
      console.error('Error validating number:', error)
      return { isValid: false, message: 'Error validating number. Please try again.' }
    }
  }

  const handleStartEdit = (config: NumberingConfig) => {
    setEditingConfig(config)
    setNewStartNumber(String(config.current_number + 1))
    setValidationResult(null)
  }

  const handleValidateNumber = async () => {
    if (!editingConfig || !newStartNumber) return

    setIsValidating(true)
    const startNum = parseInt(newStartNumber)
    if (isNaN(startNum) || startNum < 1) {
      setValidationResult({
        isValid: false,
        message: 'Please enter a valid number greater than 0'
      })
      setIsValidating(false)
      return
    }

    const result = await validateNewNumber(editingConfig.document_type, startNum)
    setValidationResult(result)
    setIsValidating(false)
  }

  const handleApplyNewNumber = async () => {
    if (!editingConfig || !validationResult?.isValid) return

    setIsSaving(true)
    try {
      // Use the database function to reset numbering
      const { error } = await supabase.rpc('reset_document_numbering', {
        doc_type: editingConfig.document_type,
        new_start_number: parseInt(newStartNumber)
      })

      if (error) throw error

      // Refresh the configs to show the updated numbers
      await loadCurrentConfigs()

      alert(`Successfully set next ${editingConfig.document_type} number to start from ${newStartNumber}`)
      setEditingConfig(null)
      setNewStartNumber('')
      setValidationResult(null)
    } catch (error: any) {
      console.error('Error applying new number:', error)
      
      // Handle specific conflict errors from the database function
      if (error.message && error.message.includes('already exists')) {
        const existingNumber = error.message.match(/Number (.*?) already exists/)?.[1]
        if (existingNumber) {
          // Auto-suggest the next available number
          const currentNum = parseInt(newStartNumber)
          const { data: conflictData } = await supabase
            .from(documentTypes.find(dt => dt.type === editingConfig.document_type)!.tableName)
            .select(documentTypes.find(dt => dt.type === editingConfig.document_type)!.numberColumn)
            .gte(documentTypes.find(dt => dt.type === editingConfig.document_type)!.numberColumn, existingNumber)
            .order(documentTypes.find(dt => dt.type === editingConfig.document_type)!.numberColumn, { ascending: false })
            .limit(1)

          let suggestedNumber = currentNum + 1
          if (conflictData && conflictData.length > 0) {
            const lastDoc = conflictData[0]
            const lastNumber = (lastDoc as any)[documentTypes.find(dt => dt.type === editingConfig.document_type)!.numberColumn]
            const match = lastNumber.match(/(\d+)$/)
            if (match) {
              suggestedNumber = parseInt(match[1]) + 1
            }
          }

          setValidationResult({
            isValid: false,
            suggestedNumber,
            message: `Number ${existingNumber} already exists. Try ${suggestedNumber} instead.`
          })
        }
      } else {
        alert(`Failed to update numbering: ${error.message || 'Unknown error'}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleUseSuggested = () => {
    if (validationResult?.suggestedNumber) {
      setNewStartNumber(String(validationResult.suggestedNumber))
      setValidationResult(null)
    }
  }

  const formatCurrentNumber = (config: NumberingConfig) => {
    const nextNumber = config.current_number + 1
    return `${config.prefix}-${String(nextNumber).padStart(6, '0')}`
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Document Numbering</h2>
        <p className="text-gray-600">
          Configure starting numbers for your business documents. The system will intelligently handle conflicts and continue sequentially.
        </p>
      </div>

      {/* Document Types */}
      <div className="grid gap-4">
        {documentTypes.map(docType => {
          const config = configs.find(c => c.document_type === docType.type)
          const Icon = docType.icon
          const isEditing = editingConfig?.document_type === docType.type

          return (
            <Card key={docType.type} className={isEditing ? 'border-blue-500 shadow-md' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded">
                      <Icon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{docType.name}</h3>
                      <p className="text-sm text-gray-500 font-normal">{docType.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Next Number</div>
                    <Badge className="bg-green-100 text-green-800 font-mono">
                      {config ? formatCurrentNumber(config) : 'Loading...'}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isEditing ? (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Current highest:</span> {config?.current_number === 0 ? 'None' : formatCurrentNumber({ ...config!, current_number: config!.current_number - 1 })}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStartEdit(config!)}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Numbering
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          New Starting Number
                        </label>
                        <Input
                          type="number"
                          min="1"
                          value={newStartNumber}
                          onChange={(e) => {
                            setNewStartNumber(e.target.value)
                            setValidationResult(null)
                          }}
                          placeholder="Enter starting number..."
                          className="font-mono"
                        />
                      </div>
                      <div className="pt-6">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleValidateNumber}
                          disabled={isValidating || !newStartNumber}
                        >
                          {isValidating ? 'Checking...' : 'Validate'}
                        </Button>
                      </div>
                    </div>

                    {/* Validation Result */}
                    {validationResult && (
                      <div className={`p-3 rounded-lg border ${
                        validationResult.isValid 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-orange-50 border-orange-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          {validationResult.isValid ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className={`text-sm ${
                              validationResult.isValid ? 'text-green-800' : 'text-orange-800'
                            }`}>
                              {validationResult.message}
                            </p>
                            
                            {validationResult.conflictingNumbers && validationResult.conflictingNumbers.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-orange-700 mb-1">Conflicting numbers:</p>
                                <div className="flex flex-wrap gap-1">
                                  {validationResult.conflictingNumbers.map((num, idx) => (
                                    <Badge key={idx} className="bg-orange-100 text-orange-800 text-xs font-mono">
                                      {num}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {validationResult.suggestedNumber && (
                              <div className="mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleUseSuggested}
                                  className="text-xs"
                                >
                                  Use suggested: {validationResult.suggestedNumber}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={handleApplyNewNumber}
                        disabled={!validationResult?.isValid || isSaving}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {isSaving ? 'Applying...' : 'Apply Changes'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingConfig(null)
                          setNewStartNumber('')
                          setValidationResult(null)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Hash className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">How Document Numbering Works</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• The system automatically generates sequential numbers for each document type</li>
                <li>• If you reset to a number that already exists, we'll suggest the next available number</li>
                <li>• Once set, all new documents will continue from your chosen starting point</li>
                <li>• Existing documents are never modified - only future documents use the new sequence</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}