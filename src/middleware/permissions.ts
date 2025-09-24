// API route permission middleware
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { PermissionCategory, PermissionAction } from '@/lib/permissions'

export interface RoutePermission {
  category: PermissionCategory
  action: PermissionAction
}

/**
 * Middleware function to check permissions for API routes
 */
export async function withPermissions(
  handler: (req: NextRequest) => Promise<NextResponse>,
  permission: RoutePermission
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      
      // Get the user from the request
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Check user permission using the database function
      const { data: hasPermission, error: permissionError } = await supabase.rpc('check_user_permission', {
        p_user_id: user.id,
        p_category: permission.category,
        p_action: permission.action,
        p_resource_owner_id: null // Can be enhanced to extract from request params
      })

      if (permissionError) {
        console.error('Permission check error:', permissionError)
        return NextResponse.json(
          { error: 'Permission check failed' },
          { status: 500 }
        )
      }

      if (!hasPermission) {
        // Log the denied access attempt
        await supabase.rpc('log_security_audit', {
          p_user_id: user.id,
          p_action: `api_${permission.action}`,
          p_resource_type: permission.category,
          p_resource_id: null,
          p_category: permission.category,
          p_permission_action: permission.action,
          p_was_allowed: false,
          p_denial_reason: 'Insufficient permissions for API endpoint'
        })

        return NextResponse.json(
          { error: 'Forbidden - Insufficient permissions' },
          { status: 403 }
        )
      }

      // Log successful access
      await supabase.rpc('log_security_audit', {
        p_user_id: user.id,
        p_action: `api_${permission.action}`,
        p_resource_type: permission.category,
        p_resource_id: null,
        p_category: permission.category,
        p_permission_action: permission.action,
        p_was_allowed: true
      })

      // Permission check passed, execute the handler
      return handler(req)
    } catch (error) {
      console.error('Permission middleware error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Enhanced middleware that can check resource ownership
 */
export async function withResourcePermissions(
  handler: (req: NextRequest, context?: { user: any, resourceOwnerId?: string }) => Promise<NextResponse>,
  permission: RoutePermission,
  getResourceOwnerId?: (req: NextRequest) => Promise<string | null>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      
      // Get the user from the request
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Get resource owner ID if function provided
      let resourceOwnerId: string | null = null
      if (getResourceOwnerId) {
        resourceOwnerId = await getResourceOwnerId(req)
      }

      // Check user permission
      const { data: hasPermission, error: permissionError } = await supabase.rpc('check_user_permission', {
        p_user_id: user.id,
        p_category: permission.category,
        p_action: permission.action,
        p_resource_owner_id: resourceOwnerId
      })

      if (permissionError) {
        console.error('Permission check error:', permissionError)
        return NextResponse.json(
          { error: 'Permission check failed' },
          { status: 500 }
        )
      }

      if (!hasPermission) {
        await supabase.rpc('log_security_audit', {
          p_user_id: user.id,
          p_action: `api_${permission.action}`,
          p_resource_type: permission.category,
          p_resource_id: resourceOwnerId,
          p_category: permission.category,
          p_permission_action: permission.action,
          p_was_allowed: false,
          p_denial_reason: 'Insufficient permissions for resource access'
        })

        return NextResponse.json(
          { error: 'Forbidden - Insufficient permissions' },
          { status: 403 }
        )
      }

      // Log successful access
      await supabase.rpc('log_security_audit', {
        p_user_id: user.id,
        p_action: `api_${permission.action}`,
        p_resource_type: permission.category,
        p_resource_id: resourceOwnerId,
        p_category: permission.category,
        p_permission_action: permission.action,
        p_was_allowed: true
      })

      // Execute handler with context
      return handler(req, { user, resourceOwnerId: resourceOwnerId ?? undefined })
    } catch (error) {
      console.error('Permission middleware error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Predefined middleware functions for common routes
 */

// Sales routes
export const salesReadMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withPermissions(handler, { category: 'sales', action: 'read' })

export const salesCreateMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withPermissions(handler, { category: 'sales', action: 'create' })

export const salesUpdateMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withPermissions(handler, { category: 'sales', action: 'update' })

export const salesDeleteMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withPermissions(handler, { category: 'sales', action: 'delete' })

// Inventory routes
export const inventoryReadMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withPermissions(handler, { category: 'inventory', action: 'read' })

export const inventoryCreateMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withPermissions(handler, { category: 'inventory', action: 'create' })

export const inventoryUpdateMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withPermissions(handler, { category: 'inventory', action: 'update' })

// Purchasing routes
export const purchasingReadMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withPermissions(handler, { category: 'purchasing', action: 'read' })

export const purchasingCreateMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withPermissions(handler, { category: 'purchasing', action: 'create' })

// Admin routes
export const adminOnlyMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withPermissions(handler, { category: 'administration', action: 'manage_users' })

/**
 * Helper functions to extract resource ownership from requests
 */

// Extract sales rep ID from estimate/sales order
export async function getSalesRepFromEstimate(req: NextRequest): Promise<string | null> {
  try {
    const url = new URL(req.url)
    const estimateId = url.pathname.split('/').pop()

    if (!estimateId) return null

        const { data } = await supabase
      .from('estimates')
      .select('sales_rep_id')
      .eq('id', estimateId)
      .single()

    return data?.sales_rep_id || null
  } catch {
    return null
  }
}

// Extract resource owner from purchase order
export async function getPurchaseOrderOwner(req: NextRequest): Promise<string | null> {
  try {
    const url = new URL(req.url)
    const poId = url.pathname.split('/').pop()

    if (!poId) return null

        const { data } = await supabase
      .from('purchase_orders')
      .select('created_by')
      .eq('id', poId)
      .single()

    return data?.created_by || null
  } catch {
    return null
  }
}

/**
 * Rate limiting middleware with permission-based limits
 */
export async function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  baseLimitPerMinute: number = 60
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // This would integrate with a rate limiting service
    // Higher permission levels could get higher limits

        const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user role for rate limiting
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    let rateLimit = baseLimitPerMinute
    if (profile?.role === 'admin') {
      rateLimit = baseLimitPerMinute * 5
    } else if (['manager', 'sales_manager', 'inventory_manager'].includes(profile?.role)) {
      rateLimit = baseLimitPerMinute * 2
    }

    // Here you would implement actual rate limiting logic
    // with Redis or similar cache system

    return handler(req)
  }
}