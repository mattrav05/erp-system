/**
 * SAFE CUSTOMER EDIT MODAL
 * 
 * Enhanced version with full multi-user support:
 * - Optimistic locking
 * - Conflict resolution
 * - Real-time collaboration awareness
 * - Auto-save capability
 */

'use client'

import { useEffect, useState } from 'react'
import { useSafeForm } from '@/hooks/use-safe-form-simple'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import CollaborationIndicator from '@/components/ui/collaboration-indicator'
import SimpleConflictResolver from '@/components/ui/simple-conflict-resolver'
import { Badge } from '@/components/ui/badge'
import { Save, X, AlertCircle, Users, Clock, Shield } from 'lucide-react'
import TermsSelector from '@/components/ui/terms-selector'
import { formatCurrency } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  billing_address: string | null
  shipping_address: string | null
  payment_terms: string | null
  payment_terms_id: string | null
  credit_limit: number | null
  tax_exempt: boolean
  version?: number
  last_modified_by?: string | null
  created_at: string
  updated_at: string
}

interface EditCustomerSafeProps {
  customer: Customer
  isOpen: boolean
  onClose: () => void
  onSave: (customer: Customer) => void
  currentUserId?: string
}

export default function EditCustomerSafe({
  customer,
  isOpen,
  onClose,
  onSave,
  currentUserId
}: EditCustomerSafeProps) {
  const [showConflictDetails, setShowConflictDetails] = useState(false)
  
  // Initialize the safe form with multi-user support
  const form = useSafeForm<Customer>({
    table: 'customers',
    record: customer,
    onSaveSuccess: (savedCustomer) => {
      onSave(savedCustomer)
      onClose()
    },
    autoSave: false // Can be enabled for auto-save
  })

  // Start editing session when modal opens
  useEffect(() => {
    if (isOpen) {
      form.startEditing()
    }
    return () => {
      if (isOpen) {
        form.stopEditing()
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    const success = await form.save()
    if (success) {
      // Success handled by onSaveSuccess callback
    }
  }

  const handleCancel = () => {
    form.stopEditing()
    form.reset()
    onClose()
  }

  // Format currency for display
  const creditLimitDisplay = form.data.credit_limit 
    ? formatCurrency(form.data.credit_limit) 
    : 'No limit'

  // Other users currently viewing/editing
  const otherUsers = form.activeUsers.filter(u => u.user_id !== currentUserId)
  const hasOtherEditors = otherUsers.some(u => u.action === 'editing')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header with Collaboration Indicator */}
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">Edit Customer</CardTitle>
              <div className="flex items-center gap-3 mt-2">
                {/* Version Badge */}
                <Badge variant="outline" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Version {form.data.version || 1}
                </Badge>
                
                {/* Last Modified */}
                {form.data.updated_at && (
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    Updated {formatDistanceToNow(new Date(form.data.updated_at))} ago
                  </Badge>
                )}
                
                {/* Dirty Indicator */}
                {form.isDirty && (
                  <Badge className="bg-orange-500 text-xs">
                    Unsaved Changes
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Collaboration Indicator */}
            <div className="flex items-center gap-3">
              {otherUsers.length > 0 && (
                <CollaborationIndicator 
                  activeUsers={form.activeUsers}
                  currentUserId={currentUserId}
                />
              )}
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Warning if others are editing */}
          {hasOtherEditors && (
            <div className="mt-3 p-2 bg-orange-100 border border-orange-300 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-orange-800">
                Other users are currently editing this customer
              </span>
            </div>
          )}
        </CardHeader>

        {/* Conflict Resolution UI */}
        {form.currentConflict && (
          <SimpleConflictResolver
            conflict={form.currentConflict}
            onResolve={form.resolveConflict}
            onCancel={form.dismissConflict}
          />
        )}

        {/* Form Content */}
        <CardContent className="p-6 space-y-6 overflow-y-auto">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={form.data.name || ''}
                  onChange={(e) => form.updateField('name', e.target.value)}
                  placeholder="Enter company name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.data.email || ''}
                  onChange={(e) => form.updateField('email', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.data.phone || ''}
                  onChange={(e) => form.updateField('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <TermsSelector
                  value={form.data.payment_terms || 'Net 30'}
                  onChange={(value) => form.updateField('payment_terms', value)}
                  placeholder="Select payment terms..."
                />
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Addresses</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billing_address">Billing Address</Label>
                <Textarea
                  id="billing_address"
                  value={form.data.billing_address || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => form.updateField('billing_address', e.target.value)}
                  placeholder="Enter billing address"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="shipping_address">Shipping Address</Label>
                <Textarea
                  id="shipping_address"
                  value={form.data.shipping_address || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => form.updateField('shipping_address', e.target.value)}
                  placeholder="Enter shipping address"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Financial Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Financial Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="credit_limit">Credit Limit</Label>
                <Input
                  id="credit_limit"
                  type="number"
                  value={form.data.credit_limit || ''}
                  onChange={(e) => form.updateField('credit_limit', parseFloat(e.target.value) || null)}
                  placeholder="0.00"
                  min="0"
                  step="100"
                />
                <p className="text-xs text-gray-500">
                  Current: {creditLimitDisplay}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tax_exempt">Tax Settings</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="tax_exempt"
                    checked={form.data.tax_exempt || false}
                    onCheckedChange={(checked: boolean) => form.updateField('tax_exempt', checked)}
                  />
                  <Label htmlFor="tax_exempt" className="font-normal">
                    Tax Exempt Customer
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        {/* Footer with Actions */}
        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Save Status */}
            <div className="text-sm text-gray-600">
              {form.isSaving && (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  Saving...
                </span>
              )}
              {!form.isSaving && form.isDirty && (
                <span className="text-orange-600">• Unsaved changes</span>
              )}
              {!form.isSaving && !form.isDirty && (
                <span className="text-green-600">✓ All changes saved</span>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={form.isSaving || !form.isDirty}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}