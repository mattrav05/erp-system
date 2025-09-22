'use client'

import { useEffect } from 'react'
import { Database } from '@/lib/supabase'
import { useSimpleSafeForm } from '@/lib/simple-multi-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, User, Building, FileText, DollarSign, Settings, Save, X, AlertTriangle } from 'lucide-react'
import SimpleConflictResolver from '@/components/ui/simple-conflict-resolver'
import CollaborationIndicator from '@/components/ui/collaboration-indicator'

type Estimate = Database['public']['Tables']['estimates']['Row'] & {
  customers?: { name: string; email: string | null }
  sales_reps?: { first_name: string; last_name: string; employee_code: string }
  estimate_templates?: { name: string }
}

interface EditEstimateSafeProps {
  estimate: Estimate
  isOpen: boolean
  onClose: () => void
  onSave: (updatedEstimate: Estimate) => void
}

export default function EditEstimateSafe({ estimate, isOpen, onClose, onSave }: EditEstimateSafeProps) {
  const form = useSimpleSafeForm<Estimate>({
    table: 'estimates',
    record: estimate,
    onSaveSuccess: (savedEstimate) => {
      onSave(savedEstimate)
      onClose()
    }
  })

  // Start editing session when component mounts
  useEffect(() => {
    if (isOpen) {
      form.startEditing()
      return () => form.stopEditing()
    }
  }, [isOpen])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'SENT': return 'bg-blue-100 text-blue-800'
      case 'ACCEPTED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      case 'EXPIRED': return 'bg-yellow-100 text-yellow-800'
      case 'CONVERTED': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const handleSave = async () => {
    const success = await form.save()
    if (!success && !form.currentConflict) {
      alert('Failed to save estimate. Please try again.')
    }
  }

  if (form.currentConflict) {
    return (
      <SimpleConflictResolver
        conflict={form.currentConflict}
        onResolve={form.resolveConflict}
        onCancel={form.dismissConflict}
      />
    )
  }

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Header with Status and Collaboration */}
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">
            {form.data.estimate_number}
          </h2>
          <Badge className={getStatusColor(form.data.status || 'DRAFT')}>
            {form.data.status || 'DRAFT'}
          </Badge>
          <CollaborationIndicator
            activeUsers={form.activeUsers}
          />
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Customer</p>
          <p className="font-medium">{estimate.customers?.name}</p>
        </div>
      </div>

      {/* Active Users Alert */}
      {form.activeUsers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              {form.activeUsers.length} other user{form.activeUsers.length > 1 ? 's' : ''} currently viewing this estimate
            </span>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimate Number
              </label>
              <Input
                value={form.data.estimate_number || ''}
                onChange={(e) => form.updateField('estimate_number', e.target.value)}
                disabled={form.data.status !== 'DRAFT'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={form.data.status || 'DRAFT'}
                onChange={(e) => form.updateField('status', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
                <option value="CONVERTED">Converted</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimate Date
              </label>
              <Input
                type="date"
                value={form.data.estimate_date || ''}
                onChange={(e) => form.updateField('estimate_date', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiration Date
              </label>
              <Input
                type="date"
                value={form.data.expiration_date || ''}
                onChange={(e) => form.updateField('expiration_date', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number
              </label>
              <Input
                value={form.data.reference_number || ''}
                onChange={(e) => form.updateField('reference_number', e.target.value)}
                placeholder="Customer PO, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Name
              </label>
              <Input
                value={form.data.job_name || ''}
                onChange={(e) => form.updateField('job_name', e.target.value)}
                placeholder="Project or job description"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subtotal
              </label>
              <div className="text-lg font-semibold">
                {formatCurrency(form.data.subtotal || 0)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Rate (%)
              </label>
              <Input
                type="number"
                step="0.01"
                value={form.data.tax_rate || ''}
                onChange={(e) => form.updateField('tax_rate', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Amount
              </label>
              <div className="text-lg font-semibold">
                {formatCurrency(form.data.tax_amount || 0)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shipping
              </label>
              <Input
                type="number"
                step="0.01"
                value={form.data.shipping_amount || ''}
                onChange={(e) => form.updateField('shipping_amount', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total
              </label>
              <div className="text-xl font-bold text-green-600">
                {formatCurrency(form.data.total_amount || 0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Billing Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <Input
                value={form.data.bill_to_company || ''}
                onChange={(e) => form.updateField('bill_to_company', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact
              </label>
              <Input
                value={form.data.bill_to_contact || ''}
                onChange={(e) => form.updateField('bill_to_contact', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 1
            </label>
            <Input
              value={form.data.bill_to_address_line_1 || ''}
              onChange={(e) => form.updateField('bill_to_address_line_1', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 2
            </label>
            <Input
              value={form.data.bill_to_address_line_2 || ''}
              onChange={(e) => form.updateField('bill_to_address_line_2', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <Input
                value={form.data.bill_to_city || ''}
                onChange={(e) => form.updateField('bill_to_city', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <Input
                value={form.data.bill_to_state || ''}
                onChange={(e) => form.updateField('bill_to_state', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP
              </label>
              <Input
                value={form.data.bill_to_zip || ''}
                onChange={(e) => form.updateField('bill_to_zip', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Shipping Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sameAsBilling"
              checked={form.data.ship_to_same_as_billing}
              onChange={(e) => form.updateField('ship_to_same_as_billing', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="sameAsBilling" className="text-sm font-medium text-gray-700">
              Same as billing address
            </label>
          </div>

          {!form.data.ship_to_same_as_billing && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <Input
                    value={form.data.ship_to_company || ''}
                    onChange={(e) => form.updateField('ship_to_company', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact
                  </label>
                  <Input
                    value={form.data.ship_to_contact || ''}
                    onChange={(e) => form.updateField('ship_to_contact', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1
                </label>
                <Input
                  value={form.data.ship_to_address_line_1 || ''}
                  onChange={(e) => form.updateField('ship_to_address_line_1', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <Input
                  value={form.data.ship_to_address_line_2 || ''}
                  onChange={(e) => form.updateField('ship_to_address_line_2', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <Input
                    value={form.data.ship_to_city || ''}
                    onChange={(e) => form.updateField('ship_to_city', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <Input
                    value={form.data.ship_to_state || ''}
                    onChange={(e) => form.updateField('ship_to_state', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP
                  </label>
                  <Input
                    value={form.data.ship_to_zip || ''}
                    onChange={(e) => form.updateField('ship_to_zip', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notes and Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Notes and Terms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Internal Notes
            </label>
            <Textarea
              value={form.data.internal_notes || ''}
              onChange={(e) => form.updateField('internal_notes', e.target.value)}
              placeholder="Internal notes (not visible to customer)"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Notes
            </label>
            <Textarea
              value={form.data.customer_notes || ''}
              onChange={(e) => form.updateField('customer_notes', e.target.value)}
              placeholder="Notes visible to customer"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Terms and Conditions
            </label>
            <Textarea
              value={form.data.terms_and_conditions || ''}
              onChange={(e) => form.updateField('terms_and_conditions', e.target.value)}
              placeholder="Terms and conditions for this estimate"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="text-sm text-gray-500">
          {form.isDirty && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              You have unsaved changes
            </span>
          )}
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} disabled={form.isSaving}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={form.isSaving || !form.isDirty}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {form.isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}