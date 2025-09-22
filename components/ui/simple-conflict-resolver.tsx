/**
 * SIMPLE CONFLICT RESOLVER
 * 
 * Basic conflict resolution UI for timestamp-based conflicts
 */

'use client'

import { useState } from 'react'
import { SimpleConflict } from '@/lib/simple-multi-user'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { AlertTriangle, User, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface SimpleConflictResolverProps {
  conflict: SimpleConflict
  onResolve: (strategy: 'keep_mine' | 'keep_theirs') => void
  onCancel: () => void
}

export default function SimpleConflictResolver({ conflict, onResolve, onCancel }: SimpleConflictResolverProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<'keep_mine' | 'keep_theirs'>('keep_mine')

  const formatFieldValue = (value: any): string => {
    if (value === null || value === undefined) return '(empty)'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return value.toString()
    return String(value)
  }

  const getFieldLabel = (fieldName: string): string => {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Compare local and server data to find differences
  const localData = conflict.local_data || {}
  const serverData = conflict.server_data || {}
  
  const changedFields = Object.keys(localData).filter(
    field => field !== 'id' && field !== 'updated_at' && field !== 'created_at' &&
    localData[field] !== serverData[field]
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <CardHeader className="bg-orange-50 border-b border-orange-200">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 rounded-full p-2">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-orange-900">Conflict Detected</CardTitle>
              <CardDescription className="text-orange-700">
                {conflict.message}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6 overflow-y-auto">
          {/* Conflict Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <User className="h-4 w-4" />
                What happened?
              </h3>
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Clock className="h-4 w-4" />
                Updated {formatDistanceToNow(new Date(conflict.last_modified))} ago
              </div>
            </div>
            <p className="text-sm text-blue-800">
              Someone else modified this record while you were editing it. 
              Choose how to resolve the conflict below.
            </p>
          </div>

          {/* Resolution Strategy Selection */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Choose Resolution</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Keep Mine */}
              <Card 
                className={`cursor-pointer transition-all border-2 ${
                  selectedStrategy === 'keep_mine' 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
                onClick={() => setSelectedStrategy('keep_mine')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <input 
                      type="radio" 
                      name="conflict-resolution"
                      checked={selectedStrategy === 'keep_mine'} 
                      onChange={() => setSelectedStrategy('keep_mine')}
                      className="h-4 w-4"
                    />
                    <h4 className="font-medium">Keep My Changes</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Save your changes and overwrite the server version.
                  </p>
                  <Badge className="mt-2 bg-blue-500">Recommended</Badge>
                </CardContent>
              </Card>

              {/* Keep Theirs */}
              <Card 
                className={`cursor-pointer transition-all border-2 ${
                  selectedStrategy === 'keep_theirs' 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
                onClick={() => setSelectedStrategy('keep_theirs')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <input 
                      type="radio" 
                      name="conflict-resolution"
                      checked={selectedStrategy === 'keep_theirs'} 
                      onChange={() => setSelectedStrategy('keep_theirs')}
                      className="h-4 w-4"
                    />
                    <h4 className="font-medium">Keep Their Changes</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Discard your changes and use the current server version.
                  </p>
                  <Badge variant="secondary" className="mt-2">Safe Option</Badge>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Show Changed Fields */}
          {changedFields.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-3">Changed Fields</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {changedFields.slice(0, 6).map(field => (
                  <div key={field} className="bg-white p-3 rounded border">
                    <div className="font-medium text-gray-700 mb-1">{getFieldLabel(field)}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-blue-600">Your value:</span>
                        <div className="font-mono bg-blue-50 p-1 rounded mt-1">
                          {formatFieldValue(localData[field])}
                        </div>
                      </div>
                      <div>
                        <span className="text-green-600">Their value:</span>
                        <div className="font-mono bg-green-50 p-1 rounded mt-1">
                          {formatFieldValue(serverData[field])}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {changedFields.length > 6 && (
                <p className="text-sm text-yellow-700 mt-2">
                  And {changedFields.length - 6} more fields...
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                console.log('Resolving conflict with strategy:', selectedStrategy)
                onResolve(selectedStrategy)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={false}
            >
              Resolve Conflict
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}