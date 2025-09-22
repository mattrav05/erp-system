/**
 * SIMPLIFIED MULTI-USER SYSTEM
 * 
 * Works with existing database schema while providing
 * basic multi-user functionality
 */

import { supabase } from './supabase'

export interface SimpleRecord {
  id: string
  updated_at: string
  [key: string]: any
}

export interface SimpleConflict {
  message: string
  server_data: any
  local_data: any
  last_modified: string
}

export interface SimpleActiveUser {
  user_id: string
  email: string
  action: 'viewing' | 'editing'
  started_at: string
}

export interface SimpleSaveOptions {
  table: string
  data: Partial<SimpleRecord>
  expected_updated_at?: string
}

export interface SimpleSaveResult {
  success: boolean
  data?: SimpleRecord
  conflict?: SimpleConflict
  error?: string
}

/**
 * SIMPLE MULTI-USER MANAGER
 * 
 * Provides basic conflict detection using updated_at timestamps
 * and session tracking in localStorage
 */
class SimpleMultiUserManager {
  private activeSessions = new Map<string, SimpleActiveUser[]>()
  private currentUser: { id: string; email: string } | null = null

  constructor() {
    this.initializeUser()
    this.startSessionCleanup()
  }

  private async initializeUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        this.currentUser = { id: user.id, email: user.email || 'user@example.com' }
      } else {
        // Fallback for demo purposes
        this.currentUser = { id: 'demo-user', email: 'demo@example.com' }
      }
    } catch {
      this.currentUser = { id: 'demo-user', email: 'demo@example.com' }
    }
  }

  private startSessionCleanup() {
    // Clean up old sessions every 30 seconds
    setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      
      this.activeSessions.forEach((users, key) => {
        const activeUsers = users.filter(user => 
          new Date(user.started_at).getTime() > fiveMinutesAgo
        )
        
        if (activeUsers.length === 0) {
          this.activeSessions.delete(key)
        } else {
          this.activeSessions.set(key, activeUsers)
        }
      })
    }, 30000)
  }

  /**
   * Compare two records to detect significant changes
   * Ignores system fields and minor variations
   */
  private hasSignificantChanges(serverData: any, localData: any): boolean {
    const systemFields = ['id', 'created_at', 'updated_at', 'version']
    const computedFields = ['quantity_available'] // Fields that are computed/read-only
    
    // Get all fields from both objects
    const allFields = new Set([
      ...Object.keys(serverData),
      ...Object.keys(localData)
    ])
    
    for (const field of allFields) {
      if (systemFields.includes(field) || computedFields.includes(field)) continue
      
      const serverValue = serverData[field]
      const localValue = localData[field]
      
      // Handle null/undefined/empty string equivalence
      const normalizedServer = this.normalizeValue(serverValue)
      const normalizedLocal = this.normalizeValue(localValue)
      
      if (normalizedServer !== normalizedLocal) {
        console.log(`Conflict detected in field ${field}: server="${normalizedServer}" vs local="${normalizedLocal}"`)
        return true
      }
    }
    
    return false
  }

  /**
   * Normalize values for comparison (handles null/undefined/empty equivalence)
   */
  private normalizeValue(value: any): any {
    if (value === null || value === undefined || value === '') {
      return null
    }
    if (typeof value === 'number' && isNaN(value)) {
      return null
    }
    return value
  }

  /**
   * Simple save with optional conflict detection
   */
  async simpleSave(options: SimpleSaveOptions & { skipConflictCheck?: boolean }): Promise<SimpleSaveResult> {
    const { table, data, expected_updated_at, skipConflictCheck = false } = options

    try {
      // Get current server state
      const { data: current, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('id', data.id)
        .single()

      if (fetchError) {
        return { success: false, error: fetchError.message }
      }

      // Skip conflict detection if requested or if single user mode
      if (!skipConflictCheck && expected_updated_at && current.updated_at !== expected_updated_at) {
        console.log('Timestamp mismatch detected:')
        console.log('Expected:', expected_updated_at)
        console.log('Current:', current.updated_at)
        
        // Check if there are multiple active users on this record
        const activeUsers = this.getActiveUsers(table, data.id!)
        const hasMultipleUsers = activeUsers.length > 1
        
        console.log('Active users:', activeUsers.length, hasMultipleUsers ? '(conflict check enabled)' : '(single user, skipping)')
        
        // Only do conflict detection if multiple users are active
        if (hasMultipleUsers) {
          const hasRealChanges = this.hasSignificantChanges(current, data)
          console.log('Has significant changes:', hasRealChanges)
          
          if (hasRealChanges) {
            return {
              success: false,
              conflict: {
                message: 'This record was modified by another user while you were editing',
                server_data: current,
                local_data: data,
                last_modified: current.updated_at
              }
            }
          }
        } else {
          console.log('Single user detected - skipping conflict check and proceeding with save')
        }
      }

      // Perform update - exclude computed/read-only columns
      const { quantity_available, ...updateableData } = data
      const updateData = {
        ...updateableData,
        updated_at: new Date().toISOString()
      }

      const { data: result, error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', data.id)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      this.endSession(table, data.id!)
      return { success: true, data: result }

    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  /**
   * Start a user session
   */
  startSession(table: string, record_id: string, action: 'viewing' | 'editing'): void {
    if (!this.currentUser) return

    const sessionKey = `${table}_${record_id}`
    const users = this.activeSessions.get(sessionKey) || []
    
    // Remove any existing session for this user
    const filteredUsers = users.filter(u => u.user_id !== this.currentUser!.id)
    
    // Add new session
    filteredUsers.push({
      user_id: this.currentUser.id,
      email: this.currentUser.email,
      action,
      started_at: new Date().toISOString()
    })
    
    this.activeSessions.set(sessionKey, filteredUsers)
  }

  /**
   * End a user session
   */
  endSession(table: string, record_id: string): void {
    if (!this.currentUser) return

    const sessionKey = `${table}_${record_id}`
    const users = this.activeSessions.get(sessionKey) || []
    const filteredUsers = users.filter(u => u.user_id !== this.currentUser!.id)
    
    if (filteredUsers.length === 0) {
      this.activeSessions.delete(sessionKey)
    } else {
      this.activeSessions.set(sessionKey, filteredUsers)
    }
  }

  /**
   * Get active users on a record
   */
  getActiveUsers(table: string, record_id: string): SimpleActiveUser[] {
    const sessionKey = `${table}_${record_id}`
    return this.activeSessions.get(sessionKey) || []
  }

  /**
   * Subscribe to changes (simplified - no real-time)
   */
  subscribeToChanges(table: string, record_id: string, callback: (payload: any) => void): string {
    // For now, return a dummy subscription ID
    return `${table}_${record_id}_${Date.now()}`
  }

  /**
   * Subscribe to sessions (simplified)
   */
  subscribeToSessions(table: string, record_id: string, callback: () => void): string {
    // For now, return a dummy subscription ID
    return `sessions_${table}_${record_id}_${Date.now()}`
  }

  /**
   * Unsubscribe (no-op for simplified version)
   */
  unsubscribe(subscriptionId: string): void {
    // No-op for simplified version
  }
}

// Singleton instance
export const simpleMultiUserManager = new SimpleMultiUserManager()

/**
 * SIMPLE SAFE FORM HOOK
 */
export function useSimpleSafeForm<T extends SimpleRecord>(options: {
  table: string
  record?: T
  onSaveSuccess?: (data: T) => void
}) {
  const { table, record, onSaveSuccess } = options
  const [data, setData] = useState<Partial<T>>(record ? { ...record } : {})
  const [originalData, setOriginalData] = useState<T | null>(record || null)
  const [isSaving, setIsSaving] = useState(false)
  const [currentConflict, setCurrentConflict] = useState<SimpleConflict | null>(null)
  const [activeUsers, setActiveUsers] = useState<SimpleActiveUser[]>([])

  // Computed state
  const isDirty = JSON.stringify(data) !== JSON.stringify(originalData)

  // Update field
  const updateField = (field: keyof T, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  // Save with conflict detection
  const save = async (): Promise<boolean> => {
    if (!record?.id) return false
    
    setIsSaving(true)
    
    try {
      const result = await simpleMultiUserManager.simpleSave({
        table,
        data: { ...data, id: record.id },
        expected_updated_at: originalData?.updated_at
      })
      
      if (result.success && result.data) {
        setOriginalData(result.data as unknown as T)
        setData({ ...result.data } as unknown as Partial<T>)
        onSaveSuccess?.(result.data as unknown as T)
        return true
      } else if (result.conflict) {
        setCurrentConflict(result.conflict)
        return false
      } else {
        console.error('Save failed:', result.error)
        return false
      }
    } catch (error) {
      console.error('Save error:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Reset form
  const reset = () => {
    if (originalData) {
      setData({ ...originalData })
    }
    setCurrentConflict(null)
  }

  // Resolve conflict
  const resolveConflict = async (strategy: 'keep_mine' | 'keep_theirs') => {
    if (!currentConflict || !record?.id) return
    
    setIsSaving(true)
    
    try {
      let saveData = data
      if (strategy === 'keep_theirs') {
        saveData = currentConflict.server_data
      }
      
      const result = await simpleMultiUserManager.simpleSave({
        table,
        data: { ...saveData, id: record.id }
        // Don't check timestamp for conflict resolution
      })
      
      if (result.success && result.data) {
        setOriginalData(result.data as T)
        setData({ ...result.data } as unknown as Partial<T>)
        setCurrentConflict(null)
        onSaveSuccess?.(result.data as unknown as T)
      }
    } catch (error) {
      console.error('Conflict resolution error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Session management
  const startEditing = () => {
    if (record?.id) {
      simpleMultiUserManager.startSession(table, record.id, 'editing')
      setActiveUsers(simpleMultiUserManager.getActiveUsers(table, record.id))
    }
  }

  const stopEditing = () => {
    if (record?.id) {
      simpleMultiUserManager.endSession(table, record.id)
      setActiveUsers(simpleMultiUserManager.getActiveUsers(table, record.id))
    }
  }

  return {
    data,
    originalData,
    isDirty,
    isSaving,
    activeUsers,
    currentConflict,
    updateField,
    save,
    reset,
    resolveConflict,
    dismissConflict: () => setCurrentConflict(null),
    startEditing,
    stopEditing
  }
}

import { useState } from 'react'