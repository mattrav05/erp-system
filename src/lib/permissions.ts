// Permission system utilities and types
import { supabase } from '@/lib/supabase'

export type PermissionCategory =
  | 'sales'
  | 'inventory'
  | 'purchasing'
  | 'accounting'
  | 'shipping'
  | 'administration'
  | 'reports'

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'export'
  | 'manage_users'
  | 'view_costs'
  | 'unlimited_discounts'
  | 'view_all_territories'

export type DataScope =
  | 'own'
  | 'territory'
  | 'department'
  | 'company'

export type UserRole =
  | 'admin'
  | 'manager'
  | 'user'
  | 'sales_rep'
  | 'sales_manager'
  | 'inventory_manager'
  | 'accountant'
  | 'purchasing_agent'
  | 'viewer'

export interface PermissionCheck {
  category: PermissionCategory
  action: PermissionAction
  resourceOwnerId?: string
}

export interface UserPermission {
  id: string
  role: UserRole
  category: PermissionCategory
  action: PermissionAction
  scope: DataScope
  isAllowed: boolean
  approvalLimit?: number
}

export interface SecurityAuditLog {
  userId: string
  action: string
  resourceType: string
  resourceId?: string
  permissionCategory: PermissionCategory
  permissionAction: PermissionAction
  wasAllowed: boolean
  denialReason?: string
}

/**
 * Check if the current user has permission to perform an action
 */
export async function checkUserPermission(
  category: PermissionCategory,
  action: PermissionAction,
  resourceOwnerId?: string
): Promise<boolean> {

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  try {
    // Call the database function to check permissions
    const { data, error } = await supabase.rpc('check_user_permission', {
      p_user_id: user.id,
      p_category: category,
      p_action: action,
      p_resource_owner_id: resourceOwnerId || null
    })

    if (error) {
      console.error('Permission check error:', error)
      // Log the security audit event
      await logSecurityAudit({
        userId: user.id,
        action: `permission_check_${action}`,
        resourceType: category,
        resourceId: resourceOwnerId,
        permissionCategory: category,
        permissionAction: action,
        wasAllowed: false,
        denialReason: error.message
      })
      return false
    }

    // Log successful permission check
    await logSecurityAudit({
      userId: user.id,
      action: `permission_check_${action}`,
      resourceType: category,
      resourceId: resourceOwnerId,
      permissionCategory: category,
      permissionAction: action,
      wasAllowed: data
    })

    return data === true
  } catch (error) {
    console.error('Permission check failed:', error)
    return false
  }
}

/**
 * Check multiple permissions at once
 */
export async function checkMultiplePermissions(
  permissions: PermissionCheck[]
): Promise<{ [key: string]: boolean }> {
  const results: { [key: string]: boolean } = {}

  for (const permission of permissions) {
    const key = `${permission.category}:${permission.action}`
    results[key] = await checkUserPermission(
      permission.category,
      permission.action,
      permission.resourceOwnerId
    )
  }

  return results
}

/**
 * Log security audit events
 */
export async function logSecurityAudit(audit: SecurityAuditLog): Promise<void> {

  try {
    const { error } = await supabase.rpc('log_security_audit', {
      p_user_id: audit.userId,
      p_action: audit.action,
      p_resource_type: audit.resourceType,
      p_resource_id: audit.resourceId || null,
      p_category: audit.permissionCategory,
      p_permission_action: audit.permissionAction,
      p_was_allowed: audit.wasAllowed,
      p_denial_reason: audit.denialReason || null
    })

    if (error) {
      console.error('Failed to log security audit:', error)
    }
  } catch (error) {
    console.error('Security audit logging failed:', error)
  }
}

/**
 * Get user's effective permissions for a category
 */
export async function getUserPermissions(
  category: PermissionCategory
): Promise<UserPermission[]> {

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get user's role-based permissions
  const { data: rolePermissions } = await supabase
    .from('role_permissions')
    .select(`
      id,
      role,
      category,
      action,
      scope,
      is_allowed,
      approval_limit
    `)
    .eq('category', category)
    .single()

  // Get user-specific overrides
  const { data: overrides } = await supabase
    .from('user_permission_overrides')
    .select(`
      category,
      action,
      scope,
      is_allowed,
      approval_limit
    `)
    .eq('user_id', user.id)
    .eq('category', category)

  // Combine and return effective permissions
  // Overrides take precedence over role permissions
  const permissions: UserPermission[] = []

  if (rolePermissions) {
    permissions.push({
      id: rolePermissions.id,
      role: rolePermissions.role,
      category: rolePermissions.category,
      action: rolePermissions.action,
      scope: rolePermissions.scope,
      isAllowed: rolePermissions.is_allowed,
      approvalLimit: rolePermissions.approval_limit
    })
  }

  // Apply overrides
  if (overrides) {
    overrides.forEach(override => {
      const existingIndex = permissions.findIndex(p => p.action === override.action)
      if (existingIndex >= 0) {
        permissions[existingIndex].isAllowed = override.is_allowed
        permissions[existingIndex].scope = override.scope
        permissions[existingIndex].approvalLimit = override.approval_limit
      }
    })
  }

  return permissions
}

/**
 * Get current user's role and basic info
 */
export async function getCurrentUserInfo(): Promise<{
  id: string
  role: UserRole
  salesRepId?: string
  territories?: string[]
} | null> {

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // Check if user is a sales rep
  const { data: salesRep } = await supabase
    .from('sales_reps')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  // Get user territories
  const { data: territories } = await supabase
    .from('user_territories')
    .select('territory_name')
    .eq('user_id', user.id)

  return {
    id: user.id,
    role: profile.role,
    salesRepId: salesRep?.id,
    territories: territories?.map(t => t.territory_name) || []
  }
}

/**
 * Permission-based data filtering helpers
 */
export class PermissionFilters {
  /**
   * Get sales data filter based on user permissions
   */
  static async getSalesDataFilter(): Promise<{
    canViewAll: boolean
    salesRepFilter?: string
    territoryFilter?: string[]
  }> {
    const canViewAll = await checkUserPermission('sales', 'read')
    const userInfo = await getCurrentUserInfo()

    if (!userInfo) {
      return { canViewAll: false }
    }

    // Admins and managers can see all
    if (['admin', 'manager', 'sales_manager'].includes(userInfo.role)) {
      return { canViewAll: true }
    }

    // Sales reps see only their data
    if (userInfo.role === 'sales_rep' && userInfo.salesRepId) {
      return {
        canViewAll: false,
        salesRepFilter: userInfo.salesRepId
      }
    }

    // Territory-based filtering
    if (userInfo.territories && userInfo.territories.length > 0) {
      return {
        canViewAll: false,
        territoryFilter: userInfo.territories
      }
    }

    return { canViewAll: false }
  }

  /**
   * Check if user can see cost prices
   */
  static async canViewCosts(): Promise<boolean> {
    return await checkUserPermission('inventory', 'view_costs')
  }

  /**
   * Check if user can apply unlimited discounts
   */
  static async canApplyUnlimitedDiscounts(): Promise<boolean> {
    return await checkUserPermission('sales', 'unlimited_discounts')
  }
}

/**
 * Route-based permission checking
 */
export const RoutePermissions = {
  // Sales routes
  '/estimates': { category: 'sales' as PermissionCategory, action: 'read' as PermissionAction },
  '/estimates/new': { category: 'sales' as PermissionCategory, action: 'create' as PermissionAction },
  '/sales-orders': { category: 'sales' as PermissionCategory, action: 'read' as PermissionAction },
  '/customers': { category: 'sales' as PermissionCategory, action: 'read' as PermissionAction },

  // Inventory routes
  '/inventory': { category: 'inventory' as PermissionCategory, action: 'read' as PermissionAction },
  '/inventory/adjustments': { category: 'inventory' as PermissionCategory, action: 'update' as PermissionAction },
  '/products': { category: 'inventory' as PermissionCategory, action: 'read' as PermissionAction },

  // Purchasing routes
  '/purchase-orders': { category: 'purchasing' as PermissionCategory, action: 'read' as PermissionAction },
  '/vendors': { category: 'purchasing' as PermissionCategory, action: 'read' as PermissionAction },

  // Accounting routes
  '/invoices': { category: 'accounting' as PermissionCategory, action: 'read' as PermissionAction },

  // Admin routes
  '/settings': { category: 'administration' as PermissionCategory, action: 'read' as PermissionAction },
  '/settings/users': { category: 'administration' as PermissionCategory, action: 'manage_users' as PermissionAction },

  // Reports
  '/reports': { category: 'reports' as PermissionCategory, action: 'read' as PermissionAction }
} as const