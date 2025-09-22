'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  Download, 
  FileText, 
  Settings, 
  History, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Users,
  Package,
  ShoppingCart,
  Receipt,
  FileSpreadsheet,
  Zap
} from 'lucide-react'
import ImportWizard from './import-wizard'
import ExportWizard from './export-wizard'
import TemplateManager from './template-manager'
import JobHistory from './job-history'

interface ModuleStats {
  customers: number
  vendors: number
  products: number
  sales_orders: number
  purchase_orders: number
  estimates: number
  invoices: number
}

interface RecentJob {
  id: string
  type: 'import' | 'export'
  module: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  filename: string
  rowsProcessed: number
  totalRows: number
  createdAt: string
  errors?: string[]
}

export default function DataToolsDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'import' | 'export' | 'templates' | 'history'>('overview')
  const [moduleStats, setModuleStats] = useState<ModuleStats>({
    customers: 0,
    vendors: 0,
    products: 0,
    sales_orders: 0,
    purchase_orders: 0,
    estimates: 0,
    invoices: 0
  })
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      
      // Load module statistics
      // TODO: Implement actual data fetching
      setModuleStats({
        customers: 156,
        vendors: 42,
        products: 1284,
        sales_orders: 89,
        purchase_orders: 23,
        estimates: 134,
        invoices: 67
      })
      
      // Load recent jobs
      setRecentJobs([
        {
          id: '1',
          type: 'import',
          module: 'customers',
          status: 'completed',
          filename: 'customers_batch_1.csv',
          rowsProcessed: 150,
          totalRows: 150,
          createdAt: '2025-01-15T10:30:00Z'
        },
        {
          id: '2',
          type: 'export',
          module: 'products',
          status: 'completed',
          filename: 'products_export.csv',
          rowsProcessed: 1200,
          totalRows: 1200,
          createdAt: '2025-01-14T16:20:00Z'
        },
        {
          id: '3',
          type: 'import',
          module: 'vendors',
          status: 'failed',
          filename: 'vendors_new.csv',
          rowsProcessed: 15,
          totalRows: 45,
          createdAt: '2025-01-14T09:15:00Z',
          errors: ['Invalid email format in row 16', 'Missing required field in row 23']
        }
      ])
      
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-600" />
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
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Data Tools</h1>
          <p className="text-gray-600">Import and export data across all modules</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setActiveTab('templates')}>
            <Settings className="w-4 h-4 mr-2" />
            Templates
          </Button>
          <Button onClick={() => setActiveTab('import')} className="bg-blue-600 hover:bg-blue-700">
            <Upload className="w-4 h-4 mr-2" />
            Import Data
          </Button>
          <Button onClick={() => setActiveTab('export')} className="bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Module Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Module Data Overview
              </CardTitle>
              <CardDescription>Current record counts across all modules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Customers</p>
                    <p className="text-2xl font-bold">{moduleStats.customers}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Vendors</p>
                    <p className="text-2xl font-bold">{moduleStats.vendors}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Package className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Products</p>
                    <p className="text-2xl font-bold">{moduleStats.products}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Sales Orders</p>
                    <p className="text-2xl font-bold">{moduleStats.sales_orders}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Receipt className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Purchase Orders</p>
                    <p className="text-2xl font-bold">{moduleStats.purchase_orders}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <FileText className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Estimates</p>
                    <p className="text-2xl font-bold">{moduleStats.estimates}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Receipt className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Invoices</p>
                    <p className="text-2xl font-bold">{moduleStats.invoices}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <Zap className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Records</p>
                    <p className="text-2xl font-bold">
                      {Object.values(moduleStats).reduce((sum, count) => sum + count, 0)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Jobs
              </CardTitle>
              <CardDescription>Latest import and export activity</CardDescription>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No recent jobs found</p>
              ) : (
                <div className="space-y-4">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded">
                          {job.type === 'import' ? (
                            <Upload className="w-4 h-4" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{job.filename}</p>
                            <Badge variant="outline" className="text-xs">
                              {job.module}
                            </Badge>
                            <Badge className={`text-xs ${getStatusColor(job.status)}`}>
                              {job.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {job.rowsProcessed}/{job.totalRows} rows • {formatDate(job.createdAt)}
                          </p>
                          {job.errors && job.errors.length > 0 && (
                            <p className="text-sm text-red-600 mt-1">
                              {job.errors.length} error(s)
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <ImportWizard />
        </TabsContent>

        <TabsContent value="export">
          <ExportWizard />
        </TabsContent>

        <TabsContent value="templates">
          <TemplateManager />
        </TabsContent>

        <TabsContent value="history">
          <JobHistory />
        </TabsContent>
      </Tabs>
    </div>
  )
}