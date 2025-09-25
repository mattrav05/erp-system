'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import InvoicesList from './invoices-list'
import CreateInvoiceQuickBooksStyle from './create-invoice-quickbooks-style'
import EditInvoiceQuickBooksStyle from './edit-invoice-quickbooks-style'

type Invoice = any & {
  customers?: { company_name: string; contact_name: string | null }
  sales_reps?: { first_name: string; last_name: string; employee_code: string }
}

interface InvoicesMainProps {
  initialView?: 'list' | 'create' | 'edit'
  createFromSalesOrderId?: string | null
  openInvoiceId?: string | null
  onViewChange?: (view: 'list' | 'create' | 'edit') => void
}

export default function InvoicesMain({ 
  initialView = 'list', 
  createFromSalesOrderId = null,
  openInvoiceId = null,
  onViewChange
}: InvoicesMainProps) {
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'edit'>(initialView)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // URL parameter handling
  useEffect(() => {
    // Don't override edit mode if we have a selected invoice (user has saved and should stay in edit)
    if (currentView === 'edit' && selectedInvoice) {
      // Make sure the URL reflects the current state
      if (openInvoiceId !== selectedInvoice.id) {
        const url = new URL(window.location.href)
        url.searchParams.set('open', selectedInvoice.id)
        url.searchParams.delete('createFromSalesOrder')
        window.history.replaceState({}, '', url.toString())
      }
      return
    }
    
    if (openInvoiceId) {
      // Find and open specific invoice for editing
      const targetInvoice = invoices.find(inv => inv.id === openInvoiceId)
      if (targetInvoice) {
        setSelectedInvoice(targetInvoice)
        setCurrentView('edit')
      }
    } else if (createFromSalesOrderId && currentView !== 'edit') {
      setCurrentView('create')
    } else if (!openInvoiceId && !createFromSalesOrderId && currentView !== 'create') {
      // Only reset to list if we're not in create mode
      // This prevents resetting when user is creating a new invoice
      setCurrentView('list')
      setSelectedInvoice(null)
    }
  }, [openInvoiceId, createFromSalesOrderId, invoices, currentView, selectedInvoice])

  // Fetch invoices
  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (company_name, contact_name),
          sales_reps (first_name, last_name, employee_code)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      console.log('Fetched invoices count:', data?.length || 0)
      setInvoices(data || [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateInvoice = () => {
    // Clear any selected invoice to ensure clean state
    setSelectedInvoice(null)
    setCurrentView('create')
    // Notify parent component of view change
    onViewChange?.('create')
  }

  const handleSaveInvoice = (invoice: Invoice) => {
    // Check if this is a new invoice or an existing one
    const existingInvoice = invoices.find(inv => inv.id === invoice.id)
    
    if (existingInvoice) {
      // Update existing invoice in state
      setInvoices(prev => prev.map(inv => 
        inv.id === invoice.id ? { ...invoice, customers: existingInvoice.customers } : inv
      ))
      // Stay in edit mode for existing invoices
      setSelectedInvoice(invoice)
    } else {
      // Add new invoice to state
      setInvoices(prev => [invoice, ...prev])
      // Switch from create to edit for new invoices - this must happen BEFORE notifying parent
      setSelectedInvoice(invoice)
      setCurrentView('edit')
      
      // Update URL to include the invoice ID so the effect doesn't reset the view
      const url = new URL(window.location.href)
      url.searchParams.set('open', invoice.id)
      // Remove createFromSalesOrder if it exists
      url.searchParams.delete('createFromSalesOrder')
      window.history.replaceState({}, '', url.toString())
      
      // Important: Notify parent component AFTER setting local state
      // This prevents the page-level effect from overriding our edit mode
      onViewChange?.('edit')
    }
  }

  const handleCancel = () => {
    setCurrentView('list')
    setSelectedInvoice(null)
    // Notify parent component of view change
    onViewChange?.('list')
  }

  const handleDeleteInvoice = (invoice: Invoice) => {
    setInvoices(prev => prev.filter(inv => inv.id !== invoice.id))
    setCurrentView('list')
    setSelectedInvoice(null)
    // Notify parent component of view change
    onViewChange?.('list')
  }

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setCurrentView('edit')
  }

  const handleNavigateFromEdit = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    // Stay in edit view when navigating between invoices
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading invoices...</div>
      </div>
    )
  }

  if (currentView === 'create') {
    const key = `create-${createFromSalesOrderId || 'new'}`
    
    return (
      <CreateInvoiceQuickBooksStyle
        key={key}
        onSave={handleSaveInvoice}
        onCancel={handleCancel}
        createFromSalesOrderId={createFromSalesOrderId}
      />
    )
  }

  if (currentView === 'edit' && selectedInvoice) {
    return (
      <EditInvoiceQuickBooksStyle
        key={`edit-${selectedInvoice.id}`}
        invoice={selectedInvoice}
        onSave={handleSaveInvoice}
        onCancel={handleCancel}
        onDelete={handleDeleteInvoice}
        invoices={invoices}
        onNavigate={handleNavigateFromEdit}
      />
    )
  }

  return (
    <InvoicesList
      invoices={invoices}
      onCreateInvoice={handleCreateInvoice}
      onEditInvoice={handleEditInvoice}
      onDeleteInvoice={handleDeleteInvoice}
      onRefresh={fetchInvoices}
    />
  )
}