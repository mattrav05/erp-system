'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  History, 
  Search, 
  Eye, 
  RotateCcw, 
  Download, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  FileText,
  Trash2,
  RefreshCw,
  Calendar,
  User,
  Database
} from 'lucide-react'

interface ImportJob {
  id: string
  userId: string
  module: string
  fileName: string
  fileSizeBytes: number
  totalRows: number
  rowsProcessed: number
  rowsImported: number
  rowsFailed: number
  rowsSkipped: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rolled_back'
  errors: string[]
  warnings: string[]
  canRollback: boolean
  rolledBack: boolean
  rolledBackAt?: string
  createdAt: string
  completedAt?: string
  mappingUsed: any[]
  debugLog?: string
}

interface ExportJob {
  id: string
  userId: string
  module: string
  fileName: string
  fileSizeBytes: number
  totalRows: number
  rowsExported: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  errors: string[]
  fileUrl?: string
  expiresAt: string
  createdAt: string
  completedAt?: string
}

type Job = ImportJob | ExportJob

export default function JobHistory() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<ImportJob | ExportJob | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    loadJobHistory()
  }, [])

  useEffect(() => {
    filterJobs()
  }, [jobs, searchTerm, statusFilter, typeFilter])

  const loadJobHistory = async () => {
    try {
      setIsLoading(true)
      
      // TODO: Replace with actual API calls
      // Simulate loading job history from database
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockJobs: (ImportJob | ExportJob)[] = [
        {
          id: '1',
          userId: 'user1',
          module: 'customers',
          fileName: 'customers_batch_1.csv',
          fileSizeBytes: 15420,
          totalRows: 150,
          rowsProcessed: 150,
          rowsImported: 147,
          rowsFailed: 2,
          rowsSkipped: 1,
          status: 'completed',
          errors: ['Row 15: Invalid email format', 'Row 89: Missing required field'],
          warnings: ['Row 45: Duplicate customer found, skipped'],
          canRollback: true,
          rolledBack: false,
          createdAt: '2025-01-15T10:30:00Z',
          completedAt: '2025-01-15T10:32:15Z',
          mappingUsed: [
            { csvColumn: 'Company Name', dbField: 'company_name', required: true },
            { csvColumn: 'Email', dbField: 'email', required: false }
          ]
        } as ImportJob,
        {
          id: '2',
          userId: 'user1',
          module: 'products',
          fileName: 'products_export_2025-01-14.csv',
          fileSizeBytes: 45680,
          totalRows: 1200,
          rowsExported: 1200,
          status: 'completed',
          errors: [],
          fileUrl: '/downloads/products_export_2025-01-14.csv',
          expiresAt: '2025-01-21T16:20:00Z',
          createdAt: '2025-01-14T16:20:00Z',
          completedAt: '2025-01-14T16:21:30Z'
        } as ExportJob,
        {
          id: '3',
          userId: 'user1',
          module: 'vendors',
          fileName: 'vendors_new.csv',
          fileSizeBytes: 8920,
          totalRows: 45,
          rowsProcessed: 15,
          rowsImported: 0,
          rowsFailed: 45,
          rowsSkipped: 0,
          status: 'failed',
          errors: [
            'Row 1: Invalid vendor name format',
            'Row 2: Missing required field: contact_name',
            'Critical error: Database connection lost'
          ],
          warnings: [],
          canRollback: false,
          rolledBack: false,
          createdAt: '2025-01-14T09:15:00Z',
          completedAt: '2025-01-14T09:16:45Z',
          mappingUsed: [
            { csvColumn: 'Vendor', dbField: 'vendor_name', required: true },
            { csvColumn: 'Contact', dbField: 'contact_name', required: true }
          ]
        } as ImportJob,
        {
          id: '4',
          userId: 'user1',
          module: 'customers',
          fileName: 'customer_import_rolled_back.csv',
          fileSizeBytes: 12340,
          totalRows: 100,
          rowsProcessed: 100,
          rowsImported: 95,
          rowsFailed: 5,
          rowsSkipped: 0,
          status: 'rolled_back',
          errors: ['Rollback requested by user'],
          warnings: [],
          canRollback: false,
          rolledBack: true,
          rolledBackAt: '2025-01-13T15:30:00Z',
          createdAt: '2025-01-13T14:45:00Z',
          completedAt: '2025-01-13T14:47:20Z',
          mappingUsed: []
        } as ImportJob
      ]
      
      setJobs(mockJobs)
      
    } catch (error) {
      console.error('Error loading job history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterJobs = () => {
    let filtered = jobs

    // Apply search filter
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase()
      filtered = filtered.filter(job => 
        job.fileName.toLowerCase().includes(lowerSearchTerm) ||
        job.module.toLowerCase().includes(lowerSearchTerm) ||
        job.status.toLowerCase().includes(lowerSearchTerm)
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => job.status === statusFilter)
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      if (typeFilter === 'import') {
        filtered = filtered.filter(job => 'rowsImported' in job)
      } else if (typeFilter === 'export') {
        filtered = filtered.filter(job => 'rowsExported' in job)
      }
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    setFilteredJobs(filtered)
  }

  const handleRollback = async (job: ImportJob) => {
    if (!job.canRollback || job.rolledBack) {
      alert('This import cannot be rolled back')
      return
    }

    if (!confirm(`Are you sure you want to rollback the import "${job.fileName}"? This will remove all ${job.rowsImported} imported records.`)) {
      return
    }

    try {
      console.log(`🔄 Rolling back import job: ${job.id}`)
      
      // TODO: Implement actual rollback API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Update job status
      const updatedJobs = jobs.map(j =>
        j.id === job.id ? {
          ...j,
          status: 'rolled_back' as const,
          rolledBack: true,
          rolledBackAt: new Date().toISOString(),
          canRollback: false
        } as Job : j
      )
      setJobs(updatedJobs)
      
      alert('Import successfully rolled back')
      
    } catch (error) {
      console.error('Rollback error:', error)
      alert('Failed to rollback import')
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job record? This action cannot be undone.')) {
      return
    }

    try {
      // TODO: Implement actual delete API call
      const updatedJobs = jobs.filter(job => job.id !== jobId)
      setJobs(updatedJobs)
      
      if (selectedJob?.id === jobId) {
        setSelectedJob(null)
        setShowDetails(false)
      }
      
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete job')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'rolled_back':
        return <RotateCcw className="w-4 h-4 text-orange-600" />
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'rolled_back':
        return 'bg-orange-100 text-orange-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getJobTypeIcon = (job: ImportJob | ExportJob) => {
    return 'rowsImported' in job ? (
      <Upload className="w-4 h-4 text-blue-600" />
    ) : (
      <Download className="w-4 h-4 text-green-600" />
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const calculateDuration = (startDate: string, endDate?: string) => {
    if (!endDate) return 'In progress'
    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime()
    const seconds = Math.round((end - start) / 1000)
    return `${seconds}s`
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Job History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              <option value="import">Import Jobs</option>
              <option value="export">Export Jobs</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="processing">Processing</option>
              <option value="rolled_back">Rolled Back</option>
            </select>

            <Button variant="outline" onClick={loadJobHistory}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Job List */}
      <div className="space-y-4">
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'No jobs match your current filters.'
                  : 'No import or export jobs have been run yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getJobTypeIcon(job)}
                      <h3 className="font-medium text-lg">{job.fileName}</h3>
                      <Badge variant="outline" className="text-xs">
                        {job.module}
                      </Badge>
                      <Badge className={`text-xs ${getStatusColor(job.status)}`}>
                        {getStatusIcon(job.status)}
                        <span className="ml-1">{job.status.replace('_', ' ')}</span>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Total Rows:</span>
                        <span className="ml-2">{job.totalRows}</span>
                      </div>
                      {'rowsImported' in job ? (
                        <>
                          <div>
                            <span className="font-medium">Imported:</span>
                            <span className="ml-2 text-green-600">{job.rowsImported}</span>
                          </div>
                          <div>
                            <span className="font-medium">Failed:</span>
                            <span className="ml-2 text-red-600">{job.rowsFailed}</span>
                          </div>
                          <div>
                            <span className="font-medium">Skipped:</span>
                            <span className="ml-2 text-yellow-600">{job.rowsSkipped}</span>
                          </div>
                        </>
                      ) : (
                        <div>
                          <span className="font-medium">Exported:</span>
                          <span className="ml-2 text-green-600">{job.rowsExported}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(job.createdAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {calculateDuration(job.createdAt, job.completedAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {formatFileSize(job.fileSizeBytes)}
                      </div>
                    </div>

                    {job.errors.length > 0 && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-800">
                          {job.errors.length} error{job.errors.length > 1 ? 's' : ''}: {job.errors[0]}
                          {job.errors.length > 1 && ` (and ${job.errors.length - 1} more)`}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedJob(job)
                        setShowDetails(true)
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Details
                    </Button>

                    {'rowsImported' in job && job.canRollback && !job.rolledBack && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRollback(job)}
                        className="text-orange-600 hover:text-orange-700"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Rollback
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteJob(job.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Job Details Modal */}
      {showDetails && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getJobTypeIcon(selectedJob)}
                  Job Details: {selectedJob.fileName}
                </div>
                <Button variant="outline" onClick={() => setShowDetails(false)}>
                  ×
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Job Summary */}
              <div>
                <h4 className="font-medium mb-3">Job Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon(selectedJob.status)}
                      <span className="font-medium">{selectedJob.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Module:</span>
                    <span className="font-medium ml-2">{selectedJob.module}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">File Size:</span>
                    <span className="font-medium ml-2">{formatFileSize(selectedJob.fileSizeBytes)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Started:</span>
                    <span className="font-medium ml-2">{formatDate(selectedJob.createdAt)}</span>
                  </div>
                  {selectedJob.completedAt && (
                    <div>
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-medium ml-2">{formatDate(selectedJob.completedAt)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium ml-2">{calculateDuration(selectedJob.createdAt, selectedJob.completedAt)}</span>
                  </div>
                </div>
              </div>

              {/* Processing Results */}
              {'rowsImported' in selectedJob ? (
                <div>
                  <h4 className="font-medium mb-3">Import Results</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-2xl font-bold">{selectedJob.totalRows}</p>
                      <p className="text-sm text-gray-600">Total Rows</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded">
                      <p className="text-2xl font-bold text-green-600">{selectedJob.rowsImported}</p>
                      <p className="text-sm text-gray-600">Imported</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded">
                      <p className="text-2xl font-bold text-red-600">{selectedJob.rowsFailed}</p>
                      <p className="text-sm text-gray-600">Failed</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded">
                      <p className="text-2xl font-bold text-yellow-600">{selectedJob.rowsSkipped}</p>
                      <p className="text-sm text-gray-600">Skipped</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="font-medium mb-3">Export Results</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-2xl font-bold">{selectedJob.totalRows}</p>
                      <p className="text-sm text-gray-600">Total Rows</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded">
                      <p className="text-2xl font-bold text-green-600">{selectedJob.rowsExported}</p>
                      <p className="text-sm text-gray-600">Exported</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Field Mappings */}
              {'mappingUsed' in selectedJob && selectedJob.mappingUsed && selectedJob.mappingUsed.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Field Mappings Used</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-3 py-2 text-left">CSV Column</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Database Field</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedJob.mappingUsed.map((mapping, index) => (
                          <tr key={index}>
                            <td className="border border-gray-300 px-3 py-2 font-mono text-xs">{mapping.csvColumn}</td>
                            <td className="border border-gray-300 px-3 py-2">{mapping.dbField}</td>
                            <td className="border border-gray-300 px-3 py-2">{mapping.required ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Errors */}
              {selectedJob.errors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 text-red-800">Errors ({selectedJob.errors.length})</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {selectedJob.errors.map((error, index) => (
                      <div key={index} className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {'warnings' in selectedJob && selectedJob.warnings.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 text-yellow-800">Warnings ({selectedJob.warnings.length})</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {selectedJob.warnings.map((warning, index) => (
                      <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}