'use client'

import { useState, useEffect } from 'react'
import PurchaseOrdersList from '@/components/purchase-orders/purchase-orders-list'
import CreatePurchaseOrderQuickBooksStyle from '@/components/purchase-orders/create-purchase-order-quickbooks-style'
import EditPurchaseOrderQuickBooksStyle from '@/components/purchase-orders/edit-purchase-order-quickbooks-style'
import { Database } from '@/lib/supabase'

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'] & {
  vendors?: { company_name: string; contact_name: string | null }
  sales_reps?: { first_name: string; last_name: string; employee_code: string }
}

export default function PurchaseOrdersMain() {
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'edit'>('list')
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [createFromSalesOrderId, setCreateFromSalesOrderId] = useState<string | null>(null)

  // Check URL parameters for creating PO from Sales Order
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const urlParams = new URLSearchParams(window.location.search)
    const createFromSO = urlParams.get('create_from_so')
    
    if (createFromSO) {
      setCreateFromSalesOrderId(createFromSO)
      setCurrentView('create')
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Listen for duplicate purchase order events (same pattern as estimates/sales orders)
  useEffect(() => {
    const handleOpenPurchaseOrder = (event: CustomEvent) => {
      const { purchaseOrder } = event.detail
      console.log('Received openPurchaseOrderForEdit event:', purchaseOrder)
      console.log('Current view before change:', currentView)
      console.log('Current selected PO before change:', selectedPurchaseOrder?.id)
      
      // Add the new purchase order to the list if it doesn't exist
      setPurchaseOrders(prev => {
        const exists = prev.some(po => po.id === purchaseOrder.id)
        console.log('PO exists in list:', exists)
        if (!exists) {
          console.log('Adding new PO to list')
          return [purchaseOrder, ...prev]
        }
        return prev
      })
      
      // Open the duplicate purchase order for editing
      console.log('Setting selected PO to:', purchaseOrder.id)
      console.log('Switching view to edit')
      setSelectedPurchaseOrder(purchaseOrder)
      setCurrentView('edit')
      
      // Verify the changes took effect
      setTimeout(() => {
        console.log('After state change - view should be edit, selected PO should be:', purchaseOrder.id)
      }, 100)
    }
    
    window.addEventListener('openPurchaseOrderForEdit', handleOpenPurchaseOrder as EventListener)
    
    return () => {
      window.removeEventListener('openPurchaseOrderForEdit', handleOpenPurchaseOrder as EventListener)
    }
  }, [])

  const handleCreatePurchaseOrder = () => {
    setCurrentView('create')
    setSelectedPurchaseOrder(null)
    setCreateFromSalesOrderId(null)
  }

  const handleEditPurchaseOrder = (purchaseOrder: PurchaseOrder) => {
    console.log('=== handleEditPurchaseOrder CALLED ===')
    console.log('purchaseOrder to edit:', purchaseOrder)
    console.log('Current view:', currentView)
    console.log('Current selected PO:', selectedPurchaseOrder?.id)
    
    // If this is a new purchase order (not in our current list), add it first
    const existsInList = purchaseOrders.some(po => po.id === purchaseOrder.id)
    console.log('Purchase order exists in list:', existsInList)
    
    if (!existsInList) {
      console.log('Adding new purchase order to list')
      setPurchaseOrders(prev => [purchaseOrder, ...prev])
    }
    
    console.log('Setting selected purchase order and switching to edit view')
    setSelectedPurchaseOrder(purchaseOrder)
    setCurrentView('edit')
    console.log('Navigation should be complete')
  }

  const handleSavePurchaseOrder = (purchaseOrder: PurchaseOrder) => {
    // Update the purchase orders list
    setPurchaseOrders(prev => {
      const existing = prev.find(po => po.id === purchaseOrder.id)
      if (existing) {
        return prev.map(po => po.id === purchaseOrder.id ? purchaseOrder : po)
      } else {
        return [...prev, purchaseOrder]
      }
    })
    
    // Keep user in current view (create or edit) instead of going back to list
    // For new purchase orders (create), switch to edit view with the new purchase order
    const isNewPurchaseOrder = !purchaseOrders.find(po => po.id === purchaseOrder.id)
    if (isNewPurchaseOrder) {
      // This is a new purchase order, switch to edit mode
      setSelectedPurchaseOrder(purchaseOrder)
      setCurrentView('edit')
    }
    // For existing purchase orders (edit), stay in edit view
    // setCurrentView('list') // Removed - keep editing
  }

  const handleCancel = () => {
    setCurrentView('list')
    setSelectedPurchaseOrder(null)
    setCreateFromSalesOrderId(null)
  }

  const handleDeletePurchaseOrder = (purchaseOrder: PurchaseOrder) => {
    setPurchaseOrders(prev => prev.filter(po => po.id !== purchaseOrder.id))
    setCurrentView('list')
  }

  if (currentView === 'create') {
    return (
      <CreatePurchaseOrderQuickBooksStyle
        onSave={handleSavePurchaseOrder}
        onCancel={handleCancel}
        purchaseOrders={purchaseOrders}
        onNavigate={handleEditPurchaseOrder}
        createFromSalesOrderId={createFromSalesOrderId}
      />
    )
  }

  if (currentView === 'edit' && selectedPurchaseOrder) {
    return (
      <EditPurchaseOrderQuickBooksStyle
        key={selectedPurchaseOrder.id}
        purchaseOrder={selectedPurchaseOrder}
        onSave={handleSavePurchaseOrder}
        onCancel={handleCancel}
        onDelete={handleDeletePurchaseOrder}
        purchaseOrders={purchaseOrders}
        onNavigate={handleEditPurchaseOrder}
      />
    )
  }

  return (
    <PurchaseOrdersList
      onCreatePurchaseOrder={handleCreatePurchaseOrder}
      onEditPurchaseOrder={handleEditPurchaseOrder}
      purchaseOrders={purchaseOrders}
      setPurchaseOrders={setPurchaseOrders}
    />
  )
}