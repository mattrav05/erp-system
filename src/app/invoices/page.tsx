'use client'

import AppLayout from '@/components/layout/app-layout'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import InvoicesMain from '@/components/invoices/invoices-main'

function InvoicesPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [initialView, setInitialView] = useState<'list' | 'create' | 'edit'>('list')
  const [createFromSalesOrderId, setCreateFromSalesOrderId] = useState<string | null>(null)
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null)

  useEffect(() => {
    // Clear any persisted form state on page load
    if (typeof window !== 'undefined') {
      // Clear session storage for invoices
      const sessionKeys = Object.keys(window.sessionStorage).filter(key => 
        key.includes('invoice') || key.includes('create') || key.includes('form'))
      sessionKeys.forEach(key => window.sessionStorage.removeItem(key))
      
      // Clear local storage for invoices 
      const localKeys = Object.keys(window.localStorage).filter(key => 
        key.includes('invoice') || key.includes('create') || key.includes('form'))
      localKeys.forEach(key => window.localStorage.removeItem(key))
    }

    // Handle URL parameters
    const createFromSO = searchParams.get('create_from_so')
    const openInvoice = searchParams.get('open')

    if (createFromSO) {
      setCreateFromSalesOrderId(createFromSO)
      setInitialView('create')
    } else if (openInvoice) {
      setOpenInvoiceId(openInvoice)
      setInitialView('edit')
    } else {
      setInitialView('list')
      // Clear any lingering URL parameters
      if (searchParams.get('create_from_so') || searchParams.get('open')) {
        router.replace(pathname, { scroll: false })
      }
    }
  }, [searchParams, router, pathname])

  const handleViewChange = (view: 'list' | 'create' | 'edit') => {
    // Clear URL parameters when navigating programmatically
    if (view === 'list' || view === 'create') {
      router.replace(pathname, { scroll: false })
    }
    
    // Update the initial view state
    setInitialView(view)
    
    // Clear URL-based state when switching to different modes
    if (view === 'create') {
      setCreateFromSalesOrderId(null)
      setOpenInvoiceId(null)
    } else if (view === 'list') {
      setCreateFromSalesOrderId(null)
      setOpenInvoiceId(null)
    }
    // Don't clear openInvoiceId for edit mode - let the component manage it
  }

  return (
    <InvoicesMain
      initialView={initialView}
      createFromSalesOrderId={createFromSalesOrderId}
      openInvoiceId={openInvoiceId}
      onViewChange={handleViewChange}
    />
  )
}

export default function InvoicesPage() {
  return (
    <AppLayout>
        <InvoicesPageContent />
      </AppLayout>
  )
}

// Prevent Next.js from caching this page
export const dynamic = 'force-dynamic'