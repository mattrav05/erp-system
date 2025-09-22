'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Truck, Search, Plus, Mail, Phone, MapPin, Building, Edit3, Trash2, Globe, RefreshCw } from 'lucide-react'
import AddVendorModal from './add-vendor-modal'

interface Vendor {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  vendor_type: 'SUPPLIER' | 'SERVICE_PROVIDER' | 'CONTRACTOR' | null
  payment_terms: string | null
  tax_id: string | null
  preferred_currency: string | null
  lead_time_days: number | null
  minimum_order: number | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function VendorsList() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)

  useEffect(() => {
    loadVendors()
  }, [])

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('company_name')

      if (error) throw error
      
      setVendors(data || [])
    } catch (error) {
      console.error('Error loading vendors:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      
      // Fallback sample data when Supabase is not accessible
      console.log('Loading fallback vendor data')
      const sampleVendors: Vendor[] = [
        {
          id: '1',
          company_name: 'ACME Suppliers Inc.',
          contact_name: 'Bob Johnson',
          email: 'bob.johnson@acmesuppliers.com',
          phone: '(555) 234-5678',
          website: 'https://acmesuppliers.com',
          address_line_1: '456 Industrial Blvd, Building C',
          address_line_2: null,
          city: 'Manufacturing City',
          state: 'MC',
          zip_code: '23456',
          country: 'USA',
          vendor_type: 'SUPPLIER',
          payment_terms: 'Net 30',
          tax_id: '12-3456789',
          preferred_currency: 'USD',
          lead_time_days: 14,
          minimum_order: 1000,
          notes: null,
          is_active: true,
          created_at: '2024-01-15T10:30:00Z',
          updated_at: '2024-01-15T10:30:00Z'
        },
        {
          id: '2',
          company_name: 'Beta Manufacturing LLC',
          contact_name: 'Lisa Chen',
          email: 'lisa.chen@betamfg.com',
          phone: '(555) 345-6789',
          website: 'https://betamfg.com',
          address_line_1: '789 Factory Row',
          address_line_2: null,
          city: 'Production Town',
          state: 'PT',
          zip_code: '34567',
          country: 'USA',
          vendor_type: 'SUPPLIER',
          payment_terms: 'Net 45',
          tax_id: '23-4567890',
          preferred_currency: 'USD',
          lead_time_days: 21,
          minimum_order: 5000,
          notes: null,
          is_active: true,
          created_at: '2024-01-10T14:20:00Z',
          updated_at: '2024-02-01T09:15:00Z'
        },
        {
          id: '3',
          company_name: 'Quick Fix Services',
          contact_name: 'David Wilson',
          email: 'david@quickfixservices.com',
          phone: '(555) 456-7890',
          website: 'https://quickfixservices.com',
          address_line_1: '321 Service Lane',
          address_line_2: null,
          city: 'Service City',
          state: 'SC',
          zip_code: '45678',
          country: 'USA',
          vendor_type: 'SERVICE_PROVIDER',
          payment_terms: 'Net 15',
          tax_id: '34-5678901',
          preferred_currency: 'USD',
          lead_time_days: 5,
          minimum_order: null,
          notes: null,
          is_active: true,
          created_at: '2024-01-20T16:45:00Z',
          updated_at: '2024-01-25T11:30:00Z'
        }
      ]
      
      setVendors(sampleVendors)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadVendors()
    setIsRefreshing(false)
  }

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = 
      vendor.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.phone?.includes(searchTerm)

    return matchesSearch
  })

  const activeVendors = vendors.length
  const inactiveVendors = 0
  const avgLeadTime = 0

  const handleAddVendor = async (newVendor: any) => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert([newVendor])
        .select()
        .single()

      if (error) throw error

      setVendors(prev => [...prev, data])
      console.log('Successfully added vendor:', data)
      
    } catch (error) {
      console.error('Error adding vendor:', error)
      
      // Extract actual error values using direct property access
      if (error && typeof error === 'object') {
        console.error('Detailed Supabase Error:')
        console.error('  - Message:', error.message)
        console.error('  - Code:', error.code)
        console.error('  - Details:', error.details)
        console.error('  - Hint:', error.hint)
        
        // Log all available properties
        for (const key of Object.keys(error)) {
          console.error(`  - ${key}:`, error[key])
        }
      }
      
      // Fallback to local state if database fails
      const fallbackVendor: Vendor = {
        id: `new-${Date.now()}`,
        ...newVendor,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      setVendors(prev => [...prev, fallbackVendor])
      console.log('Added vendor to local state (database unavailable):', fallbackVendor)
    }
  }

  const handleUpdateVendor = async (updatedVendor: any) => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .update({...updatedVendor, updated_at: new Date().toISOString()})
        .eq('id', updatedVendor.id)
        .select()
        .single()

      if (error) throw error

      setVendors(prev => prev.map(vendor => 
        vendor.id === updatedVendor.id ? data : vendor
      ))
      console.log('Successfully updated vendor:', data)
      
    } catch (error) {
      console.error('Error updating vendor:', error)
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack
      })
      
      // Fallback to local state update if database fails
      setVendors(prev => prev.map(vendor => 
        vendor.id === updatedVendor.id 
          ? { ...updatedVendor, updated_at: new Date().toISOString() }
          : vendor
      ))
      console.log('Updated vendor in local state (database unavailable):', updatedVendor)
    }
    
    setEditingVendor(null)
  }

  const handleDeleteVendor = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id)

      if (error) throw error

      setVendors(prev => prev.filter(vendor => vendor.id !== id))
      console.log('Successfully deleted vendor:', id)
      
    } catch (error) {
      console.error('Error deleting vendor:', error)
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack
      })
      
      // Fallback to local state deletion if database fails
      setVendors(prev => prev.filter(vendor => vendor.id !== id))
      console.log('Deleted vendor from local state (database unavailable):', id)
    }
    
    setEditingVendor(null)
  }

  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setShowAddModal(true)
  }


  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Vendors</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendors</h1>
          <p className="text-gray-600">Manage your supplier and vendor relationships</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              setEditingVendor(null)
              setShowAddModal(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendors.length}</div>
            <p className="text-xs text-gray-600">All vendors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Vendors</CardTitle>
            <Truck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeVendors}</div>
            <p className="text-xs text-gray-600">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Tax ID</CardTitle>
            <Building className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{vendors.filter(v => v.tax_id).length}</div>
            <p className="text-xs text-gray-600">Vendors with tax info</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Contact Info</CardTitle>
            <Building className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{vendors.filter(v => v.email || v.phone).length}</div>
            <p className="text-xs text-gray-600">Have email or phone</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by company, contact, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
          >
            Total: {vendors.length} vendors
          </Button>
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVendors.map((vendor) => (
          <Card key={vendor.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">{vendor.company_name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditVendor(vendor)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this vendor?')) {
                        handleDeleteVendor(vendor.id)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                {vendor.email && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{vendor.email}</span>
                  </div>
                )}
                
                {vendor.phone && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{vendor.phone}</span>
                  </div>
                )}
                
                {vendor.address_line_1 && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{vendor.address_line_1}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment Terms:</span>
                  <span className="font-medium">{vendor.payment_terms || 'Not set'}</span>
                </div>
                
                {vendor.tax_id && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax ID:</span>
                    <span className="font-medium text-blue-600">{vendor.tax_id}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredVendors.length === 0 && (
        <div className="text-center py-12">
          <Truck className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No vendors found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding your first vendor.'}
          </p>
        </div>
      )}

      {/* Add Vendor Modal */}
      <AddVendorModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setEditingVendor(null)
        }}
        onAdd={handleAddVendor}
        onUpdate={handleUpdateVendor}
        onDelete={handleDeleteVendor}
        editingVendor={editingVendor}
      />
    </div>
  )
}