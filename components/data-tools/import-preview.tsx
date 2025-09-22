'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  EyeOff,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

interface ImportPreviewProps {
  data: any[]
  mappings: any[]
  validationResult: {
    isValid: boolean
    errors: any[]
    warnings: any[]
    rowCount: number
    columnCount: number
    headers: string[]
    sampleData: any[]
  }
}

export default function ImportPreview({ data, mappings, validationResult }: ImportPreviewProps) {
  const [showOnlyErrors, setShowOnlyErrors] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [showWarnings, setShowWarnings] = useState(true)

  const mappedFields = mappings.filter(m => m.dbField)
  const rowErrors = new Map<number, any[]>()
  const rowWarnings = new Map<number, any[]>()

  // Group errors and warnings by row
  validationResult.errors.forEach(error => {
    if (error.row) {
      if (!rowErrors.has(error.row)) {
        rowErrors.set(error.row, [])
      }
      rowErrors.get(error.row)?.push(error)
    }
  })

  validationResult.warnings.forEach(warning => {
    if (warning.row) {
      if (!rowWarnings.has(warning.row)) {
        rowWarnings.set(warning.row, [])
      }
      rowWarnings.get(warning.row)?.push(warning)
    }
  })

  const toggleRowExpansion = (rowNumber: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(rowNumber)) {
      newExpanded.delete(rowNumber)
    } else {
      newExpanded.add(rowNumber)
    }
    setExpandedRows(newExpanded)
  }

  const getRowStatus = (rowNumber: number) => {
    if (rowErrors.has(rowNumber)) return 'error'
    if (rowWarnings.has(rowNumber)) return 'warning'
    return 'success'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'success':
        return 'bg-green-50 border-green-200'
      default:
        return 'bg-white'
    }
  }

  const filteredData = showOnlyErrors 
    ? data.filter(row => rowErrors.has(row._rowNumber))
    : data

  return (
    <div className="space-y-6">
      {/* Validation Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {validationResult.isValid ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            Validation Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{validationResult.rowCount}</p>
              <p className="text-sm text-gray-600">Total Rows</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {validationResult.rowCount - validationResult.errors.filter(e => e.row).length}
              </p>
              <p className="text-sm text-gray-600">Valid Rows</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {validationResult.errors.filter(e => e.row).length}
              </p>
              <p className="text-sm text-gray-600">Error Rows</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {validationResult.warnings.filter(w => w.row).length}
              </p>
              <p className="text-sm text-gray-600">Warning Rows</p>
            </div>
          </div>

          {/* Global Errors */}
          {validationResult.errors.filter(e => !e.row).length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">Configuration Errors</h4>
              <div className="space-y-1">
                {validationResult.errors.filter(e => !e.row).map((error, index) => (
                  <p key={index} className="text-sm text-red-700">{error.message}</p>
                ))}
              </div>
            </div>
          )}

          {/* Filter Controls */}
          <div className="flex gap-3">
            <Button
              variant={showOnlyErrors ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyErrors(!showOnlyErrors)}
            >
              {showOnlyErrors ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showOnlyErrors ? 'Show All Rows' : 'Show Only Errors'}
            </Button>
            <Button
              variant={showWarnings ? "default" : "outline"}
              size="sm"
              onClick={() => setShowWarnings(!showWarnings)}
            >
              {showWarnings ? 'Hide Warnings' : 'Show Warnings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Data Preview</CardTitle>
          <p className="text-sm text-gray-600">
            Showing {filteredData.length} of {validationResult.rowCount} rows
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredData.map((row) => {
              const rowNumber = row._rowNumber
              const status = getRowStatus(rowNumber)
              const isExpanded = expandedRows.has(rowNumber)
              const errors = rowErrors.get(rowNumber) || []
              const warnings = rowWarnings.get(rowNumber) || []
              
              return (
                <div
                  key={rowNumber}
                  className={`border rounded-lg p-3 transition-all ${getStatusColor(status)}`}
                >
                  {/* Row Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRowExpansion(rowNumber)}
                        className="p-1 h-6 w-6"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                      
                      {getStatusIcon(status)}
                      
                      <span className="text-sm font-medium">
                        Row {rowNumber}
                      </span>
                      
                      {errors.length > 0 && (
                        <Badge className="bg-red-100 text-red-800 text-xs">
                          {errors.length} error{errors.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                      
                      {showWarnings && warnings.length > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                          {warnings.length} warning{warnings.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Quick preview of mapped data */}
                    <div className="flex gap-2 max-w-md overflow-hidden">
                      {mappedFields.slice(0, 3).map(mapping => (
                        <span key={mapping.csvColumn} className="text-xs text-gray-600 truncate">
                          {row[mapping.csvColumn] || '-'}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                      {/* Data Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th className="text-left py-1 px-2 font-medium text-gray-700">Field</th>
                              <th className="text-left py-1 px-2 font-medium text-gray-700">CSV Value</th>
                              <th className="text-left py-1 px-2 font-medium text-gray-700">DB Field</th>
                              <th className="text-left py-1 px-2 font-medium text-gray-700">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mappedFields.map(mapping => (
                              <tr key={mapping.csvColumn} className="border-t">
                                <td className="py-1 px-2 font-mono text-xs">{mapping.csvColumn}</td>
                                <td className="py-1 px-2 text-xs">
                                  {row[mapping.csvColumn] || <span className="text-gray-400">empty</span>}
                                </td>
                                <td className="py-1 px-2 text-xs">{mapping.dbField}</td>
                                <td className="py-1 px-2 text-xs">{mapping.dataType}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Errors */}
                      {errors.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded">
                          <h5 className="font-medium text-red-800 text-sm mb-2">Errors</h5>
                          <div className="space-y-1">
                            {errors.map((error, index) => (
                              <div key={index} className="text-sm text-red-700">
                                <span className="font-medium">{error.column}:</span> {error.message}
                                {error.value && (
                                  <span className="text-xs text-red-600 ml-2">
                                    (value: "{error.value}")
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Warnings */}
                      {showWarnings && warnings.length > 0 && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <h5 className="font-medium text-yellow-800 text-sm mb-2">Warnings</h5>
                          <div className="space-y-1">
                            {warnings.map((warning, index) => (
                              <div key={index} className="text-sm text-yellow-700">
                                <span className="font-medium">{warning.column}:</span> {warning.message}
                                {warning.value && (
                                  <span className="text-xs text-yellow-600 ml-2">
                                    (value: "{warning.value}")
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}