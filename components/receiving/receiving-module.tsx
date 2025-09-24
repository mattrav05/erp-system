'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import ReceivingList from './receiving-list'
import CreateReceiving from './create-receiving'

type InventoryReceipt = any & {
  products?: { name: string; sku: string }
  purchase_order_lines?: {
    purchase_orders?: { po_number: string }
  }
}

type PurchaseOrder = any & {
  vendors?: { company_name: string }
  purchase_order_lines?: any[]
}

export default function ReceivingModule() {
  const searchParams = useSearchParams()
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'edit'>('list')
  const [selectedReceipt, setSelectedReceipt] = useState<InventoryReceipt | null>(null)
  const [preSelectedPO, setPreSelectedPO] = useState<PurchaseOrder | null>(null)
  const [isLoadingPO, setIsLoadingPO] = useState(false)

  // Check for PO ID in URL parameters
  useEffect(() => {
    const poId = searchParams.get('po')
    if (poId) {
      loadPurchaseOrder(poId)
    }
  }, [searchParams])

  const loadPurchaseOrder = async (poId: string) => {
    setIsLoadingPO(true)
    try {
      console.log('Loading PO for receiving:', poId)
      
      const { data: po, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (company_name),
          purchase_order_lines (
            *,
            products (name, sku)
          )
        `)
        .eq('id', poId)
        .single()

      if (error) {
        console.error('Error loading PO:', error)
        return
      }

      console.log('Loaded PO:', po)
      setPreSelectedPO(po)
      setCurrentView('create')
      
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname)
    } catch (error) {
      console.error('Error loading PO:', error)
    } finally {
      setIsLoadingPO(false)
    }
  }

  const handleCreateReceipt = () => {
    setSelectedReceipt(null)
    setPreSelectedPO(null)
    setCurrentView('create')
  }

  const handleEditReceipt = (receipt: InventoryReceipt) => {
    setSelectedReceipt(receipt)
    setPreSelectedPO(null)
    setCurrentView('edit')
  }

  const handleBackToList = () => {
    setSelectedReceipt(null)
    setPreSelectedPO(null)
    setCurrentView('list')
  }

  if (isLoadingPO) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  switch (currentView) {
    case 'create':
      return (
        <CreateReceiving
          preSelectedPO={preSelectedPO}
          onBack={handleBackToList}
          onSuccess={handleBackToList}
        />
      )
    
    case 'edit':
      return (
        <CreateReceiving
          receipt={selectedReceipt}
          onBack={handleBackToList}
          onSuccess={handleBackToList}
        />
      )
    
    default:
      return (
        <ReceivingList
          onCreateReceipt={handleCreateReceipt}
          onEditReceipt={handleEditReceipt}
        />
      )
  }
}