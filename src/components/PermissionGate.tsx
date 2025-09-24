'use client'

import { ReactNode } from 'react'
import { usePermission, useRoleAccess } from '@/hooks/usePermissions'
import { PermissionCategory, PermissionAction, UserRole } from '@/lib/permissions'

interface PermissionGateProps {
  children: ReactNode
  fallback?: ReactNode
  // Permission-based access
  category?: PermissionCategory
  action?: PermissionAction
  resourceOwnerId?: string
  // Role-based access (alternative to permission-based)
  allowedRoles?: UserRole[]
  // Require all permissions or just one
  requireAll?: boolean
  // Loading state
  showLoadingState?: boolean
}

/**
 * Component that conditionally renders children based on user permissions
 *
 * Usage examples:
 *
 * // Permission-based
 * <PermissionGate category="sales" action="create">
 *   <CreateEstimateButton />
 * </PermissionGate>
 *
 * // Role-based
 * <PermissionGate allowedRoles={['admin', 'manager']}>
 *   <AdminPanel />
 * </PermissionGate>
 *
 * // With fallback
 * <PermissionGate category="inventory" action="view_costs" fallback={<div>Price hidden</div>}>
 *   <PriceDisplay />
 * </PermissionGate>
 */
export function PermissionGate({
  children,
  fallback = null,
  category,
  action,
  resourceOwnerId,
  allowedRoles,
  showLoadingState = false
}: PermissionGateProps) {
  const { user, loading: userLoading } = useRoleAccess()

  // Permission-based check
  const { hasPermission, loading: permissionLoading } = usePermission(
    category!,
    action!,
    resourceOwnerId
  )

  const loading = userLoading || permissionLoading

  // Show loading state if requested
  if (loading && showLoadingState) {
    return <div className="animate-pulse bg-gray-200 h-4 w-16 rounded"></div>
  }

  // Don't render anything while loading (unless showLoadingState is true)
  if (loading) {
    return null
  }

  // Role-based access check
  if (allowedRoles && user) {
    const hasRoleAccess = allowedRoles.includes(user.role)
    return hasRoleAccess ? <>{children}</> : <>{fallback}</>
  }

  // Permission-based access check
  if (category && action) {
    return hasPermission ? <>{children}</> : <>{fallback}</>
  }

  // No access control specified - render children by default
  return <>{children}</>
}

/**
 * Specialized permission gates for common use cases
 */

interface SalesPermissionGateProps {
  children: ReactNode
  action: PermissionAction
  resourceOwnerId?: string
  fallback?: ReactNode
}

export function SalesPermissionGate({ children, action, resourceOwnerId, fallback }: SalesPermissionGateProps) {
  return (
    <PermissionGate category="sales" action={action} resourceOwnerId={resourceOwnerId} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function InventoryPermissionGate({ children, action, resourceOwnerId, fallback }: SalesPermissionGateProps) {
  return (
    <PermissionGate category="inventory" action={action} resourceOwnerId={resourceOwnerId} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function PurchasingPermissionGate({ children, action, resourceOwnerId, fallback }: SalesPermissionGateProps) {
  return (
    <PermissionGate category="purchasing" action={action} resourceOwnerId={resourceOwnerId} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function AccountingPermissionGate({ children, action, resourceOwnerId, fallback }: SalesPermissionGateProps) {
  return (
    <PermissionGate category="accounting" action={action} resourceOwnerId={resourceOwnerId} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function AdminPermissionGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGate allowedRoles={['admin']} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function ManagerPermissionGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGate allowedRoles={['admin', 'manager', 'sales_manager', 'inventory_manager']} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

/**
 * Higher-order component for protecting entire pages/routes
 */
interface RouteProtectionProps {
  children: ReactNode
  category: PermissionCategory
  action: PermissionAction
  fallback?: ReactNode
  redirectTo?: string
}

export function RouteProtection({
  children,
  category,
  action,
  fallback = <div className="p-4 text-center text-red-600">Access denied. You don't have permission to view this page.</div>
}: RouteProtectionProps) {
  const { hasPermission, loading } = usePermission(category, action)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return hasPermission ? <>{children}</> : <>{fallback}</>
}

/**
 * Component to show cost prices conditionally
 */
interface CostDisplayProps {
  cost: number
  fallbackText?: string
  className?: string
}

export function CostDisplay({ cost, fallbackText = "Hidden", className }: CostDisplayProps) {
  return (
    <InventoryPermissionGate
      action="view_costs"
      fallback={<span className={className}>{fallbackText}</span>}
    >
      <span className={className}>${cost.toFixed(2)}</span>
    </InventoryPermissionGate>
  )
}

/**
 * Button that's only enabled if user has permission
 */
interface PermissionButtonProps {
  category: PermissionCategory
  action: PermissionAction
  resourceOwnerId?: string
  children: ReactNode
  onClick?: () => void
  className?: string
  disabledText?: string
}

export function PermissionButton({
  category,
  action,
  resourceOwnerId,
  children,
  onClick,
  className = "",
  disabledText = "No permission"
}: PermissionButtonProps) {
  const { hasPermission, loading } = usePermission(category, action, resourceOwnerId)

  if (loading) {
    return (
      <button disabled className={`${className} opacity-50 cursor-not-allowed`}>
        Loading...
      </button>
    )
  }

  if (!hasPermission) {
    return (
      <button
        disabled
        className={`${className} opacity-50 cursor-not-allowed`}
        title={disabledText}
      >
        {children}
      </button>
    )
  }

  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  )
}