'use client'

import { useState, useEffect } from 'react'
import SalesOrdersList from '@/components/sales-orders/sales-orders-list'
import CreateSalesOrderQuickBooksStyle from '@/components/sales-orders/create-sales-order-quickbooks-style'
import EditSalesOrderQuickBooksStyle from '@/components/sales-orders/edit-sales-order-quickbooks-style'
import { Database } from '@/lib/supabase'

type SalesOrder = Database['public']['Tables']['sales_orders']['Row'] & {
  customers?: { name: string; email: string | null }
  sales_reps?: { first_name: string; last_name: string; employee_code: string }
}

export default function SalesOrdersMain() {
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'edit'>('list')
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<SalesOrder | null>(null)
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])

  // Listen for duplicate sales order events (same pattern as estimates)
  useEffect(() => {
    const handleOpenSalesOrder = (event: CustomEvent) => {
      const { salesOrder } = event.detail
      console.log('Received openSalesOrderForEdit event:', salesOrder)
      // Add the new sales order to the list if it doesn't exist
      setSalesOrders(prev => {
        const exists = prev.some(so => so.id === salesOrder.id)
        if (!exists) {
          return [salesOrder, ...prev]
        }
        return prev
      })
      // Open the duplicate sales order for editing
      setSelectedSalesOrder(salesOrder)
      setCurrentView('edit')
    }
    
    window.addEventListener('openSalesOrderForEdit', handleOpenSalesOrder as EventListener)
    
    return () => {
      window.removeEventListener('openSalesOrderForEdit', handleOpenSalesOrder as EventListener)
    }
  }, [])

  const handleCreateSalesOrder = () => {
    setCurrentView('create')
    setSelectedSalesOrder(null)
  }

  const handleEditSalesOrder = (salesOrder: SalesOrder) => {
    console.log('=== handleEditSalesOrder CALLED ===')
    console.log('salesOrder to edit:', salesOrder)
    console.log('Current view:', currentView)
    console.log('Current selected SO:', selectedSalesOrder?.id)
    
    // If this is a new sales order (not in our current list), add it first
    const existsInList = salesOrders.some(so => so.id === salesOrder.id)
    console.log('Sales order exists in list:', existsInList)
    
    if (!existsInList) {
      console.log('Adding new sales order to list')
      setSalesOrders(prev => [salesOrder, ...prev])
    }
    
    console.log('Setting selected sales order and switching to edit view')
    setSelectedSalesOrder(salesOrder)
    setCurrentView('edit')
    console.log('Navigation should be complete')
  }

  const handleSaveSalesOrder = (salesOrder: SalesOrder) => {
    // Update the sales orders list
    setSalesOrders(prev => {
      const existing = prev.find(so => so.id === salesOrder.id)
      if (existing) {
        return prev.map(so => so.id === salesOrder.id ? salesOrder : so)
      } else {
        return [...prev, salesOrder]
      }
    })
    
    // Keep user in current view (create or edit) instead of going back to list
    // For new sales orders (create), switch to edit view with the new sales order
    const isNewSalesOrder = !salesOrders.find(so => so.id === salesOrder.id)
    if (isNewSalesOrder) {
      // This is a new sales order, switch to edit mode
      setSelectedSalesOrder(salesOrder)
      setCurrentView('edit')
    }
    // For existing sales orders (edit), stay in edit view
    // setCurrentView('list') // Removed - keep editing
  }

  const handleCancel = () => {
    setCurrentView('list')
    setSelectedSalesOrder(null)
  }

  const handleDeleteSalesOrder = (salesOrder: SalesOrder) => {
    setSalesOrders(prev => prev.filter(so => so.id !== salesOrder.id))
    setCurrentView('list')
  }

  if (currentView === 'create') {
    return (
      <CreateSalesOrderQuickBooksStyle
        onSave={handleSaveSalesOrder}
        onCancel={handleCancel}
        salesOrders={salesOrders}
        onNavigate={handleEditSalesOrder}
      />
    )
  }

  if (currentView === 'edit' && selectedSalesOrder) {
    return (
      <EditSalesOrderQuickBooksStyle
        salesOrder={selectedSalesOrder}
        onSave={handleSaveSalesOrder}
        onCancel={handleCancel}
        onDelete={handleDeleteSalesOrder}
        salesOrders={salesOrders}
        onNavigate={handleEditSalesOrder}
      />
    )
  }

  return (
    <SalesOrdersList
      onCreateSalesOrder={handleCreateSalesOrder}
      onEditSalesOrder={handleEditSalesOrder}
      salesOrders={salesOrders}
      setSalesOrders={setSalesOrders}
    />
  )
}