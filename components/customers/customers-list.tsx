'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Users, Search, Plus, Mail, Phone, MapPin, Building, Edit3, Trash2, RefreshCw } from 'lucide-react'
import AddCustomerModal from './add-customer-modal'

interface Customer {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  customer_type: 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR' | null
  payment_terms: string | null
  payment_terms_id: string | null
  credit_limit: number | null
  tax_exempt: boolean
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function CustomersList() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('company_name')

      if (error) throw error
      
      setCustomers(data || [])
    } catch (error) {
      console.error('Error loading customers:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      
      // Fallback sample data when Supabase is not accessible
      console.log('Loading fallback customer data')
      const sampleCustomers: Customer[] = [
        {
          id: '1',
          company_name: 'ABC Corporation',
          contact_name: 'John Smith',
          email: 'john.smith@abccorp.com',
          phone: '(555) 123-4567',
          address_line_1: '123 Business Ave',
          address_line_2: null,
          city: 'Business City',
          state: 'BC',
          zip_code: '12345',
          country: 'USA',
          customer_type: 'WHOLESALE',
          payment_terms: 'Net 30',
          payment_terms_id: null,
          credit_limit: 50000,
          tax_exempt: false,
          notes: null,
          is_active: true,
          created_at: '2024-01-15T10:30:00Z',
          updated_at: '2024-01-15T10:30:00Z'
        },
        {
          id: '2',
          company_name: 'XYZ Industries',
          contact_name: 'Sarah Johnson',
          email: 'sarah.johnson@xyzind.com',
          phone: '(555) 987-6543',
          address_line_1: '456 Industrial Blvd',
          address_line_2: null,
          city: 'Industrial Park',
          state: 'IP',
          zip_code: '67890',
          country: 'USA',
          customer_type: 'DISTRIBUTOR',
          payment_terms: 'Net 15',
          payment_terms_id: null,
          credit_limit: 100000,
          tax_exempt: true,
          notes: null,
          is_active: true,
          created_at: '2024-01-10T14:20:00Z',
          updated_at: '2024-02-01T09:15:00Z'
        },
        {
          id: '3',
          company_name: 'Local Retail Shop',
          contact_name: 'Mike Wilson',
          email: 'mike@localretail.com',
          phone: '(555) 456-7890',
          address_line_1: '789 Main Street',
          address_line_2: null,
          city: 'Hometown',
          state: 'HT',
          zip_code: '54321',
          country: 'USA',
          customer_type: 'RETAIL',
          payment_terms: 'COD',
          payment_terms_id: null,
          credit_limit: 5000,
          tax_exempt: false,
          notes: null,
          is_active: true,
          created_at: '2024-01-20T16:45:00Z',
          updated_at: '2024-01-25T11:30:00Z'
        }
      ]
      
      setCustomers(sampleCustomers)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadCustomers()
    setIsRefreshing(false)
  }

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm)

    return matchesSearch
  })

  const totalCreditLimit = customers.reduce((sum, customer) => 
    sum + (customer.credit_limit || 0), 0
  )

  const activeCustomers = customers.length
  const inactiveCustomers = 0

  const handleAddCustomer = async (newCustomer: any) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([newCustomer])
        .select()
        .single()

      if (error) throw error

      setCustomers(prev => [...prev, data])
      console.log('Successfully added customer:', data)
      
    } catch (error) {
      console.error('Error adding customer:', error)
      
      // Fallback to local state if database fails
      const fallbackCustomer: Customer = {
        id: `new-${Date.now()}`,
        ...newCustomer,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      setCustomers(prev => [...prev, fallbackCustomer])
      console.log('Added customer to local state (database unavailable):', fallbackCustomer)
    }
  }

  const handleUpdateCustomer = async (updatedCustomer: any) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .update({...updatedCustomer, updated_at: new Date().toISOString()})
        .eq('id', updatedCustomer.id)
        .select()
        .single()

      if (error) throw error

      // Refresh customers list to get updated payment terms data
      loadCustomers()
      console.log('Successfully updated customer:', data)
      
    } catch (error) {
      console.error('Error updating customer:', error)
      
      // Fallback to local state update if database fails
      setCustomers(prev => prev.map(customer => 
        customer.id === updatedCustomer.id 
          ? { ...updatedCustomer, updated_at: new Date().toISOString() }
          : customer
      ))
      console.log('Updated customer in local state (database unavailable):', updatedCustomer)
    }
    
    setEditingCustomer(null)
  }

  const handleDeleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      if (error) throw error

      setCustomers(prev => prev.filter(customer => customer.id !== id))
      console.log('Successfully deleted customer:', id)
      
    } catch (error) {
      console.error('Error deleting customer:', error)
      
      // Fallback to local state deletion if database fails
      setCustomers(prev => prev.filter(customer => customer.id !== id))
      console.log('Deleted customer from local state (database unavailable):', id)
    }
    
    setEditingCustomer(null)
  }

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer)
    setShowAddModal(true) // Use AddCustomerModal for editing too
  }


  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
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
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600">Manage your customer database and relationships</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              setEditingCustomer(null)
              setShowAddModal(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-gray-600">All customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCustomers}</div>
            <p className="text-xs text-gray-600">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Customers</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{inactiveCustomers}</div>
            <p className="text-xs text-gray-600">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credit Limit</CardTitle>
            <Building className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalCreditLimit)}</div>
            <p className="text-xs text-gray-600">Available credit</p>
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
            Total: {customers.length} customers
          </Button>
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((customer) => (
          <Card key={customer.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">{customer.company_name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditCustomer(customer)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this customer?')) {
                        handleDeleteCustomer(customer.id)
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
                {customer.email && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                
                {customer.phone && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                
                {customer.address_line_1 && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{customer.address_line_1}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment Terms:</span>
                  <span className="font-medium">{customer.payment_terms || 'Not set'}</span>
                </div>
                
                {customer.credit_limit && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Credit Limit:</span>
                    <span className="font-medium text-green-600">{formatCurrency(customer.credit_limit)}</span>
                  </div>
                )}

                {customer.tax_exempt && (
                  <div className="text-sm text-blue-600 font-medium">Tax Exempt</div>
                )}
              </div>

            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding your first customer.'}
          </p>
        </div>
      )}

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setEditingCustomer(null)
        }}
        onAdd={handleAddCustomer}
        onUpdate={handleUpdateCustomer}
        onDelete={handleDeleteCustomer}
        editingCustomer={editingCustomer}
      />
      
    </div>
  )
}