/**
 * SIMPLIFIED SAFE FORM HOOK
 * 
 * Works with existing database schema
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { simpleMultiUserManager, SimpleConflict, SimpleActiveUser, SimpleRecord } from '@/lib/simple-multi-user'

export interface SafeFormOptions<T> {
  table: string
  record?: T & SimpleRecord
  onSaveSuccess?: (data: T) => void
  onConflict?: (conflict: SimpleConflict) => void
  autoSave?: boolean
}

export interface SafeFormState<T> {
  // Form data and state
  data: Partial<T>
  originalData: (T & SimpleRecord) | null
  isDirty: boolean
  isSaving: boolean
  
  // Multi-user state
  activeUsers: SimpleActiveUser[]
  currentConflict: SimpleConflict | null
  
  // Form actions
  updateField: (field: keyof T, value: any) => void
  updateData: (newData: Partial<T>) => void
  save: () => Promise<boolean>
  reset: () => void
  
  // Conflict resolution
  resolveConflict: (strategy: 'keep_mine' | 'keep_theirs') => Promise<void>
  dismissConflict: () => void
  
  // Session management
  startEditing: () => void
  stopEditing: () => void
}

export function useSafeForm<T extends Record<string, any>>(
  options: SafeFormOptions<T>
): SafeFormState<T> {
  const { table, record, onSaveSuccess, onConflict, autoSave = false } = options
  
  // Core state
  const [data, setData] = useState<Partial<T>>(record ? { ...record } : {})
  const [originalData, setOriginalData] = useState<(T & SimpleRecord) | null>(record || null)
  const [isSaving, setIsSaving] = useState(false)
  const [currentConflict, setCurrentConflict] = useState<SimpleConflict | null>(null)
  const [activeUsers, setActiveUsers] = useState<SimpleActiveUser[]>([])
  
  // Computed state
  const isDirty = JSON.stringify(data) !== JSON.stringify(originalData)
  const recordId = record?.id
  
  // Load active users
  useEffect(() => {
    if (recordId) {
      const users = simpleMultiUserManager.getActiveUsers(table, recordId)
      setActiveUsers(users)
      
      // Refresh every 10 seconds
      const interval = setInterval(() => {
        const updatedUsers = simpleMultiUserManager.getActiveUsers(table, recordId)
        setActiveUsers(updatedUsers)
      }, 10000)
      
      return () => clearInterval(interval)
    }
  }, [recordId, table])
  
  // Update single field
  const updateField = useCallback((field: keyof T, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])
  
  // Update multiple fields
  const updateData = useCallback((newData: Partial<T>) => {
    setData(prev => ({ ...prev, ...newData }))
  }, [])
  
  // Save with conflict detection
  const save = useCallback(async (): Promise<boolean> => {
    if (!recordId || !originalData) return false
    
    setIsSaving(true)
    
    try {
      const result = await simpleMultiUserManager.simpleSave({
        table,
        data: { ...data, id: recordId },
        expected_updated_at: originalData.updated_at
      })
      
      if (result.success && result.data) {
        // Success - update our local state
        setOriginalData(result.data as unknown as T & SimpleRecord)
        setData({ ...result.data } as unknown as Partial<T>)
        onSaveSuccess?.(result.data as unknown as T)
        return true
      } else if (result.conflict) {
        // Conflict detected
        setCurrentConflict(result.conflict)
        onConflict?.(result.conflict)
        return false
      } else {
        // Other error
        console.error('Save failed:', result.error)
        return false
      }
    } catch (error) {
      console.error('Save error:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }, [table, recordId, data, originalData, onSaveSuccess, onConflict])
  
  // Reset form to original state
  const reset = useCallback(() => {
    if (originalData) {
      setData({ ...originalData })
    }
    setCurrentConflict(null)
  }, [originalData])
  
  // Resolve conflict with chosen strategy
  const resolveConflict = useCallback(async (strategy: 'keep_mine' | 'keep_theirs') => {
    if (!currentConflict || !recordId) return
    
    setIsSaving(true)
    
    try {
      let saveData = data
      if (strategy === 'keep_theirs') {
        // Use server data
        saveData = currentConflict.server_data
      }
      
      const result = await simpleMultiUserManager.simpleSave({
        table,
        data: { ...saveData, id: recordId }
        // Don't check timestamp for conflict resolution
      })
      
      if (result.success && result.data) {
        setOriginalData(result.data as unknown as T & SimpleRecord)
        setData({ ...result.data } as unknown as Partial<T>)
        setCurrentConflict(null)
        onSaveSuccess?.(result.data as unknown as T)
      } else {
        console.error('Conflict resolution failed:', result.error)
      }
    } catch (error) {
      console.error('Conflict resolution error:', error)
    } finally {
      setIsSaving(false)
    }
  }, [currentConflict, data, recordId, table, onSaveSuccess])
  
  // Dismiss conflict without resolving
  const dismissConflict = useCallback(() => {
    setCurrentConflict(null)
  }, [])
  
  // Start editing session
  const startEditing = useCallback(() => {
    if (recordId) {
      simpleMultiUserManager.startSession(table, recordId, 'editing')
      const users = simpleMultiUserManager.getActiveUsers(table, recordId)
      setActiveUsers(users)
    }
  }, [table, recordId])
  
  // Stop editing session
  const stopEditing = useCallback(() => {
    if (recordId) {
      simpleMultiUserManager.endSession(table, recordId)
      const users = simpleMultiUserManager.getActiveUsers(table, recordId)
      setActiveUsers(users)
    }
  }, [table, recordId])
  
  return {
    // Form state
    data,
    originalData,
    isDirty,
    isSaving,
    
    // Multi-user state
    activeUsers,
    currentConflict,
    
    // Form actions
    updateField,
    updateData,
    save,
    reset,
    
    // Conflict resolution
    resolveConflict,
    dismissConflict,
    
    // Session management
    startEditing,
    stopEditing
  }
}