'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, User, Phone, Mail, MapPin, DollarSign } from 'lucide-react'
import SubWindow from '@/components/ui/sub-window'
import ContextMenu from '@/components/ui/context-menu'
import DatabaseSetupBanner from '@/components/estimates/database-setup-banner'

type SalesRep = Database['public']['Tables']['sales_reps']['Row']

export default function SalesRepsSettings() {
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [filteredReps, setFilteredReps] = useState<SalesRep[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingRep, setEditingRep] = useState<SalesRep | null>(null)

  // Form state
  const [employeeCode, setEmployeeCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [commissionRate, setCommissionRate] = useState(0)
  const [territory, setTerritory] = useState('')
  const [hireDate, setHireDate] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showSetupBanner, setShowSetupBanner] = useState(false)

  useEffect(() => {
    fetchSalesReps()
  }, [])

  useEffect(() => {
    let filtered = salesReps

    if (searchTerm) {
      filtered = filtered.filter(rep =>
        rep.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.territory?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredReps(filtered)
  }, [salesReps, searchTerm])

  const fetchSalesReps = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_reps')
        .select('*')
        .order('first_name')

      if (error) {
        console.error('Error fetching sales reps:', error)
        // Check if it's a table not found error
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          console.info('Sales reps table not created yet - showing setup banner')
          setShowSetupBanner(true)
        }
        setSalesReps([])
      } else {
        setSalesReps(data || [])
        setShowSetupBanner(false)
      }
    } catch (error) {
      console.error('Error fetching sales reps:', error)
      setSalesReps([])
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setEmployeeCode('')
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setCommissionRate(0)
    setTerritory('')
    setHireDate('')
    setIsActive(true)
    setNotes('')
  }

  const loadRepToEdit = (rep: SalesRep) => {
    setEmployeeCode(rep.employee_code)
    setFirstName(rep.first_name)
    setLastName(rep.last_name)
    setEmail(rep.email)
    setPhone(rep.phone || '')
    setCommissionRate(rep.commission_rate)
    setTerritory(rep.territory || '')
    setHireDate(rep.hire_date || '')
    setIsActive(rep.is_active)
    setNotes(rep.notes || '')
    setEditingRep(rep)
  }

  const handleCreate = () => {
    resetForm()
    setIsCreateOpen(true)
  }

  const handleEdit = (rep: SalesRep) => {
    loadRepToEdit(rep)
    setIsCreateOpen(true)
  }

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !employeeCode.trim()) {
      alert('Please fill in all required fields')
      return
    }

    setIsSaving(true)

    try {
      const repData = {
        employee_code: employeeCode,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        commission_rate: commissionRate,
        territory: territory || null,
        hire_date: hireDate || null,
        is_active: isActive,
        notes: notes || null
      }

      let result: SalesRep
      if (editingRep) {
        // Update existing rep
        const { data, error } = await supabase
          .from('sales_reps')
          .update(repData)
          .eq('id', editingRep.id)
          .select()
          .single()

        if (error) throw error
        result = data as SalesRep

        setSalesReps(prev => prev.map(rep => 
          rep.id === editingRep.id ? result : rep
        ))
      } else {
        // Create new rep
        const { data, error } = await supabase
          .from('sales_reps')
          .insert(repData)
          .select()
          .single()

        if (error) throw error
        result = data as SalesRep

        setSalesReps(prev => [result, ...prev])
      }

      setIsCreateOpen(false)
      resetForm()
      setEditingRep(null)
    } catch (error) {
      console.error('Error saving sales rep:', error)
      alert('Failed to save sales rep. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (rep: SalesRep) => {
    if (!confirm(`Are you sure you want to delete ${rep.first_name} ${rep.last_name}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('sales_reps')
        .delete()
        .eq('id', rep.id)

      if (error) throw error

      setSalesReps(prev => prev.filter(r => r.id !== rep.id))
    } catch (error) {
      console.error('Error deleting sales rep:', error)
      alert('Failed to delete sales rep. Please try again.')
    }
  }

  const handleToggleActive = async (rep: SalesRep) => {
    try {
      const { data, error } = await supabase
        .from('sales_reps')
        .update({ is_active: !rep.is_active })
        .eq('id', rep.id)
        .select()
        .single()

      if (error) throw error

      setSalesReps(prev => prev.map(r => 
        r.id === rep.id ? data as SalesRep : r
      ))
    } catch (error) {
      console.error('Error toggling sales rep status:', error)
      alert('Failed to update sales rep status.')
    }
  }

  const formatCurrency = (rate: number) => {
    return `${rate.toFixed(2)}%`
  }

  const formatPhone = (phone: string | null) => {
    if (!phone) return 'N/A'
    // Simple phone formatting - you might want to enhance this
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Sales Representatives</h2>
          <p className="text-sm text-gray-600 mt-1">Manage sales team members, territories, and commission rates</p>
        </div>
        <Button 
          onClick={handleCreate}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Sales Rep
        </Button>
      </div>

      {/* Database Setup Banner */}
      {showSetupBanner && (
        <DatabaseSetupBanner tableName="sales_reps" feature="Sales Representatives" />
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search sales reps..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Sales Reps Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filteredReps.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sales reps found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm 
                ? 'No sales reps match your search criteria.'
                : 'Get started by adding your first sales representative.'
              }
            </p>
            {!searchTerm && (
              <Button onClick={handleCreate} size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Sales Rep
              </Button>
            )}
          </div>
        ) : (
          filteredReps.map((rep) => (
            <div key={rep.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow bg-white">
              <ContextMenu
                options={[
                  {
                    id: 'edit',
                    label: 'Edit',
                    icon: <Edit className="w-4 h-4" />,
                    onClick: () => handleEdit(rep)
                  },
                  {
                    id: 'toggle',
                    label: rep.is_active ? 'Deactivate' : 'Activate',
                    icon: <User className="w-4 h-4" />,
                    onClick: () => handleToggleActive(rep)
                  },
                  {
                    id: 'separator',
                    label: '',
                    onClick: () => {},
                    separator: true
                  },
                  {
                    id: 'delete',
                    label: 'Delete',
                    icon: <Trash2 className="w-4 h-4" />,
                    onClick: () => handleDelete(rep)
                  }
                ]}
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {rep.first_name} {rep.last_name}
                        </h3>
                        <Badge className={rep.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {rep.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 font-mono">
                        #{rep.employee_code}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(rep)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-600">{rep.email}</span>
                    </div>
                    {rep.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600">{formatPhone(rep.phone)}</span>
                      </div>
                    )}
                    {rep.territory && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600">{rep.territory}</span>
                      </div>
                    )}
                  </div>

                  {/* Commission & Stats */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-gray-400" />
                      <span className="text-sm font-medium">
                        {formatCurrency(rep.commission_rate)} commission
                      </span>
                    </div>
                    {rep.hire_date && (
                      <span className="text-xs text-gray-500">
                        Since {new Date(rep.hire_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </ContextMenu>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <SubWindow
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false)
          resetForm()
          setEditingRep(null)
        }}
        title={editingRep ? 'Edit Sales Representative' : 'Add Sales Representative'}
        width={600}
        height={700}
      >
        <div className="space-y-6 max-h-[60vh] overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee Code *
              </label>
              <Input
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                placeholder="e.g. SR001"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john.smith@company.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Commission Rate (%)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={commissionRate}
                onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                placeholder="5.50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Territory
              </label>
              <Input
                value={territory}
                onChange={(e) => setTerritory(e.target.value)}
                placeholder="e.g. Northeast, West Coast"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hire Date
              </label>
              <Input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this sales representative"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreateOpen(false)
                resetForm()
                setEditingRep(null)
              }} 
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? 'Saving...' : editingRep ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </SubWindow>
    </div>
  )
}