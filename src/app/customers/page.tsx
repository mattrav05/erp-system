'use client'

import AppLayout from '@/components/layout/app-layout'
import CustomersList from '@/components/customers/customers-list'

export default function CustomersPage() {
  return (
    <AppLayout>
      <CustomersList />
    </AppLayout>
  )
}