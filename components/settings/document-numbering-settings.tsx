'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { safeQuery } from '@/lib/supabase-query'
import { useFocusReload } from '@/hooks/use-focus-reload'
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
  Save,
  RefreshCw
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
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [editingConfig, setEditingConfig] = useState<NumberingConfig | null>(null)
  const [newStartNumber, setNewStartNumber] = useState('')
  const [newPrefix, setNewPrefix] = useState('')
  const [newFullFormat, setNewFullFormat] = useState('')
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [componentReady, setComponentReady] = useState(false)

  // Removed focus reload - was causing auth state issues

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
    console.log('Document numbering: Component mounted, starting initialization...')
    loadCurrentConfigs()
  }, [])

  // Add timeout handling to prevent infinite loading states
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.warn('Document numbering loading timeout - forcing error state')
          setIsLoading(false)
          setError('Loading timeout - please refresh the page or try again')
        }
      }, 10000) // 10 second timeout

      return () => clearTimeout(timeout)
    }
  }, [isLoading])

  // Component readiness monitoring
  useEffect(() => {
    if (!isLoading && !error) {
      console.log('Document numbering: Component ready')
      setComponentReady(true)
    } else {
      setComponentReady(false)
    }
  }, [isLoading, error])

  // Periodic health check to detect if component becomes unresponsive
  useEffect(() => {
    const healthCheck = setInterval(() => {
      if (!componentReady && !isLoading && !error) {
        console.warn('Document numbering: Component appears to be in invalid state, triggering recovery')
        loadCurrentConfigs()
      }
    }, 5000) // Check every 5 seconds

    return () => clearInterval(healthCheck)
  }, [componentReady, isLoading, error])

  const loadCurrentConfigs = async () => {
    console.log('Document numbering: Starting to load configs...')
    setIsLoading(true)
    setError(null)
    try {
      // Get company settings with numbering configuration
      console.log('Document numbering: Fetching company settings...')
      const { data: companySettings, error } = await safeQuery(
        () => supabase
          .from('company_settings')
          .select('*')
          .eq('is_active', true)
          .single(),
        'Loading company settings'
      )

      // Add detailed error logging
      if (error) {
        console.error('🚨 Company settings query failed:', {
          error: error,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })

        // Also check current auth state when query fails
        const { data: { session } } = await supabase.auth.getSession()
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        console.error('🚨 Auth state during failure:', {
          hasSession: !!session,
          sessionExpired: session?.expires_at ? session.expires_at * 1000 < Date.now() : 'no session',
          hasUser: !!user,
          userError: userError?.message,
          timestamp: new Date().toLocaleTimeString()
        })
      }

      if (error) {
        console.log('Document numbering: Database error:', error)
        // If no settings found, create default ones
        if (error.code === 'PGRST116') {
          console.log('No company settings found, creating defaults...')
          await createDefaultCompanySettings()
          return // Will reload after creation
        }
        throw error
      }

      if (!companySettings) {
        console.log('Document numbering: No settings data returned')
        throw new Error('No active company settings found')
      }

      console.log('Document numbering: Settings loaded successfully', companySettings)

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

      console.log('Document numbering: Configs processed:', loadedConfigs)
      setConfigs(loadedConfigs)
      setRetryCount(0) // Reset retry count on success
    } catch (error: any) {
      console.error('Document numbering: Error loading configs:', error)

      // After 3 retry attempts, use fallback mode instead of staying in error state
      if (retryCount >= 2) {
        console.log('Document numbering: Max retries reached, switching to fallback mode')
        setFallbackMode()
        return
      }

      setError(error.message || 'Failed to load numbering settings')
    } finally {
      console.log('Document numbering: Loading complete')
      setIsLoading(false)
    }
  }

  const createDefaultCompanySettings = async () => {
    try {
      console.log('Document numbering: Creating default company settings...')
      const defaultSettings = {
        company_name: 'Your Company',
        estimate_prefix: 'EST',
        estimate_next_number: 1,
        invoice_prefix: 'INV',
        invoice_next_number: 1,
        sales_order_prefix: 'SO',
        sales_order_next_number: 1,
        purchase_order_prefix: 'PO',
        purchase_order_next_number: 1,
        is_active: true
      }

      const { error } = await supabase
        .from('company_settings')
        .insert(defaultSettings)

      if (error) throw error

      console.log('Document numbering: Created default company settings')
      // Reload configs after creating defaults
      await loadCurrentConfigs()
    } catch (error) {
      console.error('Document numbering: Error creating default settings:', error)
      // If we can't create defaults, use client-side fallback
      setFallbackMode()
    }
  }

  const setFallbackMode = () => {
    console.log('Document numbering: Entering fallback mode with local defaults')
    const fallbackConfigs: NumberingConfig[] = [
      {
        document_type: 'estimate',
        current_number: 0,
        prefix: 'EST',
        format: 'EST-######'
      },
      {
        document_type: 'invoice',
        current_number: 0,
        prefix: 'INV',
        format: 'INV-######'
      },
      {
        document_type: 'sales_order',
        current_number: 0,
        prefix: 'SO',
        format: 'SO-######'
      },
      {
        document_type: 'purchase_order',
        current_number: 0,
        prefix: 'PO',
        format: 'PO-######'
      }
    ]

    setConfigs(fallbackConfigs)
    setIsLoading(false)
    setError('Database unavailable - using local defaults. Some features may be limited.')
  }

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    loadCurrentConfigs()
  }

  const validateNewFormat = async (docType: string, fullFormat: string): Promise<ValidationResult> => {
    const docTypeInfo = documentTypes.find(dt => dt.type === docType)
    if (!docTypeInfo) {
      return { isValid: false, message: 'Invalid document type' }
    }

    // Validate format contains placeholders for numbers
    if (!fullFormat.includes('#') && !fullFormat.match(/\d/)) {
      return { isValid: false, message: 'Format must contain either # placeholders or numbers' }
    }

    try {
      // Get the highest existing number to suggest next available
      const { data: allDocs, error: allError } = await supabase
        .from(docTypeInfo.tableName)
        .select(docTypeInfo.numberColumn)
        .order(docTypeInfo.numberColumn, { ascending: false })
        .limit(5)

      if (allError) throw allError

      let highestNumber = 0
      const existingNumbers: string[] = []

      if (allDocs) {
        for (const doc of allDocs) {
          const docNumber = (doc as any)[docTypeInfo.numberColumn]
          if (docNumber) {
            existingNumbers.push(docNumber)
            // Extract number from any format (EST-000123, INV123, SO-2024-001, etc.)
            const match = docNumber.match(/(\d+)(?!.*\d)/) // Last number in string
            if (match) {
              const num = parseInt(match[1])
              if (num > highestNumber) {
                highestNumber = num
              }
            }
          }
        }
      }

      const suggestedStartNumber = highestNumber + 1

      return {
        isValid: true,
        suggestedNumber: suggestedStartNumber,
        message: `Format will be applied. Current highest number found: ${highestNumber}. Suggested next: ${suggestedStartNumber}`
      }
    } catch (error) {
      console.error('Error validating number:', error)
      return { isValid: false, message: 'Error validating number. Please try again.' }
    }
  }

  const handleStartEdit = (config: NumberingConfig) => {
    setEditingConfig(config)
    setNewStartNumber(String(config.current_number + 1))
    setNewPrefix(config.prefix)
    setNewFullFormat(config.format || `${config.prefix}-######`)
    setValidationResult(null)
  }

  const handleValidateFormat = async () => {
    if (!editingConfig || !newFullFormat) return

    setIsValidating(true)

    const result = await validateNewFormat(editingConfig.document_type, newFullFormat)
    setValidationResult(result)
    setIsValidating(false)
  }

  const generateSampleFormat = (format: string, number: number = 1): string => {
    // Replace # placeholders with padded numbers
    let result = format
    const hashCount = (format.match(/#/g) || []).length
    if (hashCount > 0) {
      const paddedNumber = String(number).padStart(hashCount, '0')
      result = format.replace(/#+/, paddedNumber)
    }
    return result
  }

  const handleApplyNewFormat = async () => {
    if (!editingConfig || !validationResult?.isValid) return

    setIsSaving(true)
    try {
      // Update company settings with new format and starting number
      const startNum = validationResult.suggestedNumber || parseInt(newStartNumber) || 1

      const updateData: any = {}
      updateData[`${editingConfig.document_type}_prefix`] = newPrefix
      updateData[`${editingConfig.document_type}_next_number`] = startNum

      const { error } = await supabase
        .from('company_settings')
        .update(updateData)
        .eq('is_active', true)

      if (error) throw error

      // Refresh the configs to show the updated numbers
      await loadCurrentConfigs()

      alert(`Successfully updated ${editingConfig.document_type} numbering format and starting number`)
      setEditingConfig(null)
      setNewStartNumber('')
      setNewPrefix('')
      setNewFullFormat('')
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
    return generateSampleFormat(config.format || `${config.prefix}-######`, nextNumber)
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

  if (error && !configs.length) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Document Numbering</h3>
          <p className="text-gray-600 mb-4 max-w-md mx-auto">{error}</p>
          <div className="space-x-2 flex flex-wrap justify-center gap-2">
            {retryCount < 2 && (
              <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry {retryCount > 0 && `(${retryCount + 1}/3)`}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setError(null)
                createDefaultCompanySettings()
              }}
            >
              Create Default Settings
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setError(null)
                setFallbackMode()
              }}
              className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
            >
              Use Offline Mode
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-xl font-semibold text-gray-900">Document Numbering</h2>
          {error && configs.length > 0 && (
            <Badge className="bg-orange-100 text-orange-800">
              Limited Mode
            </Badge>
          )}
          {componentReady && !error && (
            <Badge className="bg-green-100 text-green-800">
              Connected
            </Badge>
          )}
        </div>
        <p className="text-gray-600">
          Configure starting numbers for your business documents. The system will intelligently handle conflicts and continue sequentially.
        </p>
        {error && configs.length > 0 && (
          <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              {error} Some features may not work correctly.
            </p>
          </div>
        )}
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
                      Edit Numbering
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Document Format
                        </label>
                        <Input
                          value={newFullFormat}
                          onChange={(e) => {
                            setNewFullFormat(e.target.value)
                            setValidationResult(null)
                          }}
                          placeholder="e.g., EST-######, INV-2024-###"
                          className="font-mono"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Use # for number placeholders (e.g., ###### = 000001)
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Starting Number
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
                    </div>

                    {/* Format Preview */}
                    {newFullFormat && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-sm text-blue-800">
                          <span className="font-medium">Preview:</span> {generateSampleFormat(newFullFormat, parseInt(newStartNumber) || 1)}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleValidateFormat}
                        disabled={isValidating || !newFullFormat}
                        className="flex items-center gap-2"
                      >
                        {isValidating ? 'Checking...' : 'Validate Format'}
                      </Button>
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
                        onClick={handleApplyNewFormat}
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
                          setNewPrefix('')
                          setNewFullFormat('')
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