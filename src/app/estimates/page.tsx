import AppLayout from '@/components/layout/app-layout'
import EstimatesList from '@/components/estimates/estimates-list'
import { RouteProtection } from '@/components/PermissionGate'

export default function EstimatesPage() {
  return (
    <AppLayout>
      <RouteProtection category="sales" action="read">
        <EstimatesList />
      </RouteProtection>
    </AppLayout>
  )
}