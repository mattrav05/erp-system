/**
 * SAFE VENDOR EDIT MODAL
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
import { Textarea } from '@/components/ui/textarea'
import CollaborationIndicator from '@/components/ui/collaboration-indicator'
import SimpleConflictResolver from '@/components/ui/simple-conflict-resolver'
import { Badge } from '@/components/ui/badge'
import { Save, X, AlertCircle, Users, Clock, Shield } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Vendor {
  id: string
  name: string
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  payment_terms: string | null
  tax_id: string | null
  version?: number
  last_modified_by?: string | null
  created_at: string
  updated_at: string
}

interface EditVendorSafeProps {
  vendor: Vendor
  isOpen: boolean
  onClose: () => void
  onSave: (vendor: Vendor) => void
  currentUserId?: string
}

export default function EditVendorSafe({
  vendor,
  isOpen,
  onClose,
  onSave,
  currentUserId
}: EditVendorSafeProps) {
  const [showConflictDetails, setShowConflictDetails] = useState(false)
  
  // Initialize the safe form with multi-user support
  const form = useSafeForm<Vendor>({
    table: 'vendors',
    record: vendor,
    onSaveSuccess: (savedVendor) => {
      onSave(savedVendor)
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

  // Other users currently viewing/editing
  const otherUsers = form.activeUsers.filter(u => u.user_id !== currentUserId)
  const hasOtherEditors = otherUsers.some(u => u.action === 'editing')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header with Collaboration Indicator */}
        <CardHeader className="border-b bg-gradient-to-r from-green-50 to-white">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">Edit Vendor</CardTitle>
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
                Other users are currently editing this vendor
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
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Vendor Name *</Label>
                <Input
                  id="name"
                  value={form.data.name || ''}
                  onChange={(e) => form.updateField('name', e.target.value)}
                  placeholder="Enter vendor name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={form.data.contact_email || ''}
                  onChange={(e) => form.updateField('contact_email', e.target.value)}
                  placeholder="vendor@example.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  value={form.data.contact_phone || ''}
                  onChange={(e) => form.updateField('contact_phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Address</h3>
            
            <div className="space-y-2">
              <Label htmlFor="address">Business Address</Label>
              <Textarea
                id="address"
                value={form.data.address || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => form.updateField('address', e.target.value)}
                placeholder="Enter business address"
                rows={3}
              />
            </div>
          </div>

          {/* Business Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Business Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <select
                  id="payment_terms"
                  className="w-full border rounded-md px-3 py-2"
                  value={form.data.payment_terms || 'NET30'}
                  onChange={(e) => form.updateField('payment_terms', e.target.value)}
                >
                  <option value="COD">Cash on Delivery</option>
                  <option value="NET15">Net 15</option>
                  <option value="NET30">Net 30</option>
                  <option value="NET45">Net 45</option>
                  <option value="NET60">Net 60</option>
                  <option value="NET90">Net 90</option>
                  <option value="PREPAID">Prepaid</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID / EIN</Label>
                <Input
                  id="tax_id"
                  value={form.data.tax_id || ''}
                  onChange={(e) => form.updateField('tax_id', e.target.value)}
                  placeholder="XX-XXXXXXX"
                />
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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
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
                className="bg-green-600 hover:bg-green-700"
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