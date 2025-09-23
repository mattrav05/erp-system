'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Calendar, Package, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface InventoryItem {
  id: string
  product: {
    id: string
    sku: string
    name: string
    unit_of_measure: string
  }
}

interface Transaction {
  id: string
  transaction_type: 'ADJUSTMENT' | 'PURCHASE' | 'SALE' | 'TRANSFER'
  quantity_change: number
  unit_cost?: number | null
  reference_number?: string | null
  notes?: string | null
  created_at: string
  created_by?: string | null
  balance_after: number
}

interface ItemTransactionHistoryProps {
  item: InventoryItem
  dateRange?: { start: string; end: string }
  onClose?: () => void
}

export default function ItemTransactionHistory({ item, dateRange, onClose }: ItemTransactionHistoryProps) {
  console.log('🔍 ItemTransactionHistory component loaded - NEW VERSION WITH SALES!', item.product.sku)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(dateRange?.start || '')
  const [endDate, setEndDate] = useState(dateRange?.end || '')
  const [filterType, setFilterType] = useState<'all' | 'adjustments' | 'purchases' | 'sales'>('all')

  useEffect(() => {
    loadTransactions()
  }, [item.id, startDate, endDate, filterType])

  const loadTransactions = async () => {
    try {
      setLoading(true)
      setError(null)

      const allTransactions: Transaction[] = []

      // 1. Query inventory receipts (PURCHASE transactions)
      const { data: receipts, error: receiptsError } = await supabase
        .from('inventory_receipts')
        .select(`
          id,
          qty_received,
          unit_cost,
          total_cost,
          reference_number,
          notes,
          receive_date,
          created_at,
          received_by,
          purchase_order_lines!inner (
            purchase_orders!inner (
              po_number
            )
          )
        `)
        .eq('product_id', item.product.id)
        .order('created_at', { ascending: false })

      if (!receiptsError && receipts) {
        const receiptTransactions: Transaction[] = receipts.map(receipt => ({
          id: `receipt-${receipt.id}`,
          transaction_type: 'PURCHASE',
          quantity_change: receipt.qty_received || 0,
          unit_cost: receipt.unit_cost || 0,
          reference_number: (receipt.purchase_order_lines as any)?.purchase_orders?.po_number || receipt.reference_number || null,
          notes: receipt.notes,
          created_at: receipt.receive_date || receipt.created_at,
          created_by: receipt.received_by,
          balance_after: 0
        }))
        allTransactions.push(...receiptTransactions)
      }

      // 2. Query inventory adjustments (ADJUSTMENT transactions)
      const { data: adjustments, error: adjustmentsError } = await supabase
        .from('inventory_adjustment_lines')
        .select(`
          id,
          adjustment_quantity,
          previous_quantity,
          new_quantity,
          reason_code,
          line_notes,
          inventory_adjustments!inner (
            adjustment_date,
            adjustment_number,
            notes,
            user_id
          )
        `)
        .eq('inventory_id', item.id)
        .order('inventory_adjustments.adjustment_date', { ascending: false })

      if (!adjustmentsError && adjustments) {
        const adjustmentTransactions: Transaction[] = adjustments.map(adj => ({
          id: `adjustment-${adj.id}`,
          transaction_type: 'ADJUSTMENT',
          quantity_change: adj.adjustment_quantity || 0,
          unit_cost: null,
          reference_number: (adj.inventory_adjustments as any)?.adjustment_number || null,
          notes: adj.line_notes || (adj.inventory_adjustments as any)?.notes,
          created_at: (adj.inventory_adjustments as any)?.adjustment_date || new Date().toISOString(),
          created_by: (adj.inventory_adjustments as any)?.user_id,
          balance_after: adj.new_quantity || 0
        }))
        allTransactions.push(...adjustmentTransactions)
      }

      // 3. Query sales order lines that haven't been invoiced yet
      // Only show sales orders that are shipped but NOT invoiced (to avoid double-counting)
      const { data: salesLines, error: salesError } = await supabase
        .from('sales_order_lines')
        .select(`
          id,
          quantity,
          unit_price,
          sales_order_id,
          qty_invoiced,
          sales_orders (
            so_number,
            status,
            order_date,
            ship_date
          )
        `)
        .eq('product_id', item.product.id)

      if (!salesError && salesLines) {
        console.log(`Found ${salesLines.length} sales order lines for product ${item.product.sku}`)

        // Only show sales orders that are SHIPPED/DELIVERED but not fully invoiced
        // This prevents double-counting with invoices
        const uninvoicedSales = salesLines.filter(sale => {
          if (!sale.sales_orders) return false

          // Only include shipped/delivered orders
          if (!['SHIPPED', 'DELIVERED'].includes((sale.sales_orders as any).status)) return false

          // Check if this line has been invoiced
          const qtyInvoiced = sale.qty_invoiced || 0
          const qtyOrdered = sale.quantity || 0

          // Only show if there's uninvoiced quantity
          return qtyInvoiced < qtyOrdered
        })

        console.log(`Filtered to ${uninvoicedSales.length} shipped but uninvoiced sales`)

        const salesTransactions: Transaction[] = uninvoicedSales.map(sale => {
          const qtyInvoiced = sale.qty_invoiced || 0
          const qtyOrdered = sale.quantity || 0
          const uninvoicedQty = qtyOrdered - qtyInvoiced

          return {
            id: `sale-${sale.id}`,
            transaction_type: 'SALE',
            quantity_change: -uninvoicedQty, // Only the uninvoiced portion
            unit_cost: sale.unit_price || 0,
            reference_number: (sale.sales_orders as any)?.so_number || null,
            notes: `Sales Order (Shipped, not invoiced) - ${(sale.sales_orders as any)?.status}`,
            created_at: (sale.sales_orders as any)?.ship_date || (sale.sales_orders as any)?.order_date || new Date().toISOString(),
            created_by: null,
            balance_after: 0
          }
        })

        allTransactions.push(...salesTransactions)
      } else if (salesError) {
        console.error('Error fetching sales orders:', salesError)
      }

      // 4. Query invoice lines - these represent actual inventory deductions (shipped/delivered)
      const { data: invoiceLines, error: invoiceError } = await supabase
        .from('invoice_lines')
        .select(`
          id,
          quantity,
          unit_price,
          invoice_id,
          sales_order_line_id,
          invoices (
            invoice_number,
            invoice_date,
            status,
            sales_order_id
          )
        `)
        .eq('product_id', item.product.id)

      if (!invoiceError && invoiceLines) {
        console.log(`Found ${invoiceLines.length} invoice lines for product ${item.product.sku}`)

        // Include all invoices (they represent actual shipments/deductions)
        // Don't filter by status - even draft invoices may represent committed shipments
        const invoiceTransactions: Transaction[] = invoiceLines.map(inv => {
          const statusLabel = (inv.invoices as any)?.status === 'PAID' ? 'Paid' :
                            (inv.invoices as any)?.status === 'SENT' ? 'Sent' :
                            (inv.invoices as any)?.status === 'DRAFT' ? 'Draft' : (inv.invoices as any)?.status || 'Unknown'

          return {
            id: `invoice-${inv.id}`,
            transaction_type: 'SALE',
            quantity_change: -(inv.quantity || 0), // Invoices represent actual deductions
            unit_cost: inv.unit_price || 0,
            reference_number: (inv.invoices as any)?.invoice_number || null,
            notes: `Invoice (${statusLabel})`,
            created_at: (inv.invoices as any)?.invoice_date || new Date().toISOString(),
            created_by: null,
            balance_after: 0
          }
        })

        console.log(`Added ${invoiceTransactions.length} invoice transactions`)
        allTransactions.push(...invoiceTransactions)
      } else if (invoiceError) {
        console.error('Error fetching invoices:', invoiceError)
      }

      // Sort all transactions by date (newest first)
      allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Filter by date range if specified
      let filtered = allTransactions
      if (startDate) {
        filtered = filtered.filter(t => new Date(t.created_at) >= new Date(startDate))
      }
      if (endDate) {
        filtered = filtered.filter(t => new Date(t.created_at) <= new Date(endDate))
      }

      // Filter by transaction type
      if (filterType !== 'all') {
        const typeMap = {
          adjustments: 'ADJUSTMENT',
          purchases: 'PURCHASE',
          sales: 'SALE'
        }
        filtered = filtered.filter(t => t.transaction_type === typeMap[filterType])
      }

      setTransactions(filtered)

      console.log(`Loaded ${allTransactions.length} total transactions for product ${item.product.sku}:`)
      console.log(`- Receipts: ${receipts?.length || 0}`)
      console.log(`- Adjustments: ${adjustments?.length || 0}`)
      console.log(`- Sales Orders: ${salesLines?.length || 0}`)
      console.log(`- Invoices: ${invoiceLines?.length || 0}`)

    } catch (err) {
      console.error('Error loading transactions:', err)
      setError('Failed to load transaction history')
    } finally {
      setLoading(false)
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'SALE':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'ADJUSTMENT':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      default:
        return <Package className="h-4 w-4 text-gray-600" />
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return 'text-green-600'
      case 'SALE':
        return 'text-red-600'
      case 'ADJUSTMENT':
        return 'text-orange-600'
      default:
        return 'text-gray-600'
    }
  }

  const totalQuantityChange = transactions.reduce((sum, t) => sum + t.quantity_change, 0)
  const totalValue = transactions.reduce((sum, t) => sum + (t.quantity_change * (t.unit_cost || 0)), 0)

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
        <p className="text-sm text-gray-600">
          {item.product.sku} - {item.product.name}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Net Quantity Change</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalQuantityChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalQuantityChange >= 0 ? '+' : ''}{totalQuantityChange} {item.product.unit_of_measure}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(Math.abs(totalValue))}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
          >
            All
          </Button>
          <Button
            variant={filterType === 'purchases' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('purchases')}
          >
            Purchases
          </Button>
          <Button
            variant={filterType === 'sales' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('sales')}
          >
            Sales
          </Button>
          <Button
            variant={filterType === 'adjustments' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('adjustments')}
          >
            Adjustments
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Start date"
            className="w-40"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="End date"
            className="w-40"
          />
        </div>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions ({transactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found for the selected criteria</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    {getTransactionIcon(transaction.transaction_type)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">
                          {transaction.transaction_type.charAt(0) + transaction.transaction_type.slice(1).toLowerCase()}
                        </span>
                        {transaction.reference_number && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {transaction.reference_number}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(transaction.created_at).toLocaleDateString()} at{' '}
                        {new Date(transaction.created_at).toLocaleTimeString()}
                        {transaction.created_by && ` • by ${transaction.created_by}`}
                      </div>
                      {transaction.notes && (
                        <div className="text-xs text-gray-500 mt-1">{transaction.notes}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`font-medium ${getTransactionColor(transaction.transaction_type)}`}>
                      {transaction.quantity_change >= 0 ? '+' : ''}{transaction.quantity_change} {item.product.unit_of_measure}
                    </div>
                    {transaction.unit_cost && (
                      <div className="text-xs text-gray-500">
                        @ {formatCurrency(transaction.unit_cost)}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Balance: {transaction.balance_after} {item.product.unit_of_measure}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Bottom close button */}
      <div className="bg-gray-50 border-t border-gray-200 p-4 mt-6 text-center">
        <div className="text-xs text-gray-400 mb-3">
          — End of Transaction History —
        </div>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
        >
          Close Window
        </button>
      </div>
    </div>
  )
}