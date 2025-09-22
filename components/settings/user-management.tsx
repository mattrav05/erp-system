'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Shield,
  User,
  Mail,
  Calendar,
  AlertTriangle,
  Check,
  X,
  Crown,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface UserProfile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  role: 'admin' | 'manager' | 'user'
  created_at: string
  updated_at: string
  last_sign_in_at?: string
}

interface SalesRep {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  commission_rate: number
  territory?: string
  hire_date?: string
  is_active: boolean
  notes?: string
  user_id?: string
}

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: (user: UserProfile) => void
}

function CreateUserModal({ isOpen, onClose, onUserCreated }: CreateUserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'user' as UserProfile['role'],
    isSalesRep: false,
    employeeCode: '',
    phone: '',
    commissionRate: 0,
    territory: '',
    hireDate: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [showPassword, setShowPassword] = useState(false)

  const validateForm = () => {
    const newErrors: string[] = []

    if (!formData.email) newErrors.push('Email is required')
    if (!formData.email.includes('@')) newErrors.push('Valid email is required')
    if (!formData.password) newErrors.push('Password is required')
    if (formData.password.length < 8) newErrors.push('Password must be at least 8 characters')
    if (formData.password !== formData.confirmPassword) newErrors.push('Passwords do not match')
    if (!formData.firstName) newErrors.push('First name is required')
    if (!formData.lastName) newErrors.push('Last name is required')

    // Sales rep specific validation
    if (formData.isSalesRep) {
      if (!formData.employeeCode) newErrors.push('Employee code is required for sales reps')
      if (formData.commissionRate < 0 || formData.commissionRate > 100) {
        newErrors.push('Commission rate must be between 0 and 100')
      }
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      // Create user via Supabase Auth Admin API
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          first_name: formData.firstName,
          last_name: formData.lastName
        }
      })

      if (authError) {
        setErrors([authError.message])
        return
      }

      if (authData.user) {
        // Create profile entry
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: formData.email,
            first_name: formData.firstName,
            last_name: formData.lastName,
            role: formData.role
          })
          .select()
          .single()

        if (profileError) {
          setErrors([profileError.message])
          return
        }

        // Create sales rep profile if user is marked as sales rep
        if (formData.isSalesRep) {
          try {
            const { error: salesRepError } = await supabase
              .from('sales_reps')
              .insert({
                employee_code: formData.employeeCode,
                first_name: formData.firstName,
                last_name: formData.lastName,
                email: formData.email,
                phone: formData.phone || null,
                commission_rate: formData.commissionRate,
                territory: formData.territory || null,
                hire_date: formData.hireDate || null,
                is_active: true,
                user_id: authData.user.id
              })

            if (salesRepError) {
              console.warn('Sales rep profile creation failed:', salesRepError)
              // Don't fail the entire user creation for this
            }
          } catch (error) {
            console.warn('Sales rep table may not exist yet:', error)
            // This is expected for new installations
          }
        }

        onUserCreated(profile)
        onClose()

        // Reset form
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          firstName: '',
          lastName: '',
          role: 'user',
          isSalesRep: false,
          employeeCode: '',
          phone: '',
          commissionRate: 0,
          territory: '',
          hireDate: ''
        })
      }
    } catch (error) {
      setErrors(['Failed to create user. Please try again.'])
      console.error('Error creating user:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New User
            </h2>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <ul className="space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Smith"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john.smith@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Minimum 8 characters"
                  required
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password *
              </label>
              <Input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm password"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserProfile['role'] }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="user">User - Basic access to assigned modules</option>
                <option value="manager">Manager - Can manage data and view reports</option>
                <option value="admin">Admin - Full system access and user management</option>
              </select>
            </div>

            {/* Sales Rep Assignment */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="isSalesRep"
                  checked={formData.isSalesRep}
                  onChange={(e) => setFormData(prev => ({ ...prev, isSalesRep: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isSalesRep" className="text-sm font-medium text-gray-700">
                  This user is a Sales Representative
                </label>
              </div>

              {formData.isSalesRep && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-100 bg-blue-50 p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Employee Code *
                      </label>
                      <Input
                        value={formData.employeeCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, employeeCode: e.target.value }))}
                        placeholder="EMP001"
                        required={formData.isSalesRep}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Commission Rate (%)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.commissionRate}
                        onChange={(e) => setFormData(prev => ({ ...prev, commissionRate: parseFloat(e.target.value) || 0 }))}
                        placeholder="5.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Territory
                      </label>
                      <Input
                        value={formData.territory}
                        onChange={(e) => setFormData(prev => ({ ...prev, territory: e.target.value }))}
                        placeholder="West Coast"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hire Date
                    </label>
                    <Input
                      type="date"
                      value={formData.hireDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, hireDate: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? 'Creating...' : 'Create User'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

interface EditUserModalProps {
  isOpen: boolean
  user: UserProfile | null
  onClose: () => void
  onUserUpdated: (user: UserProfile) => void
}

function EditUserModal({ isOpen, user, onClose, onUserUpdated }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    role: 'user' as UserProfile['role']
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        role: user.role
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    const newErrors: string[] = []
    if (!formData.firstName) newErrors.push('First name is required')
    if (!formData.lastName) newErrors.push('Last name is required')

    if (newErrors.length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          role: formData.role,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        setErrors([error.message])
        return
      }

      onUserUpdated(data)
      onClose()
    } catch (error) {
      setErrors(['Failed to update user. Please try again.'])
      console.error('Error updating user:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
              Edit User
            </h2>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <ul className="space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <Input
                value={user.email}
                disabled
                className="bg-gray-100 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserProfile['role'] }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="user">User - Basic access to assigned modules</option>
                <option value="manager">Manager - Can manage data and view reports</option>
                <option value="admin">Admin - Full system access and user management</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const { profile: currentUserProfile } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserProfile['role'] | 'all'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<UserProfile | null>(null)

  // Check if current user is admin
  const isCurrentUserAdmin = currentUserProfile?.role === 'admin'

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching users:', error)
        return
      }

      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUserCreated = (newUser: UserProfile) => {
    setUsers(prev => [newUser, ...prev])
    setShowCreateModal(false)
  }

  const handleUserUpdated = (updatedUser: UserProfile) => {
    setUsers(prev => prev.map(user =>
      user.id === updatedUser.id ? updatedUser : user
    ))
    setShowEditModal(false)
    setSelectedUser(null)
  }

  const handleDeleteUser = async (userToDelete: UserProfile) => {
    if (!isCurrentUserAdmin) return

    try {
      // Delete user from auth
      const { error: authError } = await supabase.auth.admin.deleteUser(userToDelete.id)

      if (authError) {
        console.error('Error deleting user from auth:', authError)
        return
      }

      // Profile will be deleted by database cascade
      setUsers(prev => prev.filter(user => user.id !== userToDelete.id))
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole = selectedRole === 'all' || user.role === selectedRole

    return matchesSearch && matchesRole
  })

  const getRoleBadge = (role: UserProfile['role']) => {
    const configs = {
      admin: { label: 'Admin', icon: Crown, color: 'bg-red-100 text-red-800' },
      manager: { label: 'Manager', icon: Settings, color: 'bg-yellow-100 text-yellow-800' },
      user: { label: 'User', icon: User, color: 'bg-green-100 text-green-800' }
    }

    const config = configs[role]
    const Icon = config.icon

    return (
      <Badge className={`${config.color} border-0 flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    )
  }

  if (!isCurrentUserAdmin) {
    return (
      <div className="p-6 text-center">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-600">You need administrator privileges to manage users.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">User Management</h2>
        <p className="text-gray-600">Manage user accounts, roles, and permissions</p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as UserProfile['role'] | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admins</option>
          <option value="manager">Managers</option>
          <option value="user">Users</option>
        </select>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading users...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery || selectedRole !== 'all' ? 'No users match your filters' : 'No users found'}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <Card key={user.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">
                            {user.first_name && user.last_name
                              ? `${user.first_name} ${user.last_name}`
                              : user.email
                            }
                          </h3>
                          {getRoleBadge(user.role)}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(user)
                          setShowEditModal(true)
                        }}
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>

                      {user.id !== currentUserProfile?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteConfirm(user)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Stats Summary */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{users.length}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {users.filter(u => u.role === 'admin').length}
            </div>
            <div className="text-sm text-gray-600">Admins</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {users.filter(u => u.role === 'manager').length}
            </div>
            <div className="text-sm text-gray-600">Managers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.role === 'user').length}
            </div>
            <div className="text-sm text-gray-600">Users</div>
          </CardContent>
        </Card>
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onUserCreated={handleUserCreated}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={showEditModal}
        user={selectedUser}
        onClose={() => {
          setShowEditModal(false)
          setSelectedUser(null)
        }}
        onUserUpdated={handleUserUpdated}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Delete User</h3>
                  <p className="text-gray-600">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-gray-700 mb-6">
                Are you sure you want to delete <strong>{deleteConfirm.first_name} {deleteConfirm.last_name}</strong>?
                This will permanently remove their account and all associated data.
              </p>

              <div className="flex gap-3">
                <Button
                  onClick={() => handleDeleteUser(deleteConfirm)}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete User
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}