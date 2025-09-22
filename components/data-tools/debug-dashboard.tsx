'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Bug, 
  AlertTriangle, 
  Info, 
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  Clock,
  Database,
  FileText,
  Activity,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DebugLog {
  id: string
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  category: 'IMPORT' | 'EXPORT' | 'VALIDATION' | 'DATABASE' | 'SYSTEM'
  message: string
  details?: any
  job_id?: string
  user_id?: string
  module?: string
  created_at: string
  stack_trace?: string
  session_id?: string
}

interface SystemMetric {
  id: string
  metric_name: string
  metric_value: number
  metric_type: 'COUNTER' | 'GAUGE' | 'HISTOGRAM'
  tags?: Record<string, string>
  created_at: string
}

interface ImportStats {
  total_jobs: number
  successful_jobs: number
  failed_jobs: number
  total_records_processed: number
  average_processing_time: number
  success_rate: number
}

export default function DebugDashboard() {
  const [logs, setLogs] = useState<DebugLog[]>([])
  const [metrics, setMetrics] = useState<SystemMetric[]>([])
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState('ALL')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLog, setSelectedLog] = useState<DebugLog | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadDebugData()
    
    if (autoRefresh) {
      const interval = setInterval(loadDebugData, 5000) // Refresh every 5 seconds
      setRefreshInterval(interval)
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [autoRefresh])

  const loadDebugData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadLogs(),
        loadMetrics(),
        loadStats()
      ])
    } finally {
      setLoading(false)
    }
  }

  const loadLogs = async () => {
    let query = supabase
      .from('debug_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (selectedLevel !== 'ALL') {
      query = query.eq('level', selectedLevel)
    }

    if (selectedCategory !== 'ALL') {
      query = query.eq('category', selectedCategory)
    }

    if (searchQuery.trim()) {
      query = query.ilike('message', `%${searchQuery}%`)
    }

    const { data } = await query
    setLogs(data || [])
  }

  const loadMetrics = async () => {
    const { data } = await supabase
      .from('system_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    
    setMetrics(data || [])
  }

  const loadStats = async () => {
    // Calculate import statistics
    const { data: jobs } = await supabase
      .from('import_jobs')
      .select('status, total_rows, created_at, completed_at')
    
    if (jobs) {
      const total = jobs.length
      const successful = jobs.filter(j => j.status === 'completed').length
      const failed = jobs.filter(j => j.status === 'failed').length
      const totalRecords = jobs.reduce((sum, j) => sum + (j.total_rows || 0), 0)
      
      // Calculate average processing time
      const completedJobs = jobs.filter(j => j.completed_at && j.created_at)
      const avgTime = completedJobs.length > 0 
        ? completedJobs.reduce((sum, j) => {
            const start = new Date(j.created_at).getTime()
            const end = new Date(j.completed_at!).getTime()
            return sum + (end - start)
          }, 0) / completedJobs.length / 1000 // Convert to seconds
        : 0

      setStats({
        total_jobs: total,
        successful_jobs: successful,
        failed_jobs: failed,
        total_records_processed: totalRecords,
        average_processing_time: avgTime,
        success_rate: total > 0 ? (successful / total) * 100 : 0
      })
    }
  }

  const exportLogs = async () => {
    const csvContent = [
      ['Timestamp', 'Level', 'Category', 'Message', 'Job ID', 'Module'].join(','),
      ...logs.map(log => [
        log.created_at,
        log.level,
        log.category,
        `"${log.message.replace(/"/g, '""')}"`,
        log.job_id || '',
        log.module || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `debug-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const clearOldLogs = async () => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { error } = await supabase
      .from('debug_logs')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())

    if (!error) {
      loadLogs()
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'DEBUG': return <Bug className="h-4 w-4 text-gray-500" />
      case 'INFO': return <Info className="h-4 w-4 text-blue-500" />
      case 'WARNING': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'ERROR': return <XCircle className="h-4 w-4 text-red-500" />
      case 'CRITICAL': return <AlertCircle className="h-4 w-4 text-red-700" />
      default: return <Info className="h-4 w-4" />
    }
  }

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'bg-gray-100 text-gray-800'
      case 'INFO': return 'bg-blue-100 text-blue-800'
      case 'WARNING': return 'bg-yellow-100 text-yellow-800'
      case 'ERROR': return 'bg-red-100 text-red-800'
      case 'CRITICAL': return 'bg-red-200 text-red-900'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Debug Dashboard</h1>
          <p className="text-gray-600">Monitor system health and troubleshoot import/export operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={loadDebugData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                  <p className="text-2xl font-bold">{stats.total_jobs.toLocaleString()}</p>
                </div>
                <Database className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">{stats.success_rate.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Records Processed</p>
                  <p className="text-2xl font-bold">{stats.total_records_processed.toLocaleString()}</p>
                </div>
                <FileText className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Time</p>
                  <p className="text-2xl font-bold">{stats.average_processing_time.toFixed(1)}s</p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Dashboard */}
      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="logs">Debug Logs</TabsTrigger>
          <TabsTrigger value="metrics">System Metrics</TabsTrigger>
          <TabsTrigger value="analysis">Error Analysis</TabsTrigger>
        </TabsList>

        {/* Debug Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Debug Logs</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={exportLogs}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearOldLogs}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Old
                  </Button>
                </div>
              </div>
              
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    className="border rounded px-3 py-1 text-sm"
                  >
                    <option value="ALL">All Levels</option>
                    <option value="DEBUG">Debug</option>
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="ERROR">Error</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="border rounded px-3 py-1 text-sm"
                >
                  <option value="ALL">All Categories</option>
                  <option value="IMPORT">Import</option>
                  <option value="EXPORT">Export</option>
                  <option value="VALIDATION">Validation</option>
                  <option value="DATABASE">Database</option>
                  <option value="SYSTEM">System</option>
                </select>

                <Button variant="outline" size="sm" onClick={loadLogs}>
                  Apply Filters
                </Button>
              </div>
            </CardHeader>
            
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading logs...
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {getLevelIcon(log.level)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getLevelBadgeColor(log.level)}>
                            {log.level}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {log.category}
                          </Badge>
                          {log.module && (
                            <Badge variant="outline" className="text-xs">
                              {log.module}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500 ml-auto">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 line-clamp-2">{log.message}</p>
                        {log.job_id && (
                          <p className="text-xs text-gray-500 mt-1">Job: {log.job_id}</p>
                        )}
                      </div>
                      <Eye className="h-4 w-4 text-gray-400" />
                    </div>
                  ))}
                  
                  {logs.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      No logs found matching the current filters
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Metrics Tab */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>System Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {metrics.map((metric) => (
                  <Card key={metric.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">{metric.metric_name}</h4>
                        <p className="text-2xl font-bold mt-1">{metric.metric_value}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(metric.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Activity className="h-6 w-6 text-blue-500" />
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Analysis Tab */}
        <TabsContent value="analysis">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Error Frequency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {logs
                    .filter(log => log.level === 'ERROR' || log.level === 'CRITICAL')
                    .reduce((acc, log) => {
                      const key = log.message.substring(0, 100) + '...'
                      acc[key] = (acc[key] || 0) + 1
                      return acc
                    }, {} as Record<string, number>)
                    && Object.entries(logs
                      .filter(log => log.level === 'ERROR' || log.level === 'CRITICAL')
                      .reduce((acc, log) => {
                        const key = log.message.substring(0, 100) + '...'
                        acc[key] = (acc[key] || 0) + 1
                        return acc
                      }, {} as Record<string, number>))
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 10)
                      .map(([message, count]) => (
                        <div key={message} className="flex items-center justify-between">
                          <p className="text-sm text-gray-900 flex-1 mr-2">{message}</p>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Module Error Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(
                    logs
                      .filter(log => log.level === 'ERROR' || log.level === 'CRITICAL')
                      .reduce((acc, log) => {
                        const module = log.module || 'Unknown'
                        acc[module] = (acc[module] || 0) + 1
                        return acc
                      }, {} as Record<string, number>)
                  )
                    .sort(([,a], [,b]) => b - a)
                    .map(([module, count]) => (
                      <div key={module} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">{module}</span>
                          <span className="text-sm text-gray-500">{count} errors</span>
                        </div>
                        <Progress value={count / Math.max(...Object.values(
                          logs
                            .filter(log => log.level === 'ERROR' || log.level === 'CRITICAL')
                            .reduce((acc, log) => {
                              const module = log.module || 'Unknown'
                              acc[module] = (acc[module] || 0) + 1
                              return acc
                            }, {} as Record<string, number>)
                        )) * 100} className="h-2" />
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {getLevelIcon(selectedLog.level)}
                  Log Details
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLog(null)}
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Level</Label>
                    <Badge className={getLevelBadgeColor(selectedLog.level)}>
                      {selectedLog.level}
                    </Badge>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <p>{selectedLog.category}</p>
                  </div>
                  <div>
                    <Label>Timestamp</Label>
                    <p>{new Date(selectedLog.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label>Module</Label>
                    <p>{selectedLog.module || 'N/A'}</p>
                  </div>
                  {selectedLog.job_id && (
                    <div className="col-span-2">
                      <Label>Job ID</Label>
                      <p className="font-mono text-sm">{selectedLog.job_id}</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label>Message</Label>
                  <p className="mt-2 p-3 bg-gray-50 rounded border text-sm">
                    {selectedLog.message}
                  </p>
                </div>
                
                {selectedLog.details && (
                  <div>
                    <Label>Details</Label>
                    <pre className="mt-2 p-3 bg-gray-50 rounded border text-xs overflow-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
                
                {selectedLog.stack_trace && (
                  <div>
                    <Label>Stack Trace</Label>
                    <pre className="mt-2 p-3 bg-red-50 rounded border text-xs overflow-auto">
                      {selectedLog.stack_trace}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}