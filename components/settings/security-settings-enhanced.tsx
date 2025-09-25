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
import { AlertTriangle, Shield, Users, Eye, Edit, Trash2, Plus, Settings, Clock, Save, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  PermissionCategory,
  PermissionAction,
  UserRole,
  DataScope,
  UserPermission
} from '@/lib/permissions'
import { AdminPermissionGate } from '@/components/PermissionGate'
import { useCurrentUser } from '@/hooks/usePermissions'

interface User {
  id: string
  email: string
  role: UserRole
  first_name?: string
  last_name?: string
  created_at: string
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
  profiles?: {
    first_name?: string
    last_name?: string
    email: string
  }
}

export default function EnhancedSecuritySettings() {
  const { user: currentUser } = useCurrentUser()
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<User[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [userOverrides, setUserOverrides] = useState<UserOverride[]>([])
  const [auditLog, setAuditLog] = useState<SecurityAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<UserRole>('user')

  // Editing states
  const [editingPermission, setEditingPermission] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<{
    is_allowed: boolean
    scope: DataScope
    approval_limit?: number
  }>({ is_allowed: false, scope: 'own' })

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

  useEffect(() => {
    loadSecurityData()
  }, [])

  const loadSecurityData = async () => {
    setLoading(true)
    try {
      // Load users with proper profile data
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, email, role, first_name, last_name, created_at')
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

      // Load security audit log with user profile joins
      const { data: auditData } = await supabase
        .from('security_audit_log')
        .select(`
          id,
          user_id,
          action,
          resource_type,
          was_allowed,
          denial_reason,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      // Fetch user profiles separately for audit log
      if (auditData) {
        const userIds = [...new Set(auditData.map(a => a.user_id))]
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', userIds)

        // Map profiles to audit entries
        const auditWithProfiles = auditData.map(entry => {
          const profile = profilesData?.find(p => p.id === entry.user_id)
          return {
            ...entry,
            profiles: profile || { email: 'Unknown', first_name: null, last_name: null }
          }
        })
        setAuditLog(auditWithProfiles)
      }

      setUsers(usersData || [])
      setRolePermissions(rolePermissionsData || [])
      setUserOverrides(overridesData || [])
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

  const updateRolePermission = async (permissionId: string, updates: Partial<RolePermission>) => {
    try {
      const { error } = await supabase
        .from('role_permissions')
        .update(updates)
        .eq('id', permissionId)

      if (error) throw error

      setRolePermissions(prev => prev.map(perm =>
        perm.id === permissionId ? { ...perm, ...updates } : perm
      ))

      setEditingPermission(null)
    } catch (error) {
      console.error('Error updating permission:', error)
      alert('Failed to update permission')
    }
  }

  const startEditingPermission = (permissionId: string, permission: RolePermission) => {
    setEditingPermission(permissionId)
    setEditingValues({
      is_allowed: permission.is_allowed,
      scope: permission.scope,
      approval_limit: permission.approval_limit
    })
  }

  const cancelEditing = () => {
    setEditingPermission(null)
    setEditingValues({ is_allowed: false, scope: 'own' })
  }

  const savePermissionEdit = async (permissionId: string) => {
    await updateRolePermission(permissionId, editingValues)
  }

  const getUserDisplayName = (user: User | undefined) => {
    if (!user) return 'Unknown User'
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim()
    return name || user.email
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
                        <th className="text-left p-2">Created</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <div>
                              <div className="font-medium">{getUserDisplayName(user)}</div>
                              <div className="text-sm text-gray-500">{user.id.slice(0, 8)}...</div>
                            </div>
                          </td>
                          <td className="p-2">{user.email}</td>
                          <td className="p-2">
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {roleDisplayNames[user.role] || user.role || 'Unknown'}
                            </Badge>
                          </td>
                          <td className="p-2 text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-2">
                            <Select
                              value={user.role}
                              onValueChange={(value: string) => updateUserRole(user.id, value as UserRole)}
                              disabled={user.id === currentUser?.id}
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
                  <Select value={selectedRole} onValueChange={(value: string) => setSelectedRole(value as UserRole)}>
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
                              {categoryPermissions.map(permission => {
                                const isEditing = editingPermission === permission.id
                                return (
                                  <div
                                    key={permission.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded"
                                  >
                                    {isEditing ? (
                                      <>
                                        <div className="flex-1 space-y-2">
                                          <div className="font-medium">
                                            {actionDisplayNames[permission.action]}
                                          </div>
                                          <div className="flex items-center gap-4">
                                            <Label className="flex items-center gap-2">
                                              <Switch
                                                checked={editingValues.is_allowed}
                                                onCheckedChange={(checked) =>
                                                  setEditingValues(prev => ({ ...prev, is_allowed: checked }))
                                                }
                                              />
                                              <span>{editingValues.is_allowed ? 'Allowed' : 'Denied'}</span>
                                            </Label>
                                            <Select
                                              value={editingValues.scope}
                                              onValueChange={(value: DataScope) =>
                                                setEditingValues(prev => ({ ...prev, scope: value }))
                                              }
                                            >
                                              <SelectTrigger className="w-40">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {Object.entries(scopeDisplayNames).map(([scope, name]) => (
                                                  <SelectItem key={scope} value={scope}>
                                                    {name}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                            <Input
                                              type="number"
                                              placeholder="Approval limit"
                                              className="w-32"
                                              value={editingValues.approval_limit || ''}
                                              onChange={(e) =>
                                                setEditingValues(prev => ({
                                                  ...prev,
                                                  approval_limit: e.target.value ? Number(e.target.value) : undefined
                                                }))
                                              }
                                            />
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => savePermissionEdit(permission.id)}
                                          >
                                            <Save className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={cancelEditing}
                                          >
                                            <X className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </>
                                    ) : (
                                      <>
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
                                        <div className="flex items-center gap-2">
                                          <Badge variant={permission.is_allowed ? 'default' : 'destructive'}>
                                            {permission.is_allowed ? 'Allowed' : 'Denied'}
                                          </Badge>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => startEditingPermission(permission.id, permission)}
                                          >
                                            <Edit className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )
                              })}
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
                  {auditLog.map(entry => (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-lg border ${
                        entry.was_allowed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {entry.profiles && (
                              `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() ||
                              entry.profiles.email ||
                              'Unknown User'
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {entry.action} • {entry.resource_type}
                            {entry.denial_reason && (
                              <span className="ml-2 text-red-600">
                                - {entry.denial_reason}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={entry.was_allowed ? 'default' : 'destructive'}>
                            {entry.was_allowed ? 'Allowed' : 'Denied'}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {new Date(entry.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminPermissionGate>
  )
}