'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { AlertTriangle, Shield, Users, Eye, Edit, Trash2, Plus, Settings, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  PermissionCategory,
  PermissionAction,
  UserRole,
  DataScope,
  UserPermission
} from '@/lib/permissions'
import { AdminPermissionGate, ManagerPermissionGate } from '@/components/PermissionGate'
import { useCurrentUser } from '@/hooks/usePermissions'

interface User {
  id: string
  email: string
  role: UserRole
  full_name?: string
  created_at: string
  last_sign_in_at?: string
}

interface RolePermission {
  id: string
  role: UserRole
  category: PermissionCategory
  action: PermissionAction
  scope: DataScope
  is_allowed: boolean
  approval_limit?: number
}

interface UserOverride {
  id: string
  user_id: string
  category: PermissionCategory
  action: PermissionAction
  scope: DataScope
  is_allowed: boolean
  approval_limit?: number
  notes?: string
}

interface SecurityAuditEntry {
  id: string
  user_id: string
  action: string
  resource_type: string
  was_allowed: boolean
  denial_reason?: string
  created_at: string
  profiles?: { full_name?: string; email: string } | null
}

export default function SecuritySettings() {
  const { user: currentUser } = useCurrentUser()
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<User[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [userOverrides, setUserOverrides] = useState<UserOverride[]>([])
  const [auditLog, setAuditLog] = useState<SecurityAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<UserRole>('user')

  // Form states
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<UserRole>('user')
  const [editingPermission, setEditingPermission] = useState<string | null>(null)

  useEffect(() => {
    loadSecurityData()
  }, [])

  const loadSecurityData = async () => {
    setLoading(true)
    try {
      // Load users with their profiles
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, email, role, full_name, created_at, last_sign_in_at')
        .order('created_at', { ascending: false })

      // Load role permissions
      const { data: rolePermissionsData } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role', { ascending: true })

      // Load user-specific overrides
      const { data: overridesData } = await supabase
        .from('user_permission_overrides')
        .select('*')
        .order('created_at', { ascending: false })

      // Load recent security audit log
      const { data: auditData } = await supabase
        .from('security_audit_log')
        .select(`
          id,
          user_id,
          action,
          resource_type,
          was_allowed,
          denial_reason,
          created_at,
          profiles(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      setUsers(usersData || [])
      setRolePermissions(rolePermissionsData || [])
      setUserOverrides(overridesData || [])
      setAuditLog((auditData as SecurityAuditEntry[]) || [])
    } catch (error) {
      console.error('Error loading security data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, role: newRole } : user
      ))
    } catch (error) {
      console.error('Error updating user role:', error)
      alert('Failed to update user role')
    }
  }

  const createUserOverride = async (
    userId: string,
    category: PermissionCategory,
    action: PermissionAction,
    isAllowed: boolean,
    scope: DataScope = 'own',
    approvalLimit?: number,
    notes?: string
  ) => {
    try {
      const { error } = await supabase
        .from('user_permission_overrides')
        .insert({
          user_id: userId,
          category,
          action,
          is_allowed: isAllowed,
          scope,
          approval_limit: approvalLimit,
          notes,
          created_by: currentUser?.id
        })

      if (error) throw error

      loadSecurityData() // Reload to get the new override
    } catch (error) {
      console.error('Error creating user override:', error)
      alert('Failed to create permission override')
    }
  }

  const deleteUserOverride = async (overrideId: string) => {
    try {
      const { error } = await supabase
        .from('user_permission_overrides')
        .delete()
        .eq('id', overrideId)

      if (error) throw error

      setUserOverrides(prev => prev.filter(override => override.id !== overrideId))
    } catch (error) {
      console.error('Error deleting user override:', error)
      alert('Failed to delete permission override')
    }
  }

  const roleDisplayNames: Record<UserRole, string> = {
    admin: 'System Administrator',
    manager: 'General Manager',
    sales_manager: 'Sales Manager',
    inventory_manager: 'Inventory Manager',
    sales_rep: 'Sales Representative',
    accountant: 'Accountant',
    purchasing_agent: 'Purchasing Agent',
    user: 'Standard User',
    viewer: 'View Only'
  }

  const categoryDisplayNames: Record<PermissionCategory, string> = {
    sales: 'Sales & Estimates',
    inventory: 'Inventory Management',
    purchasing: 'Purchase Orders',
    accounting: 'Accounting & Finance',
    shipping: 'Shipping & Receiving',
    administration: 'User Management',
    reports: 'Reports & Analytics'
  }

  const actionDisplayNames: Record<PermissionAction, string> = {
    create: 'Create New',
    read: 'View/Read',
    update: 'Edit/Update',
    delete: 'Delete',
    approve: 'Approve',
    export: 'Export/Print',
    manage_users: 'Manage Users',
    view_costs: 'View Cost Prices',
    unlimited_discounts: 'Unlimited Discounts',
    view_all_territories: 'View All Territories'
  }

  const scopeDisplayNames: Record<DataScope, string> = {
    own: 'Own Records Only',
    territory: 'Territory/Department',
    department: 'Department Level',
    company: 'All Company Data'
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <AdminPermissionGate fallback={
      <div className="p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-600">Only system administrators can access security settings.</p>
      </div>
    }>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Security & Permissions</h1>
            <p className="text-gray-600">Manage user roles, permissions, and access controls</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">Users & Roles</TabsTrigger>
            <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
            <TabsTrigger value="overrides">User Overrides</TabsTrigger>
            <TabsTrigger value="audit">Security Audit</TabsTrigger>
          </TabsList>

          {/* Users & Roles Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">User</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Role</th>
                        <th className="text-left p-2">Last Sign In</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <div>
                              <div className="font-medium">{user.full_name || 'No name'}</div>
                              <div className="text-sm text-gray-500">{user.id.slice(0, 8)}...</div>
                            </div>
                          </td>
                          <td className="p-2">{user.email}</td>
                          <td className="p-2">
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {roleDisplayNames[user.role]}
                            </Badge>
                          </td>
                          <td className="p-2 text-sm text-gray-500">
                            {user.last_sign_in_at
                              ? new Date(user.last_sign_in_at).toLocaleDateString()
                              : 'Never'
                            }
                          </td>
                          <td className="p-2">
                            <Select
                              value={user.role}
                              onValueChange={(newRole: UserRole) => updateUserRole(user.id, newRole)}
                              disabled={user.id === currentUser?.id} // Can't change own role
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(roleDisplayNames).map(([role, displayName]) => (
                                  <SelectItem key={role} value={role}>
                                    {displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Role Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Role-Based Permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a role to view permissions" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleDisplayNames).map(([role, displayName]) => (
                        <SelectItem key={role} value={role}>
                          {displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="grid gap-4">
                    {Object.entries(categoryDisplayNames).map(([category, displayName]) => {
                      const categoryPermissions = rolePermissions.filter(
                        p => p.role === selectedRole && p.category === category
                      )

                      if (categoryPermissions.length === 0) return null

                      return (
                        <Card key={category} className="border border-gray-200">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">{displayName}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid gap-2">
                              {categoryPermissions.map(permission => (
                                <div
                                  key={`${permission.role}-${permission.category}-${permission.action}`}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                                >
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {actionDisplayNames[permission.action]}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Scope: {scopeDisplayNames[permission.scope]}
                                      {permission.approval_limit && (
                                        <span className="ml-2">
                                          • Limit: ${permission.approval_limit.toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant={permission.is_allowed ? 'default' : 'destructive'}>
                                    {permission.is_allowed ? 'Allowed' : 'Denied'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Overrides Tab */}
          <TabsContent value="overrides" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit className="w-5 h-5" />
                  User-Specific Permission Overrides
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userOverrides.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No permission overrides configured
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userOverrides.map(override => {
                        const user = users.find(u => u.id === override.user_id)
                        return (
                          <div
                            key={override.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="font-medium">
                                {user?.full_name || user?.email || 'Unknown User'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {categoryDisplayNames[override.category]} •{' '}
                                {actionDisplayNames[override.action]} •{' '}
                                {scopeDisplayNames[override.scope]}
                                {override.approval_limit && (
                                  <span className="ml-2">
                                    • Limit: ${override.approval_limit.toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {override.notes && (
                                <div className="text-xs text-gray-400 mt-1">
                                  Note: {override.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={override.is_allowed ? 'default' : 'destructive'}>
                                {override.is_allowed ? 'Allow' : 'Deny'}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteUserOverride(override.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Audit Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Security Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditLog.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No audit log entries
                    </div>
                  ) : (
                    auditLog.map(entry => (
                      <div
                        key={entry.id}
                        className={`p-3 rounded border-l-4 ${
                          entry.was_allowed
                            ? 'border-l-green-400 bg-green-50'
                            : 'border-l-red-400 bg-red-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {entry.profiles?.full_name || entry.profiles?.email || 'Unknown User'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {entry.action} • {entry.resource_type}
                              {entry.denial_reason && (
                                <span className="text-red-600 ml-2">
                                  • {entry.denial_reason}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(entry.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminPermissionGate>
  )
}