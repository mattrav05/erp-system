'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  Settings,
  Eye,
  PlayCircle,
  Loader2
} from 'lucide-react'
import { parseCSV, validateCSVData, suggestFieldMappings, detectDelimiter } from '@/lib/csv-utils'
import FieldMappingEditor from './field-mapping-editor'
import ImportPreview from './import-preview'

interface ImportStep {
  id: number
  title: string
  description: string
  completed: boolean
}

const IMPORT_STEPS: ImportStep[] = [
  {
    id: 1,
    title: 'Select Module & File',
    description: 'Choose what to import and upload your CSV file',
    completed: false
  },
  {
    id: 2,
    title: 'Configure Mapping',
    description: 'Map CSV columns to database fields',
    completed: false
  },
  {
    id: 3,
    title: 'Preview & Validate',
    description: 'Review data and fix any errors',
    completed: false
  },
  {
    id: 4,
    title: 'Import Data',
    description: 'Process and import your data',
    completed: false
  }
]

const AVAILABLE_MODULES = [
  { id: 'customers', name: 'Customers', description: 'Customer contact and billing information' },
  { id: 'vendors', name: 'Vendors', description: 'Supplier and vendor information' },
  { id: 'products', name: 'Products', description: 'Product catalog and specifications' },
  { id: 'inventory', name: 'Inventory', description: 'Stock levels and inventory tracking' },
  { id: 'sales_orders', name: 'Sales Orders', description: 'Customer orders and line items' },
  { id: 'purchase_orders', name: 'Purchase Orders', description: 'Vendor orders and line items' },
  { id: 'estimates', name: 'Estimates', description: 'Customer quotes and estimates' },
  { id: 'invoices', name: 'Invoices', description: 'Customer invoices and billing' }
]

export default function ImportWizard() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedModule, setSelectedModule] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [fieldMappings, setFieldMappings] = useState<any[]>([])
  const [validationResult, setValidationResult] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState<any>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      alert('Please select a CSV file')
      return
    }

    try {
      setIsProcessing(true)
      setCsvFile(file)
      
      const content = await file.text()
      const delimiter = detectDelimiter(content)
      const data = parseCSV(content, { delimiter, maxRows: 1000 })
      
      setCsvData(data)
      setCsvHeaders(data.length > 0 ? Object.keys(data[0]).filter(k => k !== '_rowNumber') : [])
      
      // Auto-suggest field mappings
      if (selectedModule && data.length > 0) {
        const suggested = suggestFieldMappings(Object.keys(data[0]).filter(k => k !== '_rowNumber'), selectedModule)
        setFieldMappings(suggested)
      }
      
      console.log(`✅ Loaded ${data.length} rows from ${file.name}`)
      
    } catch (error) {
      console.error('File upload error:', error)
      alert(`Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleModuleSelect = (moduleId: string) => {
    setSelectedModule(moduleId)
    
    // Re-suggest mappings if we have CSV data
    if (csvHeaders.length > 0) {
      const suggested = suggestFieldMappings(csvHeaders, moduleId)
      setFieldMappings(suggested)
    }
  }

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 2:
        return selectedModule && csvFile && csvData.length > 0
      case 3:
        return fieldMappings.length > 0 && fieldMappings.some(m => m.dbField)
      case 4:
        return validationResult?.isValid
      default:
        return true
    }
  }

  const handleStepNavigation = (step: number) => {
    if (step > currentStep && !canProceedToStep(step)) {
      return
    }
    setCurrentStep(step)
  }

  const handleValidation = async () => {
    if (!csvData.length || !fieldMappings.length) {
      return
    }

    try {
      setIsProcessing(true)
      
      // First run client-side validation
      const clientResult = validateCSVData(csvData, fieldMappings, selectedModule)
      
      if (clientResult.isValid) {
        // Run server-side validation for more comprehensive checks
        const response = await fetch('/api/import', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            csvData,
            mappings: fieldMappings,
            module: selectedModule
          })
        })

        if (response.ok) {
          const serverResult = await response.json()
          setValidationResult(serverResult)
          
          if (serverResult.isValid) {
            console.log('✅ Validation passed')
          } else {
            console.log(`❌ Validation failed: ${serverResult.errors.length} errors`)
          }
        } else {
          console.error('Server validation failed')
          setValidationResult(clientResult) // Fallback to client validation
        }
      } else {
        setValidationResult(clientResult)
        console.log(`❌ Client validation failed: ${clientResult.errors.length} errors`)
      }
      
    } catch (error) {
      console.error('Validation error:', error)
      alert('Error during validation')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleImport = async () => {
    if (!validationResult?.isValid || !csvData.length) {
      return
    }

    try {
      setIsProcessing(true)
      setImportProgress(0)
      
      console.log(`🚀 Starting import of ${csvData.length} records for ${selectedModule}`)
      
      // Start import process
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvData,
          mappings: fieldMappings,
          module: selectedModule,
          options: {
            duplicateHandling: 'skip', // TODO: Make this configurable
            batchSize: 50
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Import failed')
      }

      // Simulate progress updates while waiting for response
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + Math.random() * 15, 90))
      }, 500)

      const result = await response.json()
      
      clearInterval(progressInterval)
      setImportProgress(100)
      
      console.log('✅ Import completed:', result)
      
      setImportResults({
        success: result.success,
        totalRows: result.totalRows,
        imported: result.imported,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors || [],
        jobId: result.jobId
      })
      
    } catch (error) {
      console.error('❌ Import error:', error)
      setImportResults({
        success: false,
        totalRows: csvData.length,
        imported: 0,
        failed: csvData.length,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Select Module to Import</Label>
              <p className="text-sm text-gray-600 mb-4">Choose which type of data you want to import</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AVAILABLE_MODULES.map((module) => (
                  <Card
                    key={module.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedModule === module.id ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                    }`}
                    onClick={() => handleModuleSelect(module.id)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{module.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-gray-600">{module.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {selectedModule && (
              <div>
                <Label className="text-base font-medium">Upload CSV File</Label>
                <p className="text-sm text-gray-600 mb-4">Select the CSV file containing your {selectedModule} data</p>
                
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  {csvFile ? (
                    <div>
                      <p className="text-sm font-medium text-green-600">{csvFile.name}</p>
                      <p className="text-xs text-gray-500">{(csvFile.size / 1024).toFixed(1)} KB • {csvData.length} rows detected</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Click to upload CSV file</p>
                      <p className="text-xs text-gray-500">Supports CSV files up to 10MB</p>
                    </div>
                  )}
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Configure Field Mapping</h3>
              <p className="text-sm text-gray-600">Map your CSV columns to database fields</p>
            </div>
            
            {csvHeaders.length > 0 && (
              <FieldMappingEditor
                headers={csvHeaders}
                mappings={fieldMappings}
                module={selectedModule}
                onMappingsChange={setFieldMappings}
                sampleData={csvData.slice(0, 3)}
              />
            )}
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Preview & Validate</h3>
                <p className="text-sm text-gray-600">Review your data and fix any validation errors</p>
              </div>
              <Button onClick={handleValidation} disabled={isProcessing}>
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Settings className="w-4 h-4 mr-2" />
                )}
                {isProcessing ? 'Validating...' : 'Run Validation'}
              </Button>
            </div>
            
            {validationResult && (
              <ImportPreview
                data={csvData.slice(0, 50)}
                mappings={fieldMappings}
                validationResult={validationResult}
              />
            )}
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Import Data</h3>
              <p className="text-sm text-gray-600">
                {importResults ? 'Import completed' : 'Ready to import your data'}
              </p>
            </div>

            {!importResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Import Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Module:</span>
                      <span className="font-medium ml-2">{selectedModule}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Rows:</span>
                      <span className="font-medium ml-2">{csvData.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Validation:</span>
                      <Badge className={`ml-2 ${validationResult?.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {validationResult?.isValid ? 'Passed' : 'Failed'}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-600">Errors:</span>
                      <span className="font-medium ml-2">{validationResult?.errors?.length || 0}</span>
                    </div>
                  </div>
                  
                  {isProcessing && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Processing...</span>
                        <span>{Math.round(importProgress)}%</span>
                      </div>
                      <Progress value={importProgress} />
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleImport} 
                    disabled={isProcessing || !validationResult?.isValid}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Start Import
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {importResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {importResults.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    Import Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{importResults.imported}</p>
                      <p className="text-sm text-gray-600">Imported</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{importResults.failed}</p>
                      <p className="text-sm text-gray-600">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">{importResults.skipped}</p>
                      <p className="text-sm text-gray-600">Skipped</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{importResults.totalRows}</p>
                      <p className="text-sm text-gray-600">Total</p>
                    </div>
                  </div>
                  
                  {importResults.errors && importResults.errors.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Errors:</h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {importResults.errors.map((error: string, index: number) => (
                          <p key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Step Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Import Wizard</CardTitle>
          <CardDescription>Follow these steps to import your data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            {IMPORT_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => handleStepNavigation(step.id)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    currentStep === step.id
                      ? 'bg-blue-600 text-white'
                      : currentStep > step.id
                      ? 'bg-green-600 text-white'
                      : canProceedToStep(step.id)
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={!canProceedToStep(step.id)}
                >
                  {currentStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
                </button>
                {index < IMPORT_STEPS.length - 1 && (
                  <div className={`w-12 h-px mx-2 ${currentStep > step.id ? 'bg-green-600' : 'bg-gray-300'}`} />
                )}
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <h3 className="font-medium">{IMPORT_STEPS[currentStep - 1]?.title}</h3>
            <p className="text-sm text-gray-600">{IMPORT_STEPS[currentStep - 1]?.description}</p>
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => handleStepNavigation(currentStep - 1)}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        
        <Button
          onClick={() => handleStepNavigation(currentStep + 1)}
          disabled={currentStep === 4 || !canProceedToStep(currentStep + 1)}
        >
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}