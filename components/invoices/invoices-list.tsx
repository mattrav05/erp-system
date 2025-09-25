'use client'

import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { matchesAmount } from '@/lib/search-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Filter, RefreshCw, Eye, Copy, Trash2, Mail, FileText, DollarSign } from 'lucide-react'
import ContextMenu from '@/components/ui/context-menu'
import {
  SalesPermissionGate,
  PermissionButton,
  PermissionGate
} from '@/components/PermissionGate'
import { useDataFilters, useCurrentUser } from '@/hooks/usePermissions'

type Invoice = any & {
  customers?: { company_name: string; contact_name: string | null }
  sales_reps?: { first_name: string; last_name: string; employee_code: string }
  sales_orders?: {
    so_number: string
    status: string
    order_date: string
    total_amount: number
    estimates?: { estimate_number: string }
  }
}

interface InvoicesListProps {
  invoices: Invoice[]
  onCreateInvoice: () => void
  onEditInvoice: (invoice: Invoice) => void
  onDeleteInvoice: (invoice: Invoice) => void
  onRefresh: () => void
}

export default function InvoicesList({
  invoices,
  onCreateInvoice,
  onEditInvoice,
  onDeleteInvoice,
  onRefresh
}: InvoicesListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [salesRepFilter, setSalesRepFilter] = useState<string>('all')
  const [salesReps, setSalesReps] = useState<Array<{ id: string; first_name: string; last_name: string; employee_code: string }>>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dateRange, setDateRange] = useState<string>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

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

  // Filter and search invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const matchesSearch = !searchTerm ||
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customers?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.sales_order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (invoice.sales_orders?.so_number && invoice.sales_orders.so_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        // Sales rep search
        (invoice.sales_reps?.first_name && invoice.sales_reps.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (invoice.sales_reps?.last_name && invoice.sales_reps.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (invoice.sales_reps?.employee_code && invoice.sales_reps.employee_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        // Search in amounts (supports various formats: 8024, 8,024, 8024.00, etc.)
        matchesAmount(invoice.total_amount, searchTerm) ||
        matchesAmount(invoice.subtotal, searchTerm) ||
        matchesAmount(invoice.tax_amount, searchTerm) ||
        matchesAmount(invoice.amount_paid, searchTerm) ||
        matchesAmount(invoice.balance_due, searchTerm)

      const matchesStatus = statusFilter === 'all' ||
        invoice.status === statusFilter ||
        (statusFilter === 'FROM_SO' && invoice.sales_order_id)

      const matchesSalesRep = salesRepFilter === 'all' ||
        invoice.sales_rep_id === salesRepFilter

      return matchesSearch && matchesStatus && matchesSalesRep
    })
  }, [invoices, searchTerm, statusFilter, salesRepFilter])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await onRefresh()
    setIsRefreshing(false)
  }

  const handleDuplicate = async (invoice: Invoice) => {
    try {
      // Create duplicate with new invoice number
      const today = new Date()
      const year = today.getFullYear().toString().slice(-2)
      const month = (today.getMonth() + 1).toString().padStart(2, '0')
      const day = today.getDate().toString().padStart(2, '0')
      const time = Date.now().toString().slice(-4)
      const newInvoiceNumber = `INV-${year}${month}${day}-${time}`

      const { data: newInvoice, error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: newInvoiceNumber,
          customer_id: invoice.customer_id,
          customer_name: invoice.customer_name,
          sales_rep_id: invoice.sales_rep_id,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
          terms: invoice.terms,
          status: 'draft',
          bill_to_address: invoice.bill_to_address,
          ship_to_address: invoice.ship_to_address,
          subtotal: invoice.subtotal,
          tax_amount: invoice.tax_amount,
          total_amount: invoice.total_amount,
          memo: invoice.memo,
          customer_message: invoice.customer_message
        })
        .select()
        .single()

      if (error) throw error

      // Duplicate invoice lines
      const { data: originalLines } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', invoice.id)

      if (originalLines && originalLines.length > 0) {
        const duplicateLines = originalLines.map((line, index) => ({
          invoice_id: newInvoice.id,
          line_number: index + 1,
          item_name: line.item_name || 'Item',
          description: line.description,
          quantity: line.quantity || 1,
          qty_from_so: line.qty_from_so,
          unit_price: line.unit_price || 0,
          unit_of_measure: line.unit_of_measure || 'ea',
          product_id: line.product_id,
          sales_order_line_id: line.sales_order_line_id,
          discount_percent: line.discount_percent || 0,
          discount_amount: line.discount_amount || 0,
          is_taxable: line.is_taxable || false,
          tax_rate: line.tax_rate || 0,
          tax_amount: line.tax_amount || 0,
          created_by: line.created_by,
          last_modified_by: line.last_modified_by
          // Note: Do NOT include 'amount' or 'line_total' - they are GENERATED columns
        }))

        const { error: linesError } = await supabase
          .from('invoice_lines')
          .insert(duplicateLines)

        if (linesError) throw linesError
      }

      handleRefresh()
      console.log('Invoice duplicated successfully')
    } catch (error) {
      console.error('Error duplicating invoice:', error)
    }
  }

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}?`)) {
      return
    }

    try {
      // Multi-invoice model - no need to clear SO references since converted_to_invoice_id doesn't exist

      // Delete the invoice (invoice_lines will cascade delete)
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id)

      if (error) throw error

      onDeleteInvoice(invoice)
      console.log('Invoice deleted successfully')
    } catch (error) {
      console.error('Error deleting invoice:', error)
      alert('Failed to delete invoice')
    }
  }

  const handleEmail = async (invoice: Invoice) => {
    // TODO: Implement email functionality
    console.log('Email invoice:', invoice.invoice_number)
    alert('Email functionality coming soon!')
  }

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'SENT': return 'bg-blue-100 text-blue-800'
      case 'PAID': return 'bg-green-100 text-green-800'
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-800'
      case 'OVERDUE': return 'bg-red-100 text-red-800'
      case 'CANCELLED': return 'bg-gray-100 text-gray-600'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  // Get date range boundaries
  const getDateRangeBounds = () => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (dateRange) {
      case 'today':
        return {
          start: startOfToday,
          end: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1)
        }
      case 'this_week':
        const startOfWeek = new Date(startOfToday)
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
        return {
          start: startOfWeek,
          end: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
        }
      case 'this_month':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        }
      case 'last_month':
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
        }
      case 'this_year':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: new Date(now.getFullYear(), 11, 31, 23, 59, 59)
        }
      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate) : null,
          end: customEndDate ? new Date(customEndDate + 'T23:59:59') : null
        }
      default:
        return { start: null, end: null }
    }
  }

  // Filter invoices for summary calculations based on date range
  const getDateFilteredInvoices = () => {
    if (dateRange === 'all') return filteredInvoices

    const { start, end } = getDateRangeBounds()
    if (!start || !end) return filteredInvoices

    return filteredInvoices.filter(invoice => {
      const invoiceDate = new Date(invoice.invoice_date)
      return invoiceDate >= start && invoiceDate <= end
    })
  }

  // Calculate summary statistics based on date range
  const dateFilteredInvoices = getDateFilteredInvoices()
  const totalAmount = dateFilteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
  const paidAmount = dateFilteredInvoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0)
  const outstandingAmount = totalAmount - paidAmount

  // Get period display text
  const getPeriodText = () => {
    switch (dateRange) {
      case 'today': return 'Today'
      case 'this_week': return 'This Week'
      case 'this_month': return 'This Month'
      case 'last_month': return 'Last Month'
      case 'this_year': return 'This Year'
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
        }
        return 'Custom Range'
      default: return 'All Time'
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600">Manage and track your customer invoices</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={onCreateInvoice} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Summary Period:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {dateRange === 'custom' && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Start date"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="End date"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Invoiced</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">{getPeriodText()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Amount Paid</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(paidAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">{getPeriodText()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Outstanding</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(outstandingAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">{getPeriodText()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search invoices..."
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
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="FROM_SO">From Sales Orders</option>
          </select>
          <select
            value={salesRepFilter}
            onChange={(e) => setSalesRepFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

      {/* Invoices List */}
      <div className="space-y-3">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border shadow-sm">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first invoice'
              }
            </p>
            <Button onClick={onCreateInvoice} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </div>
        ) : (
          filteredInvoices.map((invoice) => (
            <ContextMenu
              key={invoice.id}
              options={[
                {
                  id: 'view',
                  label: 'View',
                  icon: <Eye className="w-4 h-4" />,
                  onClick: () => onEditInvoice(invoice)
                },
                {
                  id: 'duplicate',
                  label: 'Duplicate',
                  icon: <Copy className="w-4 h-4" />,
                  onClick: () => handleDuplicate(invoice)
                },
                {
                  id: 'email',
                  label: 'Email',
                  icon: <Mail className="w-4 h-4" />,
                  onClick: () => handleEmail(invoice)
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
                  onClick: () => handleDelete(invoice)
                }
              ]}
            >
              <div 
                className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onEditInvoice(invoice)}
              >
                <div className="overflow-x-auto">
                  <div className="flex items-start justify-between min-w-[800px]">
                    <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {invoice.invoice_number}
                      </h3>
                      <Badge className={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                      {/* Sales Order Relationship Badge */}
                      {invoice.sales_order_id && (
                        <Badge className="bg-blue-100 text-blue-800">
                          From SO
                        </Badge>
                      )}
                      {/* Partial/Final Invoice Badge */}
                      {invoice.is_partial_invoice && (
                        <Badge className="bg-orange-100 text-orange-800">
                          Partial {invoice.invoice_sequence && `(${invoice.invoice_sequence})`}
                        </Badge>
                      )}
                      {invoice.is_final_invoice && (
                        <Badge className="bg-green-100 text-green-800">
                          Final
                        </Badge>
                      )}
                      {invoice.qbo_sync_status === 'synced' && (
                        <Badge className="bg-purple-100 text-purple-800">
                          QBO
                        </Badge>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <div className="grid grid-cols-5 gap-4 text-sm text-gray-600 min-w-[750px]">
                      <div>
                        <span className="font-medium">Customer:</span>
                        <div>{invoice.customer_name || invoice.customers?.company_name || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="font-medium">Sales Rep:</span>
                        <div>
                          {invoice.sales_reps
                            ? `${invoice.sales_reps.first_name} ${invoice.sales_reps.last_name}`
                            : 'N/A'
                          }
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Date:</span>
                        <div>{formatDate(invoice.invoice_date)}</div>
                      </div>
                      <div>
                        <span className="font-medium">Due:</span>
                        <div>{formatDate(invoice.due_date)}</div>
                      </div>
                      <div>
                        <span className="font-medium">Amount:</span>
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(invoice.total_amount)}
                        </div>
                      </div>
                      </div>
                    </div>

                    {/* Sales Order Relationship Details */}
                    {invoice.sales_order_id && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-blue-900">Sales Order Relationship</h4>
                          <div className="flex items-center gap-2">
                            {invoice.invoice_sequence && (
                              <Badge className="bg-blue-100 text-blue-800 text-xs">
                                Invoice {invoice.invoice_sequence}
                              </Badge>
                            )}
                            {invoice.is_partial_invoice && !invoice.is_final_invoice && (
                              <Badge className="bg-orange-100 text-orange-800 text-xs">
                                More invoices expected
                              </Badge>
                            )}
                            {invoice.is_final_invoice && (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                Final invoice
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-blue-700">Sales Order ID</p>
                            <p className="font-medium text-gray-900 font-mono">
                              {invoice.sales_order_id.slice(0, 8)}...
                            </p>
                          </div>
                          <div>
                            <p className="text-blue-700">Invoice Type</p>
                            <p className="font-medium text-gray-900">
                              {invoice.is_partial_invoice ? 'Partial Invoice' : 'Full Invoice'}
                              {invoice.invoice_sequence && ` (${invoice.invoice_sequence})`}
                            </p>
                          </div>
                        </div>
                        {(invoice.is_partial_invoice || invoice.is_final_invoice) && (
                          <div className="mt-2 text-xs text-blue-600">
                            <p>
                              {invoice.is_final_invoice 
                                ? 'This is the final invoice for the sales order.'
                                : 'Additional invoices may be created for remaining quantities.'
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditInvoice(invoice)
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(invoice)
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                  </div>
                </div>
              </div>
            </ContextMenu>
          ))
        )}
      </div>
    </div>
  )
}