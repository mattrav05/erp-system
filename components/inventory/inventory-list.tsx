'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Package, Search, Plus, AlertTriangle, Settings, Eye, EyeOff, GripVertical, Edit3, History, ShoppingCart, ShoppingBag, MoreHorizontal, Archive, Trash2, AlertCircle, RefreshCw } from 'lucide-react'
import AddItemModal from './add-item-modal'
import EditInventorySafe from './edit-inventory-safe'
import InventoryAdjustments from './inventory-adjustments'
import AdjustmentHistory from './adjustment-history'
import ContextMenu, { ContextMenuOption } from '@/components/ui/context-menu'
import SubWindow from '@/components/ui/sub-window'
import ItemTransactionHistory from './item-transaction-history'
import ItemSalesOrders from './item-sales-orders'
import ItemPurchaseOrders from './item-purchase-orders'
import ReceiveInventoryModal from './receive-inventory-modal'

interface InventoryItem {
  id: string
  product: {
    id: string
    sku: string
    manufacturer_part_number: string | null
    name: string
    description: string | null
    category: string | null
    unit_of_measure: string
    is_shippable: boolean
    reorder_point: number | null
  }
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  weighted_average_cost: number
  last_cost: number | null
  sales_price: number | null
  margin_percent: number | null
  markup_percent: number | null
  location: string | null
  default_tax_code?: string | null
  default_tax_rate?: number | null
  is_active: boolean
  active_purchase_orders?: {
    po_number: string
    status: string
    order_date: string
    qty_ordered: number
    qty_received: number
    qty_pending: number
  }[]
}

interface TableColumn {
  id: string
  label: string
  defaultWidth: number
  minWidth: number
  align: 'left' | 'right' | 'center'
  required?: boolean
  getValue: (item: InventoryItem) => string | number
  render?: (item: InventoryItem) => React.ReactNode
}

export default function InventoryList() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'low-stock' | 'out-of-stock'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [showColumnManager, setShowColumnManager] = useState(false)
  const [showAdjustments, setShowAdjustments] = useState(false)
  const [showAdjustmentHistory, setShowAdjustmentHistory] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)
  const [draggedOverColumnId, setDraggedOverColumnId] = useState<string | null>(null)
  const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>({})
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [showTransactionHistory, setShowTransactionHistory] = useState(false)
  const [showSalesOrders, setShowSalesOrders] = useState(false)
  const [showPurchaseOrders, setShowPurchaseOrders] = useState(false)
  const [selectedItemForSubWindow, setSelectedItemForSubWindow] = useState<InventoryItem | null>(null)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [preSelectedPO, setPreSelectedPO] = useState<any>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Define all possible columns
  const allColumns: TableColumn[] = [
    {
      id: 'sku',
      label: 'SKU',
      defaultWidth: 100,
      minWidth: 70,
      align: 'left',
      required: true,
      getValue: (item) => item.product.sku,
      render: (item) => <span className="font-mono text-xs">{item.product.sku}</span>
    },
    {
      id: 'mpn',
      label: 'MFN Part #',
      defaultWidth: 120,
      minWidth: 80,
      align: 'left',
      getValue: (item) => item.product.manufacturer_part_number || '',
      render: (item) => (
        <span className="font-mono text-xs text-gray-600">
          {item.product.manufacturer_part_number || '-'}
        </span>
      )
    },
    {
      id: 'name',
      label: 'Name',
      defaultWidth: 200,
      minWidth: 120,
      align: 'left',
      required: true,
      getValue: (item) => item.product.name,
      render: (item) => (
        <div>
          <div className="font-medium text-xs">{item.product.name}</div>
          {item.product.description && (
            <div className="text-xs text-gray-500 truncate">{item.product.description}</div>
          )}
        </div>
      )
    },
    {
      id: 'category',
      label: 'Category',
      defaultWidth: 100,
      minWidth: 70,
      align: 'left',
      getValue: (item) => item.product.category || '',
      render: (item) => (
        <span className="text-xs text-gray-600">{item.product.category || '-'}</span>
      )
    },
    {
      id: 'on_hand',
      label: 'On Hand',
      defaultWidth: 90,
      minWidth: 70,
      align: 'right',
      getValue: (item) => item.quantity_on_hand,
      render: (item) => (
        <span className="font-mono text-xs">
          {item.quantity_on_hand.toFixed(0)} {item.product.unit_of_measure}
        </span>
      )
    },
    {
      id: 'allocated',
      label: 'Allocated',
      defaultWidth: 90,
      minWidth: 70,
      align: 'right',
      getValue: (item) => item.quantity_allocated,
      render: (item) => (
        <span className="font-mono text-orange-600 text-xs">
          {item.quantity_allocated.toFixed(0)} {item.product.unit_of_measure}
        </span>
      )
    },
    {
      id: 'available',
      label: 'Available',
      defaultWidth: 90,
      minWidth: 70,
      align: 'right',
      required: true,
      getValue: (item) => item.quantity_available,
      render: (item) => {
        const isOutOfStock = item.quantity_available <= 0
        const isLowStock = item.product.reorder_point && item.quantity_available <= item.product.reorder_point
        return (
          <span className={`font-mono font-medium text-xs ${
            isOutOfStock ? 'text-red-600' : isLowStock ? 'text-orange-600' : 'text-green-600'
          }`}>
            {item.quantity_available.toFixed(0)} {item.product.unit_of_measure}
          </span>
        )
      }
    },
    {
      id: 'avg_cost',
      label: 'Avg Cost',
      defaultWidth: 85,
      minWidth: 65,
      align: 'right',
      getValue: (item) => item.weighted_average_cost,
      render: (item) => (
        <span className="font-mono text-xs">{formatCurrency(item.weighted_average_cost)}</span>
      )
    },
    {
      id: 'last_cost',
      label: 'Last Cost',
      defaultWidth: 85,
      minWidth: 65,
      align: 'right',
      getValue: (item) => item.last_cost || 0,
      render: (item) => (
        <span className="font-mono text-xs">{formatCurrency(item.last_cost || 0)}</span>
      )
    },
    {
      id: 'sales_price',
      label: 'Sales Price',
      defaultWidth: 90,
      minWidth: 70,
      align: 'right',
      getValue: (item) => item.sales_price || 0,
      render: (item) => (
        <span className="font-mono text-blue-600 text-xs">{formatCurrency(item.sales_price || 0)}</span>
      )
    },
    {
      id: 'total_value',
      label: 'Total Value',
      defaultWidth: 100,
      minWidth: 75,
      align: 'right',
      getValue: (item) => item.quantity_on_hand * item.weighted_average_cost,
      render: (item) => (
        <span className="font-mono font-medium text-xs">
          {formatCurrency(item.quantity_on_hand * item.weighted_average_cost)}
        </span>
      )
    },
    {
      id: 'reorder_point',
      label: 'Reorder Point',
      defaultWidth: 100,
      minWidth: 75,
      align: 'right',
      getValue: (item) => item.product.reorder_point || 0,
      render: (item) => (
        <span className="font-mono text-xs">
          {item.product.reorder_point || '-'}
        </span>
      )
    },
    {
      id: 'location',
      label: 'Location',
      defaultWidth: 75,
      minWidth: 55,
      align: 'center',
      getValue: (item) => item.location || '',
      render: (item) => (
        <span className="text-xs">{item.location || '-'}</span>
      )
    },
    {
      id: 'unit_measure',
      label: 'Unit',
      defaultWidth: 60,
      minWidth: 45,
      align: 'center',
      getValue: (item) => item.product.unit_of_measure,
      render: (item) => (
        <span className="text-xs font-mono">{item.product.unit_of_measure}</span>
      )
    },
    {
      id: 'status',
      label: 'Status',
      defaultWidth: 110,
      minWidth: 90,
      align: 'center',
      required: true,
      getValue: (item) => {
        const isOutOfStock = item.quantity_available <= 0
        const isLowStock = item.product.reorder_point && item.quantity_available <= item.product.reorder_point
        return isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'
      },
      render: (item) => {
        const isOutOfStock = item.quantity_available <= 0
        const isLowStock = item.product.reorder_point && item.quantity_available <= item.product.reorder_point
        return (
          <span>
            {isOutOfStock ? (
              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                Out of Stock
              </span>
            ) : isLowStock ? (
              <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full">
                Low Stock
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                In Stock
              </span>
            )}
          </span>
        )
      }
    },
    {
      id: 'on_purchase_orders',
      label: 'On Purchase Orders',
      defaultWidth: 130,
      minWidth: 100,
      align: 'center',
      getValue: (item) => 'Loading...',
      render: (item) => {
        const activePOs = item.active_purchase_orders || []
        // Only show POs that have pending quantities (not yet received)
        const pendingPOs = activePOs.filter(po => po.qty_pending > 0)
        
        if (pendingPOs.length === 0) {
          return <span className="text-xs text-gray-400">—</span>
        }
        
        // Calculate total pending quantity
        const totalPending = pendingPOs.reduce((sum, po) => sum + po.qty_pending, 0)
        
        return (
          <div className="text-xs">
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full">
              {totalPending} {item.product.unit_of_measure} pending
            </span>
            {pendingPOs.length <= 2 && (
              <div className="mt-1 text-gray-600">
                {pendingPOs.map(po => `${po.po_number} (${po.qty_pending})`).join(', ')}
              </div>
            )}
            {pendingPOs.length > 2 && (
              <div className="mt-1 text-gray-600">
                {pendingPOs.length} POs
              </div>
            )}
          </div>
        )
      }
    }
  ]

  // Default visible columns
  const defaultColumns = ['sku', 'mpn', 'name', 'category', 'available', 'sales_price', 'avg_cost', 'total_value', 'status']

  // Initialize visible columns and widths from localStorage or defaults
  useEffect(() => {
    const savedColumns = localStorage.getItem('inventory-visible-columns')
    if (savedColumns) {
      setVisibleColumns(JSON.parse(savedColumns))
    } else {
      setVisibleColumns(defaultColumns)
    }

    const savedWidths = localStorage.getItem('inventory-column-widths')
    if (savedWidths) {
      setColumnWidths(JSON.parse(savedWidths))
    } else {
      // Initialize with default widths
      const defaultWidths: {[key: string]: number} = {}
      allColumns.forEach(col => {
        defaultWidths[col.id] = col.defaultWidth
      })
      setColumnWidths(defaultWidths)
    }
  }, [])

  // Save column preferences to localStorage
  const saveColumnPreferences = (columns: string[]) => {
    setVisibleColumns(columns)
    localStorage.setItem('inventory-visible-columns', JSON.stringify(columns))
  }

  // Save column widths to localStorage
  const saveColumnWidths = (widths: {[key: string]: number}) => {
    setColumnWidths(widths)
    localStorage.setItem('inventory-column-widths', JSON.stringify(widths))
  }

  // Toggle column visibility
  const toggleColumn = (columnId: string) => {
    const column = allColumns.find(col => col.id === columnId)
    if (column?.required) return // Can't hide required columns
    
    const newColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId]
    
    saveColumnPreferences(newColumns)
  }

  // Reset to default columns
  const resetColumns = () => {
    saveColumnPreferences(defaultColumns)
  }

  // Handle drag and drop for column reordering in table headers
  const handleHeaderDragStart = (e: React.DragEvent, columnId: string) => {
    setDraggedColumnId(columnId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleHeaderDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDraggedOverColumnId(columnId)
  }

  const handleHeaderDragLeave = () => {
    setDraggedOverColumnId(null)
  }

  const handleHeaderDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    if (!draggedColumnId || draggedColumnId === targetColumnId) {
      setDraggedColumnId(null)
      setDraggedOverColumnId(null)
      return
    }

    const newOrder = [...visibleColumns]
    const draggedIndex = newOrder.indexOf(draggedColumnId)
    const targetIndex = newOrder.indexOf(targetColumnId)
    
    // Remove the dragged column and insert it at the target position
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumnId)
    
    saveColumnPreferences(newOrder)
    setDraggedColumnId(null)
    setDraggedOverColumnId(null)
  }

  const handleHeaderDragEnd = () => {
    setDraggedColumnId(null)
    setDraggedOverColumnId(null)
  }

  // Handle column resizing
  const handleResizeStart = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault()
    setIsResizing(columnId)
    
    const startX = e.clientX
    const startWidth = columnWidths[columnId] || allColumns.find(col => col.id === columnId)?.defaultWidth || 100
    const column = allColumns.find(col => col.id === columnId)
    const minWidth = column?.minWidth || 50

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX
      const newWidth = Math.max(minWidth, startWidth + diff)
      setColumnWidths(prev => ({ ...prev, [columnId]: newWidth }))
    }

    const handleMouseUp = () => {
      setIsResizing(null)
      saveColumnWidths({ ...columnWidths, [columnId]: columnWidths[columnId] })
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Get filtered columns for rendering in the correct order
  const displayColumns = visibleColumns
    .map(colId => allColumns.find(col => col.id === colId))
    .filter(col => col !== undefined) as TableColumn[]

  useEffect(() => {
    loadInventory()
  }, [])

  // Close column manager dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const columnManagerRef = document.getElementById('column-manager-dropdown')
      if (showColumnManager && columnManagerRef && !columnManagerRef.contains(event.target as Node)) {
        const columnButton = document.getElementById('column-manager-button')
        if (!columnButton || !columnButton.contains(event.target as Node)) {
          setShowColumnManager(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColumnManager])

  // Handle URL parameters for search navigation
  useEffect(() => {
    const editId = searchParams.get('edit')
    const addNew = searchParams.get('add')
    const highlightId = searchParams.get('highlight')
    const adjustInventory = searchParams.get('adjust')
    const receiveInventory = searchParams.get('receive')
    const poId = searchParams.get('po')
    
    if (addNew === 'true') {
      setEditingItem(null)
      setShowAddModal(true)
    } else if (adjustInventory === 'true') {
      setShowAdjustments(true)
    } else if (receiveInventory === 'true') {
      // Handle receiving inventory modal
      if (poId) {
        // If specific PO is provided, fetch it
        fetchPurchaseOrder(poId)
      } else {
        // Open generic receiving modal
        setPreSelectedPO(null)
        setShowReceiveModal(true)
      }
    } else if (editId && inventory.length > 0) {
      const itemToEdit = inventory.find(item => item.id === editId)
      if (itemToEdit) {
        setEditingItem(itemToEdit)
        setShowAddModal(false) // Don't show add modal when editing from URL
      }
    } else if (highlightId && inventory.length > 0) {
      // Scroll to and highlight the item
      setTimeout(() => {
        const element = document.getElementById(`inventory-row-${highlightId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Add temporary highlight class
          element.classList.add('bg-yellow-100', 'ring-2', 'ring-yellow-400')
          setTimeout(() => {
            element.classList.remove('bg-yellow-100', 'ring-2', 'ring-yellow-400')
            // Clean up URL parameter after highlight fades
            router.push('/inventory')
          }, 3000) // Remove highlight after 3 seconds
        }
      }, 100) // Small delay to ensure DOM is ready
    }
  }, [searchParams, inventory])

  const fetchPurchaseOrder = async (poId: string) => {
    try {
      const { data: purchaseOrder, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (company_name, contact_name),
          purchase_order_lines (
            *,
            products (name, sku)
          )
        `)
        .eq('id', poId)
        .single()

      if (error) {
        console.error('Error fetching purchase order:', error)
        // Open generic receiving modal if PO not found
        setPreSelectedPO(null)
        setShowReceiveModal(true)
        return
      }

      setPreSelectedPO(purchaseOrder)
      setShowReceiveModal(true)
    } catch (error) {
      console.error('Error fetching purchase order:', error)
      setPreSelectedPO(null)
      setShowReceiveModal(true)
    }
  }

  const enrichInventoryWithPOData = async (inventoryItems: any[]): Promise<InventoryItem[]> => {
    try {
      // Get all product IDs
      const productIds = inventoryItems.map(item => item.product.id)
      
      if (productIds.length === 0) return inventoryItems
      
      // Query for active purchase orders for these products with quantity info
      const { data: poLines, error } = await supabase
        .from('purchase_order_lines')
        .select(`
          id,
          product_id,
          quantity,
          purchase_order_id,
          purchase_orders (
            po_number,
            status,
            order_date
          )
        `)
        .in('product_id', productIds)
        .not('purchase_orders', 'is', null)

      console.log('PO Lines query result:', { data: poLines, error })

      if (error) {
        console.error('Error fetching PO data:', error)
        return inventoryItems // Return without PO data if query fails
      }

      // Filter for active PO statuses after fetching
      const activePOLines = (poLines || []).filter(line => 
        line.purchase_orders &&
        ['PENDING', 'CONFIRMED', 'PARTIAL'].includes((line.purchase_orders as any).status)
      )

      // If no active PO lines, return early
      if (activePOLines.length === 0) {
        return inventoryItems
      }

      // Get all PO line IDs to fetch received quantities
      const poLineIds = activePOLines.map(line => line.id)
      
      console.log('Fetching receipts for PO line IDs:', poLineIds)
      
      // Fetch received quantities for all PO lines
      const { data: receipts, error: receiptsError } = await supabase
        .from('inventory_receipts')
        .select('po_line_id, qty_received')
        .in('po_line_id', poLineIds)

      if (receiptsError) {
        console.error('Error fetching receipts:', receiptsError)
        // Continue without receipts data - assume 0 received
      }

      console.log('Receipts data:', receipts)
      
      // Calculate received quantities by PO line
      const receivedByPoLine = (receipts || []).reduce((acc, receipt) => {
        if (!acc[receipt.po_line_id]) {
          acc[receipt.po_line_id] = 0
        }
        acc[receipt.po_line_id] += receipt.qty_received || 0
        return acc
      }, {} as Record<string, number>)

      // Group PO data by product_id with pending quantity calculation
      const poDataByProduct = activePOLines.reduce((acc, line) => {
        const qtyOrdered = line.quantity || 0
        const qtyReceived = receivedByPoLine[line.id] || 0
        const qtyPending = Math.max(0, qtyOrdered - qtyReceived)
        
        console.log(`Processing PO line ${line.id}: ordered=${qtyOrdered}, received=${qtyReceived}, pending=${qtyPending}`)
        
        if (!acc[line.product_id]) {
          acc[line.product_id] = []
        }
        
        acc[line.product_id].push({
          po_number: (line.purchase_orders as any)?.po_number || 'Unknown',
          status: (line.purchase_orders as any)?.status || 'Unknown',
          order_date: (line.purchase_orders as any)?.order_date || '',
          qty_ordered: qtyOrdered,
          qty_received: qtyReceived,
          qty_pending: qtyPending
        })
        return acc
      }, {} as Record<string, any[]>)

      console.log('Final PO data by product:', poDataByProduct)

      // Enrich inventory items with PO data
      return inventoryItems.map(item => ({
        ...item,
        active_purchase_orders: poDataByProduct[item.product.id] || []
      }))
    } catch (error) {
      console.error('Error enriching inventory with PO data:', error)
      return inventoryItems
    }
  }

  const loadInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          product:products (
            id, sku, manufacturer_part_number, name, description, category, unit_of_measure, 
            is_shippable, reorder_point
          )
        `)
        .order('product(name)')

      if (error) throw error
      
      console.log('Inventory data:', data)
      const inventoryWithPOs = await enrichInventoryWithPOData(data || [])
      setInventory(inventoryWithPOs)
    } catch (error) {
      console.error('Error loading inventory:', error)
      
      // Fallback sample data when Supabase is not accessible
      console.log('Loading fallback sample data')
      const sampleData: InventoryItem[] = [
        {
          id: '1',
          product: {
            id: '1',
            sku: 'SKU-001',
            manufacturer_part_number: 'ACME-WTA-001',
            name: 'Widget Type A',
            description: 'Standard widget for general applications',
            category: 'Widgets',
            unit_of_measure: 'EA',
            is_shippable: true,
            reorder_point: 100
          },
          quantity_on_hand: 150,
          quantity_allocated: 25,
          quantity_available: 125,
          weighted_average_cost: 12.50,
          last_cost: 12.50,
          sales_price: 18.75,
          location: 'MAIN',
          default_tax_code: 'TAX',
          default_tax_rate: 8.5
        },
        {
          id: '2',
          product: {
            id: '2',
            sku: 'SKU-002',
            manufacturer_part_number: 'ACME-WTB-002',
            name: 'Widget Type B',
            description: 'Heavy-duty widget for industrial use',
            category: 'Widgets',
            unit_of_measure: 'EA',
            is_shippable: true,
            reorder_point: 50
          },
          quantity_on_hand: 75,
          quantity_allocated: 15,
          quantity_available: 60,
          weighted_average_cost: 18.75,
          last_cost: 18.75,
          sales_price: 28.15,
          location: 'MAIN',
          default_tax_code: 'TAX',
          default_tax_rate: 8.5
        },
        {
          id: '3',
          product: {
            id: '3',
            sku: 'SKU-003',
            manufacturer_part_number: 'CONN-CAB-6FT',
            name: 'Connector Cable 6ft',
            description: '6-foot connector cable with standard plugs',
            category: 'Cables',
            unit_of_measure: 'EA',
            is_shippable: true,
            reorder_point: 200
          },
          quantity_on_hand: 300,
          quantity_allocated: 50,
          quantity_available: 250,
          weighted_average_cost: 5.25,
          last_cost: 5.25,
          sales_price: 7.99,
          location: 'MAIN',
          default_tax_code: 'NON',
          default_tax_rate: 0
        },
        {
          id: '4',
          product: {
            id: '4',
            sku: 'SKU-004',
            manufacturer_part_number: null,
            name: 'Installation Service',
            description: 'Professional installation service',
            category: 'Services',
            unit_of_measure: 'HR',
            is_shippable: false,
            reorder_point: null
          },
          quantity_on_hand: 0,
          quantity_allocated: 0,
          quantity_available: 0,
          weighted_average_cost: 0,
          last_cost: 0,
          sales_price: 75.00,
          location: 'MAIN',
          default_tax_code: 'EXE',
          default_tax_rate: 0
        },
        {
          id: '5',
          product: {
            id: '5',
            sku: 'SKU-005',
            manufacturer_part_number: 'ACME-PWK-KIT',
            name: 'Premium Widget Kit',
            description: 'Complete widget kit with accessories',
            category: 'Kits',
            unit_of_measure: 'KIT',
            is_shippable: true,
            reorder_point: 25
          },
          quantity_on_hand: 40,
          quantity_allocated: 0,
          quantity_available: 40,
          weighted_average_cost: 45.00,
          last_cost: 45.00,
          sales_price: 67.50,
          location: 'MAIN',
          default_tax_code: 'TAX',
          default_tax_rate: 8.5
        }
      ]
      
      setInventory(sampleData)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadInventory()
    setIsRefreshing(false)
  }

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.category?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter = (() => {
      switch (filter) {
        case 'low-stock':
          return item.product.reorder_point && item.quantity_available <= item.product.reorder_point
        case 'out-of-stock':
          return item.quantity_available <= 0
        default:
          return true
      }
    })()

    return matchesSearch && matchesFilter
  })

  const totalInventoryValue = inventory.reduce((sum, item) => 
    sum + (item.quantity_on_hand * item.weighted_average_cost), 0
  )

  const lowStockItems = inventory.filter(item => 
    item.product.reorder_point && item.quantity_available <= item.product.reorder_point
  ).length

  const outOfStockItems = inventory.filter(item => item.quantity_available <= 0).length

  const handleAddItem = async (newItem: any) => {
    console.log('Starting to add new item:', newItem)
    
    // Test connection first
    try {
      const { data: testData, error: testError } = await supabase
        .from('products')
        .select('count')
        .limit(1)
      
      if (testError) {
        console.error('Supabase connection test failed:', testError)
        throw new Error('Database connection failed')
      }
      console.log('Supabase connection test passed')
    } catch (connectionError) {
      console.error('Connection error:', connectionError)
      throw connectionError
    }
    
    try {
      // First, create the product
      console.log('Creating product in database...')
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert({
          sku: newItem.sku,
          manufacturer_part_number: newItem.manufacturer_part_number || null,
          name: newItem.name,
          description: newItem.description || null,
          category: newItem.category || null,
          unit_of_measure: newItem.unit_of_measure,
          is_shippable: newItem.is_shippable,
          reorder_point: newItem.reorder_point
        })
        .select()
        .single()

      if (productError) {
        console.error('Product creation error:', productError)
        throw productError
      }
      console.log('Product created successfully:', productData)

      // Then create the inventory record
      console.log('Creating inventory record...')
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .insert({
          product_id: productData.id,
          quantity_on_hand: newItem.quantity_on_hand,
          quantity_allocated: 0,
          weighted_average_cost: newItem.weighted_average_cost,
          last_cost: newItem.weighted_average_cost,
          sales_price: newItem.sales_price,
          location: 'MAIN'
        })
        .select(`
          *,
          product:products (
            id, sku, manufacturer_part_number, name, description, category, unit_of_measure, 
            is_shippable, reorder_point
          )
        `)
        .single()

      if (inventoryError) {
        console.error('Inventory creation error:', inventoryError)
        throw inventoryError
      }
      console.log('Inventory created successfully:', inventoryData)

      // Add to the inventory list with calculated available quantity
      const newInventoryItem: InventoryItem = {
        ...inventoryData,
        quantity_available: inventoryData.quantity_on_hand - inventoryData.quantity_allocated
      }
      
      setInventory(prev => [...prev, newInventoryItem])
      console.log('Successfully added inventory item:', newInventoryItem)
      
    } catch (error) {
      console.error('Error adding inventory item:', error)
      console.error('Full error details:', JSON.stringify(error, null, 2))
      
      // Fallback to local state if database fails
      const fallbackItem: InventoryItem = {
        id: `new-${Date.now()}`,
        product: {
          id: `product-${Date.now()}`,
          sku: newItem.sku,
          manufacturer_part_number: newItem.manufacturer_part_number,
          name: newItem.name,
          description: newItem.description,
          category: newItem.category,
          unit_of_measure: newItem.unit_of_measure,
          is_shippable: newItem.is_shippable,
          reorder_point: newItem.reorder_point
        },
        quantity_on_hand: newItem.quantity_on_hand,
        quantity_allocated: 0,
        quantity_available: newItem.quantity_on_hand,
        weighted_average_cost: newItem.weighted_average_cost,
        last_cost: newItem.weighted_average_cost,
        sales_price: newItem.sales_price,
        location: 'MAIN'
      }
      
      setInventory(prev => [...prev, fallbackItem])
      console.log('Added item to local state (database unavailable):', fallbackItem)
    }
  }

  const handleUpdateItem = async (updatedItem: any) => {
    try {
      const existingItem = inventory.find(item => item.id === updatedItem.id)
      if (!existingItem) throw new Error('Item not found')

      // Update the product
      const { error: productError } = await supabase
        .from('products')
        .update({
          sku: updatedItem.sku,
          manufacturer_part_number: updatedItem.manufacturer_part_number || null,
          name: updatedItem.name,
          description: updatedItem.description || null,
          category: updatedItem.category || null,
          unit_of_measure: updatedItem.unit_of_measure,
          is_shippable: updatedItem.is_shippable,
          reorder_point: updatedItem.reorder_point
        })
        .eq('id', existingItem.product.id)

      if (productError) throw productError

      // Update the inventory record
      const { error: inventoryError } = await supabase
        .from('inventory')
        .update({
          quantity_on_hand: updatedItem.quantity_on_hand,
          weighted_average_cost: updatedItem.weighted_average_cost,
          last_cost: updatedItem.weighted_average_cost,
          sales_price: updatedItem.sales_price,
          default_tax_code: updatedItem.default_tax_code,
          default_tax_rate: updatedItem.default_tax_rate
        })
        .eq('id', updatedItem.id)

      if (inventoryError) throw inventoryError

      // Update local state
      setInventory(prev => prev.map(item => 
        item.id === updatedItem.id 
          ? {
              ...item,
              product: {
                ...item.product,
                sku: updatedItem.sku,
                manufacturer_part_number: updatedItem.manufacturer_part_number,
                name: updatedItem.name,
                description: updatedItem.description,
                category: updatedItem.category,
                unit_of_measure: updatedItem.unit_of_measure,
                is_shippable: updatedItem.is_shippable,
                reorder_point: updatedItem.reorder_point
              },
              quantity_on_hand: updatedItem.quantity_on_hand,
              quantity_available: updatedItem.quantity_on_hand - item.quantity_allocated,
              weighted_average_cost: updatedItem.weighted_average_cost,
              last_cost: updatedItem.weighted_average_cost,
              sales_price: updatedItem.sales_price,
              default_tax_code: updatedItem.default_tax_code,
              default_tax_rate: updatedItem.default_tax_rate
            }
          : item
      ))
      
      console.log('Successfully updated inventory item:', updatedItem)
      
    } catch (error) {
      console.error('Error updating inventory item:', error)
      
      // Fallback to local state update if database fails
      setInventory(prev => prev.map(item => 
        item.id === updatedItem.id 
          ? {
              ...item,
              product: {
                ...item.product,
                sku: updatedItem.sku,
                manufacturer_part_number: updatedItem.manufacturer_part_number,
                name: updatedItem.name,
                description: updatedItem.description,
                category: updatedItem.category,
                unit_of_measure: updatedItem.unit_of_measure,
                is_shippable: updatedItem.is_shippable,
                reorder_point: updatedItem.reorder_point
              },
              quantity_on_hand: updatedItem.quantity_on_hand,
              quantity_available: updatedItem.quantity_on_hand - item.quantity_allocated,
              weighted_average_cost: updatedItem.weighted_average_cost,
              last_cost: updatedItem.weighted_average_cost,
              sales_price: updatedItem.sales_price,
              default_tax_code: updatedItem.default_tax_code,
              default_tax_rate: updatedItem.default_tax_rate
            }
          : item
      ))
      console.log('Updated item in local state (database unavailable):', updatedItem)
    }
    
    setEditingItem(null)
  }

  // Combined delete handler that works with both id string and InventoryItem object
  const handleDeleteItem = async (idOrItem: string | InventoryItem) => {
    try {
      // Handle both string ID and InventoryItem object
      let item: InventoryItem | undefined
      let id: string
      
      if (typeof idOrItem === 'string') {
        id = idOrItem
        item = inventory.find(inv => inv.id === id)
        if (!item) throw new Error('Item not found')
      } else {
        item = idOrItem
        id = item.id
      }

      // For context menu calls (InventoryItem object), perform business rule validation
      if (typeof idOrItem === 'object') {
        const canDel = await canDelete(item)
        
        if (!canDel) {
          alert('Cannot delete this item - it has transactional history (POs, SOs, estimates, invoices, or inventory transactions)')
          return
        }

        if (!confirm(`Are you sure you want to permanently DELETE "${item.product.name}"?\n\nThis action cannot be undone!`)) {
          return
        }

        // Double confirmation for delete
        if (!confirm('This will permanently delete the inventory item and its product record. Are you absolutely sure?')) {
          return
        }
      }

      // Delete the inventory record first (foreign key constraint)
      const { error: inventoryError } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id)

      if (inventoryError) throw inventoryError

      // Delete the product record
      const { error: productError } = await supabase
        .from('products')
        .delete()
        .eq('id', item.product.id)

      if (productError) throw productError

      // Remove from local state or reload
      if (typeof idOrItem === 'string') {
        setInventory(prev => prev.filter(item => item.id !== id))
        console.log('Successfully deleted inventory item:', id)
      } else {
        loadInventory() // Refresh the list for context menu calls
      }
      
    } catch (error) {
      console.error('Error deleting inventory item:', error)
      
      if (typeof idOrItem === 'string') {
        // Fallback to local state deletion for string ID calls
        setInventory(prev => prev.filter(item => item.id !== idOrItem))
        console.log('Deleted item from local state (database unavailable):', idOrItem)
      } else {
        alert('Failed to delete item')
      }
    }
    
    // Only reset editing item for string ID calls (from AddItemModal)
    if (typeof idOrItem === 'string') {
      setEditingItem(null)
    }
  }

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item)
    setShowAddModal(false) // Don't show add modal when editing
  }

  const handleShowTransactionHistory = (item: InventoryItem) => {
    setSelectedItemForSubWindow(item)
    setShowTransactionHistory(true)
  }

  const handleShowSalesOrders = (item: InventoryItem) => {
    setSelectedItemForSubWindow(item)
    setShowSalesOrders(true)
  }

  const handleShowPurchaseOrders = (item: InventoryItem) => {
    setSelectedItemForSubWindow(item)
    setShowPurchaseOrders(true)
  }

  // Check if item can be marked inactive (not on any active PO or SO)
  const canMarkInactive = async (item: InventoryItem): Promise<boolean> => {
    try {
      // Check for active purchase orders
      const { data: poLines } = await supabase
        .from('purchase_order_lines')
        .select(`
          purchase_order:purchase_orders!inner(status)
        `)
        .eq('product_id', item.product.id)
        .in('purchase_order.status', ['draft', 'sent', 'confirmed'])

      // Check for active sales orders  
      const { data: soLines } = await supabase
        .from('sales_order_lines')
        .select(`
          sales_order:sales_orders!inner(status)
        `)
        .eq('product_id', item.product.id)
        .in('sales_order.status', ['draft', 'confirmed', 'in_progress'])

      return (poLines?.length || 0) === 0 && (soLines?.length || 0) === 0
    } catch (error) {
      console.error('Error checking PO/SO status:', error)
      return false
    }
  }

  // Check if item can be deleted (no transactional history)
  const canDelete = async (item: InventoryItem): Promise<boolean> => {
    try {
      // Check for any transaction history
      const checks = await Promise.all([
        supabase.from('inventory_transactions').select('id').eq('inventory_id', item.id).limit(1),
        supabase.from('purchase_order_lines').select('id').eq('product_id', item.product.id).limit(1),
        supabase.from('sales_order_lines').select('id').eq('product_id', item.product.id).limit(1),
        supabase.from('estimate_lines').select('id').eq('product_id', item.product.id).limit(1),
        supabase.from('invoice_lines').select('id').eq('product_id', item.product.id).limit(1)
      ])

      return checks.every(result => (result.data?.length || 0) === 0)
    } catch (error) {
      console.error('Error checking transaction history:', error)
      return false
    }
  }

  const handleMarkInactive = async (item: InventoryItem) => {
    try {
      const canMark = await canMarkInactive(item)
      
      if (!canMark) {
        alert('Cannot mark this item inactive - it is currently on active Purchase Orders or Sales Orders')
        return
      }

      if (!confirm(`Are you sure you want to mark "${item.product.name}" as inactive?`)) {
        return
      }

      const { error } = await supabase
        .from('inventory')
        .update({ is_active: false })
        .eq('id', item.id)

      if (error) {
        console.error('Error marking item inactive:', error)
        alert('Failed to mark item inactive')
      } else {
        loadInventory() // Refresh the list
      }
    } catch (error) {
      console.error('Error in handleMarkInactive:', error)
      alert('Failed to mark item inactive')
    }
  }

  const handleMarkActive = async (item: InventoryItem) => {
    try {
      if (!confirm(`Are you sure you want to reactivate "${item.product.name}"?`)) {
        return
      }

      const { error } = await supabase
        .from('inventory')
        .update({ is_active: true })
        .eq('id', item.id)

      if (error) {
        console.error('Error marking item active:', error)
        alert('Failed to reactivate item')
      } else {
        loadInventory() // Refresh the list
      }
    } catch (error) {
      console.error('Error in handleMarkActive:', error)
      alert('Failed to reactivate item')
    }
  }


  const getContextMenuOptions = (item: InventoryItem): ContextMenuOption[] => {
    const baseOptions: ContextMenuOption[] = [
      {
        id: 'edit',
        label: 'Edit Item',
        icon: <Edit3 className="h-4 w-4" />,
        onClick: () => handleEditItem(item)
      },
      {
        id: 'separator1',
        label: '',
        separator: true,
        onClick: () => {}
      },
      {
        id: 'transaction-history',
        label: 'Transaction History',
        icon: <History className="h-4 w-4" />,
        onClick: () => handleShowTransactionHistory(item)
      },
      {
        id: 'sales-orders',
        label: 'View on Sales Orders',
        icon: <ShoppingCart className="h-4 w-4" />,
        onClick: () => handleShowSalesOrders(item)
      },
      {
        id: 'purchase-orders',
        label: 'View on Purchase Orders',
        icon: <ShoppingBag className="h-4 w-4" />,
        onClick: () => handleShowPurchaseOrders(item)
      }
    ]

    // Add inactive/active toggle
    if (item.is_active) {
      baseOptions.push({
        id: 'separator2',
        label: '',
        separator: true,
        onClick: () => {}
      })
      baseOptions.push({
        id: 'mark-inactive',
        label: 'Mark Inactive',
        icon: <Archive className="h-4 w-4" />,
        onClick: () => handleMarkInactive(item),
        className: 'text-orange-600 hover:text-orange-700'
      })
    } else {
      baseOptions.push({
        id: 'separator2',
        label: '',
        separator: true,
        onClick: () => {}
      })
      baseOptions.push({
        id: 'mark-active',
        label: 'Reactivate Item',
        icon: <Package className="h-4 w-4" />,
        onClick: () => handleMarkActive(item),
        className: 'text-green-600 hover:text-green-700'
      })
    }

    // Add delete option (always show - validation happens in handler)
    baseOptions.push({
      id: 'delete',
      label: 'Delete Item',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => handleDeleteItem(item),
      className: 'text-red-600 hover:text-red-700'
    })

    return baseOptions
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600">Manage your stock levels and inventory items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowAdjustments(true)}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Adjust Inventory
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowAdjustmentHistory(true)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Adjustments
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              setEditingItem(null)
              setShowAddModal(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventory.length}</div>
            <p className="text-xs text-gray-600">Unique SKUs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalInventoryValue)}</div>
            <p className="text-xs text-gray-600">At average cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStockItems}</div>
            <p className="text-xs text-gray-600">Below reorder point</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outOfStockItems}</div>
            <p className="text-xs text-gray-600">Zero available</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by SKU, name, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            size="sm"
          >
            All Items
          </Button>
          <Button 
            variant={filter === 'low-stock' ? 'default' : 'outline'}
            onClick={() => setFilter('low-stock')}
            size="sm"
          >
            Low Stock ({lowStockItems})
          </Button>
          <Button 
            variant={filter === 'out-of-stock' ? 'default' : 'outline'}
            onClick={() => setFilter('out-of-stock')}
            size="sm"
          >
            Out of Stock ({outOfStockItems})
          </Button>
          
          {/* Column Manager */}
          <div className="relative">
            <Button
              id="column-manager-button"
              variant="outline"
              size="sm"
              onClick={() => setShowColumnManager(!showColumnManager)}
            >
              <Settings className="h-4 w-4 mr-1" />
              Columns
            </Button>
            
            {showColumnManager && (
              <div id="column-manager-dropdown" className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-64">
                <div className="p-3 border-b">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-sm">Show Columns</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetColumns}
                      className="text-xs"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
                <div className="p-2 max-h-96 overflow-y-auto">
                  <div className="text-xs text-gray-600 mb-3 px-2">
                    💡 Drag column headers to reorder • Drag column borders to resize
                  </div>
                  {allColumns.map((column) => {
                    const isVisible = visibleColumns.includes(column.id)
                    const isRequired = column.required
                    return (
                      <label
                        key={column.id}
                        className={`flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer ${
                          isRequired ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isVisible}
                          disabled={isRequired}
                          onChange={() => toggleColumn(column.id)}
                          className="mr-3 rounded"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{column.label}</div>
                          {isRequired && (
                            <div className="text-xs text-gray-500">Required</div>
                          )}
                        </div>
                        {isVisible ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        )}
                      </label>
                    )
                  })}
                </div>
                <div className="p-3 border-t text-xs text-gray-500">
                  Showing {visibleColumns.length} of {allColumns.length} columns
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
          <CardDescription>
            {filteredInventory.length} of {inventory.length} items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b">
                  {displayColumns.map((column, index) => {
                    const width = columnWidths[column.id] || column.defaultWidth
                    const isDragging = draggedColumnId === column.id
                    const isDraggedOver = draggedOverColumnId === column.id
                    const isCurrentlyResizing = isResizing === column.id
                    
                    return (
                      <th 
                        key={column.id}
                        draggable={true}
                        onDragStart={(e) => handleHeaderDragStart(e, column.id)}
                        onDragOver={(e) => handleHeaderDragOver(e, column.id)}
                        onDragLeave={handleHeaderDragLeave}
                        onDrop={(e) => handleHeaderDrop(e, column.id)}
                        onDragEnd={handleHeaderDragEnd}
                        style={{ width: `${width}px` }}
                        className={`py-2 px-3 font-medium text-gray-700 whitespace-nowrap relative select-none border-r border-gray-200 text-xs cursor-move ${
                          column.align === 'right' ? 'text-right' : 
                          column.align === 'center' ? 'text-center' : 'text-left'
                        } ${
                          isDragging ? 'opacity-50 bg-blue-50' : 
                          isDraggedOver ? 'bg-blue-50 border-l-2 border-l-blue-400' : 
                          'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between h-full">
                          <span className="truncate">{column.label}</span>
                          <GripVertical className={`h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ${
                            column.required ? 'text-blue-500' : ''
                          }`} />
                        </div>
                        
                        {/* Resize handle */}
                        <div
                          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 ${
                            isCurrentlyResizing ? 'bg-blue-400' : ''
                          }`}
                          onMouseDown={(e) => handleResizeStart(e, column.id)}
                        />
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => (
                  <ContextMenu key={item.id} options={getContextMenuOptions(item)}>
                    <tr 
                      id={`inventory-row-${item.id}`}
                      className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleEditItem(item)}
                    >
                      {displayColumns.map((column) => {
                        const width = columnWidths[column.id] || column.defaultWidth
                        return (
                          <td 
                            key={column.id}
                            style={{ width: `${width}px` }}
                            className={`py-2 px-3 whitespace-nowrap border-r border-gray-200 text-xs ${
                              column.align === 'right' ? 'text-right' : 
                              column.align === 'center' ? 'text-center' : 'text-left'
                            }`}
                          >
                            <div className="truncate">
                              {column.render ? column.render(item) : column.getValue(item)}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  </ContextMenu>
                ))}
              </tbody>
            </table>
          </div>

          {filteredInventory.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No inventory items found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding your first inventory item.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Item Modal */}
      <AddItemModal
        isOpen={showAddModal && !editingItem}
        onClose={() => {
          setShowAddModal(false)
          setEditingItem(null)
          // Clean up URL parameters
          router.push('/inventory')
        }}
        onAdd={handleAddItem}
        onUpdate={handleUpdateItem}
        onDelete={handleDeleteItem}
        editingItem={null}
      />
      
      {/* Edit Inventory Safe Modal */}
      {editingItem && (
        <EditInventorySafe
          inventoryItem={{
            id: editingItem.id,
            product_id: editingItem.product.id,
            quantity_on_hand: editingItem.quantity_on_hand,
            quantity_allocated: editingItem.quantity_allocated,
            quantity_available: editingItem.quantity_available,
            weighted_average_cost: editingItem.weighted_average_cost,
            last_cost: editingItem.last_cost,
            sales_price: editingItem.sales_price,
            location: editingItem.location,
            default_tax_code: editingItem.default_tax_code,
            default_tax_rate: editingItem.default_tax_rate,
            reorder_point: editingItem.product.reorder_point,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }}
          isOpen={true}
          onClose={() => {
            setEditingItem(null)
            router.push('/inventory')
          }}
          onSave={(updatedItem) => {
            // Convert back to the nested structure expected by handleUpdateItem
            const fullItem = {
              id: updatedItem.id,
              sku: editingItem.product.sku,
              manufacturer_part_number: editingItem.product.manufacturer_part_number,
              name: editingItem.product.name,
              description: editingItem.product.description,
              category: editingItem.product.category,
              unit_of_measure: editingItem.product.unit_of_measure,
              is_shippable: editingItem.product.is_shippable,
              reorder_point: updatedItem.reorder_point,
              quantity_on_hand: updatedItem.quantity_on_hand,
              weighted_average_cost: updatedItem.weighted_average_cost,
              sales_price: updatedItem.sales_price,
              location: updatedItem.location,
              default_tax_code: updatedItem.default_tax_code,
              default_tax_rate: updatedItem.default_tax_rate
            }
            handleUpdateItem(fullItem)
          }}
          currentUserId="demo-user"
          productName={editingItem.product.name}
        />
      )}

      {/* Inventory Adjustments */}
      <InventoryAdjustments
        isOpen={showAdjustments}
        onClose={() => setShowAdjustments(false)}
        inventory={inventory}
        onAdjustmentComplete={() => {
          console.log('Adjustment completed, reloading inventory...')
          loadInventory() // Reload inventory data after adjustments
        }}
      />

      <AdjustmentHistory
        isOpen={showAdjustmentHistory}
        onClose={() => setShowAdjustmentHistory(false)}
      />

      {/* Sub-Windows for Item Details */}
      {selectedItemForSubWindow && (
        <>
          <SubWindow
            isOpen={showTransactionHistory}
            onClose={() => {
              setShowTransactionHistory(false)
              setSelectedItemForSubWindow(null)
            }}
            title={`Transaction History - ${selectedItemForSubWindow.product.sku}`}
            width={1000}
            height={800}
          >
            <ItemTransactionHistory 
              item={selectedItemForSubWindow} 
              onClose={() => {
                setShowTransactionHistory(false)
                setSelectedItemForSubWindow(null)
              }}
            />
          </SubWindow>

          <SubWindow
            isOpen={showSalesOrders}
            onClose={() => {
              setShowSalesOrders(false)
              setSelectedItemForSubWindow(null)
            }}
            title={`Sales Orders - ${selectedItemForSubWindow.product.sku}`}
            width={1000}
            height={800}
          >
            <ItemSalesOrders 
              item={selectedItemForSubWindow} 
              onClose={() => {
                setShowSalesOrders(false)
                setSelectedItemForSubWindow(null)
              }}
            />
          </SubWindow>

          <SubWindow
            isOpen={showPurchaseOrders}
            onClose={() => {
              setShowPurchaseOrders(false)
              setSelectedItemForSubWindow(null)
            }}
            title={`Purchase Orders - ${selectedItemForSubWindow.product.sku}`}
            width={1000}
            height={800}
          >
            <ItemPurchaseOrders 
              item={selectedItemForSubWindow} 
              onClose={() => {
                setShowPurchaseOrders(false)
                setSelectedItemForSubWindow(null)
              }}
            />
          </SubWindow>
        </>
      )}

      {/* Receive Inventory Modal */}
      <ReceiveInventoryModal
        isOpen={showReceiveModal}
        onClose={() => {
          setShowReceiveModal(false)
          setPreSelectedPO(null)
          // Clean up URL parameters
          router.push('/inventory')
        }}
        preSelectedPO={preSelectedPO}
        onSuccess={() => {
          loadInventory() // Refresh inventory after receiving
        }}
      />
    </div>
  )
}