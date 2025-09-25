'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { matchesAmount } from '@/lib/search-utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Eye, Edit, Mail, Copy, Trash2, FileText, Filter, RefreshCw } from 'lucide-react'
import CreateEstimateQuickBooksStyle from './create-estimate-quickbooks-style'
import EditEstimateQuickBooksStyle from './edit-estimate-quickbooks-style'
import ContextMenu from '@/components/ui/context-menu'
import CollaborationIndicator from '@/components/ui/collaboration-indicator'
import DatabaseSetupBanner from './database-setup-banner'
import {
  SalesPermissionGate,
  PermissionButton,
  PermissionGate
} from '@/components/PermissionGate'
import { useDataFilters, useCurrentUser } from '@/hooks/usePermissions'

type Estimate = Database['public']['Tables']['estimates']['Row'] & {
  customers?: { name: string; email: string | null }
  sales_reps?: { first_name: string; last_name: string; employee_code: string }
  estimate_templates?: { name: string }
  estimate_lines?: {
    item_code: string | null
    description: string
    product_id: string | null
    products: {
      name: string
      sku: string
    } | null
  }[]
}

export default function EstimatesList() {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [filteredEstimates, setFilteredEstimates] = useState<Estimate[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [salesRepFilter, setSalesRepFilter] = useState<string>('all')
  const [salesReps, setSalesReps] = useState<Array<{ id: string; first_name: string; last_name: string; employee_code: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null)
  const [isEditingOpen, setIsEditingOpen] = useState(false)
  const [showSetupBanner, setShowSetupBanner] = useState(false)

  // Permission hooks
  const { user } = useCurrentUser()
  const { filters } = useDataFilters()

  // Fetch sales reps for filter dropdown
  useEffect(() => {
    const fetchSalesReps = async () => {
      try {
        const { data, error } = await supabase
          .from('sales_reps')
          .select('id, first_name, last_name, employee_code')
          .order('first_name')

        if (error) throw error
        setSalesReps(data || [])
      } catch (error) {
        console.error('Error fetching sales reps:', error)
      }
    }

    fetchSalesReps()
  }, [])

  useEffect(() => {
    // Fetch estimates immediately on mount (like other modules)
    fetchEstimates()

    // Listen for duplicate estimate events
    const handleOpenEstimate = (event: CustomEvent) => {
      const { estimate } = event.detail
      // Refresh the estimates list to include the new duplicate
      fetchEstimates()
      // Open the duplicate estimate for editing
      setEditingEstimate(estimate)
      setIsEditingOpen(true)
    }

    window.addEventListener('openEstimateForEdit', handleOpenEstimate as EventListener)

    return () => {
      window.removeEventListener('openEstimateForEdit', handleOpenEstimate as EventListener)
    }
  }, [])

  // Re-fetch when filters change (separate effect for permission updates)
  useEffect(() => {
    if (filters && user) {
      fetchEstimates()
    }
  }, [filters, user])

  // Check URL parameters to auto-open specific estimate
  useEffect(() => {
    const checkUrlParams = async () => {
      if (typeof window === 'undefined') return
      
      const urlParams = new URLSearchParams(window.location.search)
      const openEstimateId = urlParams.get('open')
      
      if (openEstimateId && estimates.length > 0) {
        const estimateToOpen = estimates.find(est => est.id === openEstimateId)
        if (estimateToOpen) {
          // Clear the URL parameter
          window.history.replaceState({}, '', window.location.pathname)
          // Open the estimate for editing
          setEditingEstimate(estimateToOpen)
          setIsEditingOpen(true)
        } else {
          // If not found in current list, try to fetch it directly
          const { data: estimate, error } = await supabase
            .from('estimates')
            .select(`
              *,
              customers (name, email),
              sales_reps (first_name, last_name, employee_code),
              estimate_templates (name)
            `)
            .eq('id', openEstimateId)
            .single()
          
          if (!error && estimate) {
            // Clear the URL parameter
            window.history.replaceState({}, '', window.location.pathname)
            // Open the estimate for editing
            setEditingEstimate(estimate)
            setIsEditingOpen(true)
          }
        }
      }
    }
    
    checkUrlParams()
  }, [estimates])

  useEffect(() => {
    let filtered = estimates

    // Apply search filter
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase()
      filtered = filtered.filter(estimate => {
        // Search in basic estimate fields
        const basicMatch = 
          estimate.estimate_number.toLowerCase().includes(lowerSearchTerm) ||
          estimate.customers?.name.toLowerCase().includes(lowerSearchTerm) ||
          estimate.customers?.email?.toLowerCase().includes(lowerSearchTerm) ||
          estimate.job_name?.toLowerCase().includes(lowerSearchTerm) ||
          estimate.reference_number?.toLowerCase().includes(lowerSearchTerm) ||
          estimate.sales_reps?.first_name?.toLowerCase().includes(lowerSearchTerm) ||
          estimate.sales_reps?.last_name?.toLowerCase().includes(lowerSearchTerm) ||
          estimate.sales_reps?.employee_code?.toLowerCase().includes(lowerSearchTerm) ||
          estimate.estimate_templates?.name?.toLowerCase().includes(lowerSearchTerm) ||
          (estimate as any).memo?.toLowerCase().includes(lowerSearchTerm)
        
        // Search in amounts (supports various formats: 8024, 8,024, 8024.00, etc.)
        const amountMatch = 
          matchesAmount((estimate as any).total, searchTerm) ||
          matchesAmount(estimate.subtotal, searchTerm) ||
          matchesAmount((estimate as any).tax_total, searchTerm) ||
          matchesAmount(estimate.discount_amount, searchTerm)
        
        // Search in line items
        const lineItemMatch = estimate.estimate_lines?.some(line => 
          line.item_code?.toLowerCase().includes(lowerSearchTerm) ||
          line.description?.toLowerCase().includes(lowerSearchTerm) ||
          line.products?.name?.toLowerCase().includes(lowerSearchTerm) ||
          line.products?.sku?.toLowerCase().includes(lowerSearchTerm) ||
          matchesAmount((line as any).amount, searchTerm) ||
          matchesAmount((line as any).unit_price, searchTerm)
        )
        
        return basicMatch || amountMatch || lineItemMatch
      })
    }

    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(estimate => estimate.status === statusFilter)
    }

    // Apply sales rep filter
    if (salesRepFilter !== 'all') {
      filtered = filtered.filter(estimate => estimate.sales_rep_id === salesRepFilter)
    }

    setFilteredEstimates(filtered)
  }, [estimates, searchTerm, statusFilter, salesRepFilter])

  const fetchEstimates = async () => {
    try {
      let query = supabase
        .from('estimates')
        .select(`
          *,
          customers (name, email),
          sales_reps (first_name, last_name, employee_code),
          estimate_templates (name)
        `)

      // Apply permission-based data filtering only if filters are loaded
      if (filters && filters.sales && !filters.sales.canViewAll) {
        // Sales reps can only see their own estimates
        if (filters.sales.salesRepFilter) {
          query = query.eq('sales_rep_id', filters.sales.salesRepFilter)
        }
        // Territory-based filtering
        else if (filters.sales.territoryFilter && filters.sales.territoryFilter.length > 0) {
          // This would need to be implemented based on how territories are stored
          // For now, we'll filter by sales rep territories in the sales_reps join
          query = query.in('sales_reps.territory', filters.sales.territoryFilter)
        }
        // If no specific filters and can't view all, show empty list
        else if (!filters.sales.canViewAll) {
          setEstimates([])
          setIsLoading(false)
          return
        }
      }
      // If filters are not loaded yet, fetch all (will be re-filtered when permissions load)

      const { data, error } = await query.order('estimate_date', { ascending: false })

      if (error) {
        console.error('Error fetching estimates:', error)
        // Check if it's a table not found error
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          console.info('Estimates table not created yet - showing setup banner')
          setShowSetupBanner(true)
        }
        setEstimates([])
      } else {
        setEstimates(data || [])
        setShowSetupBanner(false)
      }
    } catch (error) {
      console.error('Error fetching estimates:', error)
      setEstimates([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchEstimates()
    setIsRefreshing(false)
  }

  const handleCreateSuccess = (newEstimate: Estimate) => {
    setEstimates(prev => [newEstimate, ...prev])
    // Transition from create to edit mode
    setIsCreateOpen(false)
    setEditingEstimate(newEstimate)
    setIsEditingOpen(true)
  }

  const handleEditSuccess = (updatedEstimate: Estimate) => {
    setEstimates(prev => prev.map(est => 
      est.id === updatedEstimate.id ? updatedEstimate : est
    ))
    // Keep the edit dialog open so user can continue editing
    // setEditingEstimate(null)
    // setIsEditingOpen(false) // Removed - let user stay in edit mode
  }

  const handleViewEdit = (estimate: Estimate) => {
    setEditingEstimate(estimate)
    setIsEditingOpen(true)
  }

  const handleDeleteFromEdit = (deletedEstimate: Estimate) => {
    setEstimates(prev => prev.filter(est => est.id !== deletedEstimate.id))
    setEditingEstimate(null)
    setIsEditingOpen(false)
  }

  const handleNavigateFromCreate = (estimate: Estimate) => {
    // Close create modal and open edit modal with the selected estimate
    setIsCreateOpen(false)
    setEditingEstimate(estimate)
    setIsEditingOpen(true)
  }

  const handleNavigateFromEdit = (estimate: Estimate) => {
    // Update the currently editing estimate to the new one
    setEditingEstimate(estimate)
  }

  const handleDuplicate = async (estimate: Estimate) => {
    try {
      // Generate new estimate number
      const today = new Date()
      const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '')
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      const newEstimateNumber = `EST-${dateStr}-${randomSuffix}`

      const duplicateData = {
        ...estimate,
        id: undefined,
        estimate_number: newEstimateNumber,
        status: 'DRAFT' as const,
        estimate_date: today.toISOString().split('T')[0],
        expiration_date: null,
        last_emailed_at: null,
        email_count: 0,
        converted_to_sales_order_id: null,
        converted_at: null
      }

      const { data: newEstimate, error } = await supabase
        .from('estimates')
        .insert(duplicateData)
        .select(`
          *,
          customers (name, email),
          sales_reps (first_name, last_name, employee_code),
          estimate_templates (name)
        `)
        .single()

      if (error) throw error

      setEstimates(prev => [newEstimate, ...prev])
      
      // Also copy line items if they exist
      const { data: lines } = await supabase
        .from('estimate_lines')
        .select('*')
        .eq('estimate_id', estimate.id)

      if (lines && lines.length > 0) {
        const newLines = lines.map(line => ({
          ...line,
          id: undefined,
          estimate_id: newEstimate.id
        }))

        await supabase
          .from('estimate_lines')
          .insert(newLines)
      }

      console.log('Estimate duplicated successfully')
    } catch (error) {
      console.error('Error duplicating estimate:', error)
    }
  }

  const handleDelete = async (estimate: Estimate) => {
    if (!confirm(`Are you sure you want to delete estimate ${estimate.estimate_number}?`)) {
      return
    }

    try {
      // First, clear any sales order references to this estimate
      const { error: soError } = await supabase
        .from('sales_orders')
        .update({ estimate_id: null })
        .eq('estimate_id', estimate.id)

      if (soError) {
        console.error('Error clearing sales order references:', soError)
        // Continue with deletion even if this fails
      }

      // Then delete the estimate
      const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', estimate.id)

      if (error) throw error

      setEstimates(prev => prev.filter(est => est.id !== estimate.id))
      console.log('Estimate deleted successfully')
    } catch (error) {
      console.error('Error deleting estimate:', error)
    }
  }

  const handleEmail = async (estimate: Estimate) => {
    // TODO: Implement email functionality
    console.log('Email estimate:', estimate.estimate_number)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'SENT': return 'bg-blue-100 text-blue-800'
      case 'ACCEPTED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      case 'EXPIRED': return 'bg-yellow-100 text-yellow-800'
      case 'CONVERTED': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
          <p className="text-gray-600">Manage your project estimates and quotes</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <SalesPermissionGate action="create">
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Estimate
            </Button>
          </SalesPermissionGate>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search estimates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
                <option value="CONVERTED">Converted</option>
              </select>
              <select
                value={salesRepFilter}
                onChange={(e) => setSalesRepFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Sales Reps</option>
                {salesReps.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.first_name} {rep.last_name} ({rep.employee_code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Setup Banner */}
      {showSetupBanner && (
        <DatabaseSetupBanner tableName="estimates" feature="Estimates" />
      )}

      {/* Estimates List */}
      <div className="space-y-4">
        {filteredEstimates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No estimates found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'ALL' 
                  ? 'No estimates match your current filters.'
                  : 'Get started by creating your first estimate.'
                }
              </p>
              {(!searchTerm && statusFilter === 'ALL') && (
                <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Estimate
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredEstimates.map((estimate) => (
            <Card key={estimate.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <ContextMenu
                  options={[
                    {
                      id: 'view',
                      label: 'View Details',
                      icon: <Eye className="w-4 h-4" />,
                      onClick: () => handleViewEdit(estimate)
                    },
                    {
                      id: 'edit',
                      label: 'Edit',
                      icon: <Edit className="w-4 h-4" />,
                      onClick: () => handleViewEdit(estimate)
                    },
                    {
                      id: 'email',
                      label: 'Email',
                      icon: <Mail className="w-4 h-4" />,
                      onClick: () => handleEmail(estimate)
                    },
                    {
                      id: 'duplicate',
                      label: 'Duplicate',
                      icon: <Copy className="w-4 h-4" />,
                      onClick: () => handleDuplicate(estimate)
                    },
                    {
                      id: 'separator',
                      label: '',
                      onClick: () => {},
                      separator: true
                    },
                    {
                      id: 'delete',
                      label: 'Delete',
                      icon: <Trash2 className="w-4 h-4" />,
                      onClick: () => handleDelete(estimate)
                    }
                  ]}
                >
                  <div className="overflow-x-auto">
                    <div className="flex items-start justify-between min-w-[600px]">
                      <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {estimate.estimate_number}
                        </h3>
                        <Badge className={getStatusColor(estimate.status)}>
                          {estimate.status}
                        </Badge>
                        <CollaborationIndicator
                          activeUsers={[]}
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Customer</p>
                          <p className="font-medium">{estimate.customers?.name || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Sales Rep</p>
                          <p className="font-medium">
                            {estimate.sales_reps 
                              ? `${estimate.sales_reps.first_name} ${estimate.sales_reps.last_name}`
                              : 'Unassigned'
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Date</p>
                          <p className="font-medium">
                            {new Date(estimate.estimate_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Total</p>
                          <p className="font-medium text-lg">
                            {formatCurrency(estimate.total_amount)}
                          </p>
                        </div>
                      </div>

                      {estimate.job_name && (
                        <div className="mt-2">
                          <p className="text-gray-500 text-sm">Job Name</p>
                          <p className="font-medium">{estimate.job_name}</p>
                        </div>
                      )}

                      {estimate.expiration_date && (
                        <div className="mt-2 flex items-center gap-2">
                          <p className="text-sm text-gray-500">
                            Expires: {new Date(estimate.expiration_date).toLocaleDateString()}
                          </p>
                          {new Date(estimate.expiration_date) < new Date() && (
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              Expired
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <SalesPermissionGate action="read" resourceOwnerId={estimate.sales_rep_id || undefined}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEdit(estimate)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </SalesPermissionGate>
                    <SalesPermissionGate action="delete" resourceOwnerId={estimate.sales_rep_id || undefined}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(estimate)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </SalesPermissionGate>
                    </div>
                    </div>
                  </div>
                </ContextMenu>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Estimate QuickBooks Style */}
      {isCreateOpen && (
        <CreateEstimateQuickBooksStyle
          onSave={handleCreateSuccess}
          onCancel={() => setIsCreateOpen(false)}
          estimates={estimates}
          onNavigate={handleNavigateFromCreate}
        />
      )}

      {/* Edit Estimate Full Screen */}
      {isEditingOpen && editingEstimate && (
        <EditEstimateQuickBooksStyle
          estimate={editingEstimate}
          onSave={handleEditSuccess}
          onCancel={() => {
            setEditingEstimate(null)
            setIsEditingOpen(false)
          }}
          onDelete={handleDeleteFromEdit}
          estimates={estimates}
          onNavigate={handleNavigateFromEdit}
        />
      )}
    </div>
  )
}