'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/providers/auth-provider'
import { supabase } from '@/lib/supabase'
import { ReportsService, type ReportTemplate, type SavedReport, type ReportExecution } from '@/lib/reports'
import { 
  PieChart, 
  BarChart3, 
  LineChart, 
  FileText, 
  Play, 
  Save, 
  Download,
  Folder,
  Plus,
  Settings,
  Clock,
  Star,
  Users,
  User,
  Filter,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  DollarSign,
  Calendar,
  Zap,
  Code,
  Eye,
  Edit,
  Copy,
  Share2
} from 'lucide-react'

// Icon mapping for templates
const getTemplateIcon = (iconName: string) => {
  const icons: { [key: string]: any } = {
    AlertTriangle,
    DollarSign,
    TrendingUp,
    FileText,
    BarChart3,
    LineChart,
    Package,
    PieChart
  }
  return icons[iconName] || Package
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [currentView, setCurrentView] = useState<'templates' | 'saved' | 'builder' | 'sql'>('templates')
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  const [savedReports, setSavedReports] = useState<SavedReport[]>([])
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [parameterValues, setParameterValues] = useState<{ [key: string]: any }>({})

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load templates
      const templates = await ReportsService.getTemplates()
      setReportTemplates(templates)

      // Load saved reports if user is logged in
      if (user) {
        const saved = await ReportsService.getSavedReports(user.id)
        setSavedReports(saved)
      }

    } catch (err: any) {
      console.error('Error loading report data:', err)
      setError(err.message || 'Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const runTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template)
    // Initialize parameter values with defaults
    const defaultParams: { [key: string]: any } = {}
    template.parameters?.forEach(param => {
      defaultParams[param.id] = param.defaultValue
    })
    setParameterValues(defaultParams)
    setCurrentView('builder')
  }

  const [reportResults, setReportResults] = useState<any[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [executionTime, setExecutionTime] = useState<number>(0)

  const executeReport = async () => {
    if (!selectedTemplate || !user) return
    
    setIsRunning(true)
    
    try {
      const result = await ReportsService.executeReport(
        selectedTemplate.id,
        parameterValues,
        user.id
      )

      if (result.status === 'success') {
        setReportResults(result.result_data || [])
        setExecutionTime(result.execution_time_ms)
      } else {
        alert('Error running report: ' + result.error_message)
        setReportResults([])
      }
      
    } catch (error: any) {
      console.error('Report execution error:', error)
      alert('Error running report: ' + error.message)
      setReportResults([])
    } finally {
      setIsRunning(false)
    }
  }

  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveReportName, setSaveReportName] = useState('')
  const [saveReportDescription, setSaveReportDescription] = useState('')
  const [customSQL, setCustomSQL] = useState('')
  const [sqlResults, setSqlResults] = useState<any[]>([])
  const [sqlExecutionTime, setSqlExecutionTime] = useState(0)
  const [isSqlRunning, setIsSqlRunning] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')

  const saveReport = async () => {
    if (!selectedTemplate || !user || !saveReportName.trim()) return

    try {
      const savedReport = await ReportsService.saveReport(
        selectedTemplate.id,
        saveReportName,
        saveReportDescription,
        parameterValues,
        user.id
      )

      setSavedReports(prev => [...prev, savedReport])
      setShowSaveDialog(false)
      setSaveReportName('')
      setSaveReportDescription('')
      alert('Report saved successfully!')
      
    } catch (error: any) {
      console.error('Error saving report:', error)
      alert('Error saving report: ' + error.message)
    }
  }

  const runSavedReport = (report: SavedReport) => {
    const template = reportTemplates.find(t => t.id === report.template_id)
    if (template) {
      setSelectedTemplate(template)
      setParameterValues(report.parameter_values)
      setCurrentView('builder')
    }
  }

  const executeCustomSQL = async () => {
    if (!customSQL.trim() || !user) return
    
    setIsSqlRunning(true)
    
    try {
      const result = await ReportsService.executeCustomSQL(customSQL, user.id)
      
      if (result.status === 'success') {
        setSqlResults(result.result_data || [])
        setSqlExecutionTime(result.execution_time_ms)
      } else {
        alert('Error executing query: ' + result.error_message)
        setSqlResults([])
      }
      
    } catch (error: any) {
      console.error('SQL execution error:', error)
      alert('Error executing query: ' + error.message)
      setSqlResults([])
    } finally {
      setIsSqlRunning(false)
    }
  }

  const loadSampleQueries = () => {
    const samples = [
      `-- Top 10 products by quantity
SELECT 
  p.name,
  p.sku,
  i.quantity_on_hand,
  i.location
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE i.quantity_on_hand > 0
ORDER BY i.quantity_on_hand DESC
LIMIT 10;`,
      
      `-- Products by category
SELECT 
  p.category,
  COUNT(*) as product_count,
  AVG(i.quantity_on_hand) as avg_quantity
FROM inventory i
JOIN products p ON i.product_id = p.id
GROUP BY p.category
ORDER BY product_count DESC;`,
      
      `-- Inventory value by location
SELECT 
  i.location,
  SUM(i.quantity_on_hand * i.weighted_average_cost) as total_value,
  COUNT(*) as item_count
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE i.location IS NOT NULL
GROUP BY i.location
ORDER BY total_value DESC;`
    ]
    
    const randomSample = samples[Math.floor(Math.random() * samples.length)]
    setCustomSQL(randomSample)
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Get insights from your business data - no technical skills required</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentView('sql')}
            className="text-gray-600"
          >
            <Code className="h-4 w-4 mr-2" />
            SQL Console
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setCurrentView('templates')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            currentView === 'templates'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Package className="h-4 w-4 mr-2 inline" />
          Report Templates
        </button>
        <button
          onClick={() => setCurrentView('saved')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            currentView === 'saved'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Folder className="h-4 w-4 mr-2 inline" />
          My Reports ({savedReports.length})
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        
        {/* Templates View */}
        {currentView === 'templates' && (
          <div>
            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading templates...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <Card className="text-center py-12">
                <CardContent>
                  <AlertTriangle className="h-12 w-12 mx-auto text-red-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load templates</h3>
                  <p className="text-gray-600 mb-4">{error}</p>
                  <Button onClick={loadData} variant="outline">
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Templates Content */}
            {!loading && !error && (
              <>
                {/* Category and Difficulty Filters */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Filter by Category:</label>
                    <div className="flex gap-2 flex-wrap">
                      <Badge 
                        variant={selectedCategory === 'all' ? 'default' : 'outline'} 
                        className="cursor-pointer hover:bg-blue-50"
                        onClick={() => setSelectedCategory('all')}
                      >
                        All Templates ({reportTemplates.length})
                      </Badge>
                      <Badge 
                        variant={selectedCategory === 'inventory' ? 'default' : 'outline'} 
                        className="cursor-pointer hover:bg-green-50"
                        onClick={() => setSelectedCategory('inventory')}
                      >
                        Inventory ({reportTemplates.filter(t => t.category === 'inventory').length})
                      </Badge>
                      <Badge 
                        variant={selectedCategory === 'financial' ? 'default' : 'outline'} 
                        className="cursor-pointer hover:bg-blue-50"
                        onClick={() => setSelectedCategory('financial')}
                      >
                        Financial ({reportTemplates.filter(t => t.category === 'financial').length})
                      </Badge>
                      <Badge 
                        variant={selectedCategory === 'analytics' ? 'default' : 'outline'} 
                        className="cursor-pointer hover:bg-purple-50"
                        onClick={() => setSelectedCategory('analytics')}
                      >
                        Analytics ({reportTemplates.filter(t => t.category === 'analytics').length})
                      </Badge>
                      <Badge 
                        variant={selectedCategory === 'operations' ? 'default' : 'outline'} 
                        className="cursor-pointer hover:bg-orange-50"
                        onClick={() => setSelectedCategory('operations')}
                      >
                        Operations ({reportTemplates.filter(t => t.category === 'operations').length})
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Filter by Difficulty:</label>
                    <div className="flex gap-2">
                      <Badge 
                        variant={selectedDifficulty === 'all' ? 'default' : 'outline'} 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setSelectedDifficulty('all')}
                      >
                        All Levels
                      </Badge>
                      <Badge 
                        variant={selectedDifficulty === 'beginner' ? 'default' : 'outline'} 
                        className="cursor-pointer hover:bg-green-50"
                        onClick={() => setSelectedDifficulty('beginner')}
                      >
                        Beginner ({reportTemplates.filter(t => t.difficulty === 'beginner').length})
                      </Badge>
                      <Badge 
                        variant={selectedDifficulty === 'intermediate' ? 'default' : 'outline'} 
                        className="cursor-pointer hover:bg-yellow-50"
                        onClick={() => setSelectedDifficulty('intermediate')}
                      >
                        Intermediate ({reportTemplates.filter(t => t.difficulty === 'intermediate').length})
                      </Badge>
                      <Badge 
                        variant={selectedDifficulty === 'advanced' ? 'default' : 'outline'} 
                        className="cursor-pointer hover:bg-red-50"
                        onClick={() => setSelectedDifficulty('advanced')}
                      >
                        Advanced ({reportTemplates.filter(t => t.difficulty === 'advanced').length})
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Empty State */}
                {reportTemplates.length === 0 && (
                  <Card className="text-center py-12">
                    <CardContent>
                      <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No templates available</h3>
                      <p className="text-gray-600">Report templates will appear here once they are loaded.</p>
                    </CardContent>
                  </Card>
                )}

                {/* Template Grid */}
                {reportTemplates.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reportTemplates
                      .filter(template => {
                        const categoryMatch = selectedCategory === 'all' || template.category === selectedCategory
                        const difficultyMatch = selectedDifficulty === 'all' || template.difficulty === selectedDifficulty
                        return categoryMatch && difficultyMatch
                      })
                      .map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${
                          template.difficulty === 'beginner' ? 'bg-green-100' :
                          template.difficulty === 'intermediate' ? 'bg-yellow-100' : 'bg-red-100'
                        }`}>
                          {(() => {
                            const IconComponent = getTemplateIcon(template.icon_name)
                            return <IconComponent className={`h-5 w-5 ${
                              template.difficulty === 'beginner' ? 'text-green-600' :
                              template.difficulty === 'intermediate' ? 'text-yellow-600' : 'text-red-600'
                            }`} />
                          })()}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {template.difficulty}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {template.category}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {template.is_public && (
                        <div title="Public template">
                          <Users className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm mb-4">
                      {template.description}
                    </CardDescription>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {template.parameters?.length || 0} parameters
                      </span>
                      <Button 
                        size="sm" 
                        onClick={() => runTemplate(template)}
                        className="group-hover:bg-blue-600"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Use Template
                      </Button>
                    </div>
                      </CardContent>
                    </Card>
                  ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Saved Reports View */}
        {currentView === 'saved' && (
          <div>
            {savedReports.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Folder className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No saved reports yet</h3>
                  <p className="text-gray-600 mb-4">
                    Create custom reports from templates and save them for easy access
                  </p>
                  <Button onClick={() => setCurrentView('templates')}>
                    Browse Templates
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedReports.map((report) => (
                  <Card key={report.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{report.name}</CardTitle>
                            {report.is_favorite && (
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            )}
                          </div>
                          <CardDescription className="mt-1">
                            {report.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                        <span>Created: {new Date(report.created_at).toLocaleDateString()}</span>
                        {report.last_run_at && (
                          <span>Last run: {new Date(report.last_run_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => runSavedReport(report)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Run
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Report Builder View */}
        {currentView === 'builder' && selectedTemplate && (
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentView('templates')}
                  >
                    ← Back to Templates
                  </Button>
                  <div className={`p-2 rounded-lg ${
                    selectedTemplate.difficulty === 'beginner' ? 'bg-green-100' :
                    selectedTemplate.difficulty === 'intermediate' ? 'bg-yellow-100' : 'bg-red-100'
                  }`}>
                    {(() => {
                      const IconComponent = getTemplateIcon(selectedTemplate.icon_name)
                      return <IconComponent className={`h-5 w-5 ${
                        selectedTemplate.difficulty === 'beginner' ? 'text-green-600' :
                        selectedTemplate.difficulty === 'intermediate' ? 'text-yellow-600' : 'text-red-600'
                      }`} />
                    })()}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{selectedTemplate.name}</CardTitle>
                    <CardDescription>{selectedTemplate.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Parameters */}
                  {selectedTemplate.parameters && selectedTemplate.parameters.length > 0 && (
                    <div>
                      <h3 className="font-medium text-lg mb-4">Customize Your Report</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedTemplate.parameters.map((param) => (
                          <div key={param.id} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              {param.label}
                              {param.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {param.type === 'select' ? (
                              <Select 
                                value={parameterValues[param.id]} 
                                onValueChange={(value) => 
                                  setParameterValues(prev => ({ ...prev, [param.id]: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {param.options?.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type={param.type}
                                value={parameterValues[param.id] || ''}
                                onChange={(e) => 
                                  setParameterValues(prev => ({ 
                                    ...prev, 
                                    [param.id]: param.type === 'number' ? Number(e.target.value) : e.target.value 
                                  }))
                                }
                                placeholder={param.defaultValue?.toString()}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button 
                      className="flex-1" 
                      onClick={executeReport} 
                      disabled={isRunning}
                    >
                      {isRunning ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Run Report
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowSaveDialog(true)}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save as My Report
                    </Button>
                    <div className="relative">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        disabled={reportResults.length === 0}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                      {showExportMenu && reportResults.length > 0 && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                          <button
                            onClick={() => {
                              ReportsService.exportToCSV(reportResults, selectedTemplate?.name || 'report')
                              setShowExportMenu(false)
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                          >
                            <FileText className="h-4 w-4 mr-2 inline" />
                            Export as CSV
                          </button>
                          <button
                            onClick={() => {
                              ReportsService.exportToExcel(reportResults, selectedTemplate?.name || 'report')
                              setShowExportMenu(false)
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                          >
                            <FileText className="h-4 w-4 mr-2 inline" />
                            Export as Excel
                          </button>
                          <button
                            onClick={() => {
                              ReportsService.exportToPDF(reportResults, selectedTemplate?.name || 'report', selectedTemplate?.name || 'Report')
                              setShowExportMenu(false)
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                          >
                            <FileText className="h-4 w-4 mr-2 inline" />
                            Export as PDF
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Results Section */}
                  {reportResults.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium">Results</h3>
                        <div className="text-sm text-gray-500">
                          {reportResults.length} rows • {executionTime}ms
                        </div>
                      </div>
                      
                      {/* Report Statistics */}
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-sm text-gray-700 mb-3">Report Statistics</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-gray-900">{reportResults.length}</div>
                            <div className="text-gray-600">Total Records</div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{Object.keys(reportResults[0] || {}).length}</div>
                            <div className="text-gray-600">Data Columns</div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{executionTime}ms</div>
                            <div className="text-gray-600">Execution Time</div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{new Date().toLocaleTimeString()}</div>
                            <div className="text-gray-600">Generated At</div>
                          </div>
                        </div>
                        
                        {/* Quick Summary for Numeric Columns */}
                        {(() => {
                          const stats = ReportsService.getReportStats(reportResults)
                          return stats.numericColumns.length > 0 && (
                            <div className="mt-4">
                              <div className="text-xs font-medium text-gray-700 mb-2">Numeric Column Summaries:</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                                {stats.numericColumns.slice(0, 6).map(col => {
                                  const colStats = stats.summary[col]
                                  return (
                                    <div key={col} className="bg-white p-2 rounded border">
                                      <div className="font-medium text-gray-800 capitalize">{col.replace(/_/g, ' ')}</div>
                                      <div className="text-gray-600 space-y-1">
                                        <div>Sum: {colStats.sum.toLocaleString()}</div>
                                        <div>Avg: {colStats.avg.toFixed(2)}</div>
                                        <div>Range: {colStats.min} - {colStats.max}</div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-96 overflow-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                {Object.keys(reportResults[0] || {}).map(key => (
                                  <th key={key} className="px-4 py-2 text-left font-medium text-gray-900 capitalize">
                                    {key.replace(/_/g, ' ')}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {reportResults.map((row, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  {Object.values(row).map((value: any, cellIndex) => (
                                    <td key={cellIndex} className="px-4 py-2 text-gray-900">
                                      {typeof value === 'number' ? 
                                        (value % 1 === 0 ? value : value.toFixed(2)) : 
                                        (value?.toString() || 'N/A')
                                      }
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SQL Console View */}
        {currentView === 'sql' && (
          <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    SQL Console
                  </CardTitle>
                  <CardDescription>Advanced: Write and execute custom SQL queries</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setCurrentView('templates')}>
                  ← Back to Templates
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {/* SQL Editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SQL Query
                </label>
                <textarea
                  value={customSQL}
                  onChange={(e) => setCustomSQL(e.target.value)}
                  className="w-full h-48 p-3 border rounded-md font-mono text-sm"
                  placeholder={`-- Write your SQL query here
-- Example:
SELECT 
  p.name,
  p.category,
  i.quantity_on_hand,
  i.weighted_average_cost
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE i.quantity_on_hand > 0
ORDER BY i.quantity_on_hand DESC
LIMIT 10;`}
                />
              </div>
              
              {/* Actions */}
              <div className="flex gap-3">
                <Button 
                  onClick={executeCustomSQL} 
                  disabled={!customSQL.trim() || isSqlRunning}
                  className="flex items-center gap-2"
                >
                  {isSqlRunning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Execute Query
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setCustomSQL('')}>
                  Clear
                </Button>
                <Button variant="outline" onClick={loadSampleQueries}>
                  Load Sample
                </Button>
              </div>
              
              {/* Results */}
              {sqlResults.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Query Results</h3>
                    <div className="text-sm text-gray-500">
                      {sqlResults.length} rows • {sqlExecutionTime}ms
                    </div>
                  </div>
                  
                  {/* SQL Query Statistics */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-700 mb-3">Query Statistics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-gray-900">{sqlResults.length}</div>
                        <div className="text-gray-600">Total Records</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{Object.keys(sqlResults[0] || {}).length}</div>
                        <div className="text-gray-600">Data Columns</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{sqlExecutionTime}ms</div>
                        <div className="text-gray-600">Execution Time</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{new Date().toLocaleTimeString()}</div>
                        <div className="text-gray-600">Executed At</div>
                      </div>
                    </div>
                    
                    {/* Export Options for SQL Results */}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => ReportsService.exportToCSV(sqlResults, 'sql_query_results')}
                        className="px-3 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                      >
                        Export CSV
                      </button>
                      <button
                        onClick={() => ReportsService.exportToExcel(sqlResults, 'sql_query_results')}
                        className="px-3 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                      >
                        Export Excel
                      </button>
                      <button
                        onClick={() => ReportsService.exportToPDF(sqlResults, 'sql_query_results', 'SQL Query Results')}
                        className="px-3 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                      >
                        Export PDF
                      </button>
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-96 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(sqlResults[0] || {}).map(key => (
                              <th key={key} className="px-4 py-2 text-left font-medium text-gray-900 capitalize">
                                {key.replace(/_/g, ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sqlResults.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              {Object.values(row).map((value: any, cellIndex) => (
                                <td key={cellIndex} className="px-4 py-2 text-gray-900">
                                  {typeof value === 'number' ? 
                                    (value % 1 === 0 ? value : value.toFixed(2)) : 
                                    (value?.toString() || 'N/A')
                                  }
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
      
      {/* Save Report Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium mb-4">Save Report</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Name *
                </label>
                <Input
                  value={saveReportName}
                  onChange={(e) => setSaveReportName(e.target.value)}
                  placeholder="e.g., My Weekly Low Stock Report"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <Input
                  value={saveReportDescription}
                  onChange={(e) => setSaveReportDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setShowSaveDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={saveReport}
                disabled={!saveReportName.trim()}
                className="flex-1"
              >
                Save Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}