// React hooks for permission checking
import { useState, useEffect } from 'react'
import {
  PermissionCategory,
  PermissionAction,
  PermissionCheck,
  checkUserPermission,
  checkMultiplePermissions,
  getCurrentUserInfo,
  PermissionFilters,
  UserRole
} from '@/lib/permissions'

/**
 * Hook to check a single permission
 */
export function usePermission(
  category: PermissionCategory,
  action: PermissionAction,
  resourceOwnerId?: string
) {
  const [hasPermission, setHasPermission] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkPermission = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await checkUserPermission(category, action, resourceOwnerId)
        setHasPermission(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Permission check failed')
        setHasPermission(false)
      } finally {
        setLoading(false)
      }
    }

    checkPermission()
  }, [category, action, resourceOwnerId])

  return { hasPermission, loading, error }
}

/**
 * Hook to check multiple permissions at once
 */
export function useMultiplePermissions(permissions: PermissionCheck[]) {
  const [results, setResults] = useState<{ [key: string]: boolean }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await checkMultiplePermissions(permissions)
        setResults(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Permission check failed')
        setResults({})
      } finally {
        setLoading(false)
      }
    }

    if (permissions.length > 0) {
      checkPermissions()
    }
  }, [permissions])

  return { results, loading, error }
}

/**
 * Hook to get current user info and role
 */
export function useCurrentUser() {
  const [user, setUser] = useState<{
    id: string
    role: UserRole
    salesRepId?: string
    territories?: string[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const getUserInfo = async () => {
      try {
        setLoading(true)
        setError(null)
        const userInfo = await getCurrentUserInfo()
        setUser(userInfo)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get user info')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getUserInfo()
  }, [])

  return { user, loading, error }
}

/**
 * Hook for permission-based data filtering
 */
export function useDataFilters() {
  const [filters, setFilters] = useState({
    sales: {
      canViewAll: false,
      salesRepFilter: undefined as string | undefined,
      territoryFilter: undefined as string[] | undefined
    },
    canViewCosts: false,
    canApplyUnlimitedDiscounts: false
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getFilters = async () => {
      try {
        setLoading(true)

        const [salesFilter, canViewCosts, canApplyUnlimitedDiscounts] = await Promise.all([
          PermissionFilters.getSalesDataFilter(),
          PermissionFilters.canViewCosts(),
          PermissionFilters.canApplyUnlimitedDiscounts()
        ])

        setFilters({
          sales: {
            canViewAll: salesFilter.canViewAll,
            salesRepFilter: salesFilter.salesRepFilter,
            territoryFilter: salesFilter.territoryFilter
          },
          canViewCosts,
          canApplyUnlimitedDiscounts
        })
      } catch (err) {
        console.error('Failed to get data filters:', err)
      } finally {
        setLoading(false)
      }
    }

    getFilters()
  }, [])

  return { filters, loading }
}

/**
 * Hook for role-based UI rendering
 */
export function useRoleAccess() {
  const { user, loading } = useCurrentUser()

  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'manager' || user?.role === 'sales_manager' || user?.role === 'inventory_manager'
  const isSalesRep = user?.role === 'sales_rep'
  const isAccountant = user?.role === 'accountant'
  const isPurchasingAgent = user?.role === 'purchasing_agent'
  const isViewer = user?.role === 'viewer'

  const canManageUsers = isAdmin || isManager
  const canViewFinancials = isAdmin || isManager || isAccountant
  const canManageInventory = isAdmin || isManager || user?.role === 'inventory_manager'
  const canCreatePurchaseOrders = isAdmin || isManager || isPurchasingAgent || isSalesRep

  return {
    user,
    loading,
    isAdmin,
    isManager,
    isSalesRep,
    isAccountant,
    isPurchasingAgent,
    isViewer,
    canManageUsers,
    canViewFinancials,
    canManageInventory,
    canCreatePurchaseOrders
  }
}

/**
 * Hook for common CRUD permissions on a resource
 */
export function useCRUDPermissions(
  category: PermissionCategory,
  resourceOwnerId?: string
) {
  const permissions = [
    { category, action: 'create' as PermissionAction, resourceOwnerId },
    { category, action: 'read' as PermissionAction, resourceOwnerId },
    { category, action: 'update' as PermissionAction, resourceOwnerId },
    { category, action: 'delete' as PermissionAction, resourceOwnerId }
  ]

  const { results, loading, error } = useMultiplePermissions(permissions)

  return {
    canCreate: results[`${category}:create`] || false,
    canRead: results[`${category}:read`] || false,
    canUpdate: results[`${category}:update`] || false,
    canDelete: results[`${category}:delete`] || false,
    loading,
    error
  }
}

/**
 * Higher-order component for route protection
 */
export function useRouteProtection(requiredPermission: {
  category: PermissionCategory
  action: PermissionAction
}) {
  const { hasPermission, loading } = usePermission(
    requiredPermission.category,
    requiredPermission.action
  )

  return { hasAccess: hasPermission, loading }
}