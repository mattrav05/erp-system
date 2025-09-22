'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Clock, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface AuditInfoProps {
  lastEditedBy?: string | null
  lastEditedAt?: string | null
  createdBy?: string | null
  createdAt?: string | null
  className?: string
  showCreated?: boolean
}

interface UserProfile {
  id: string
  email: string
  first_name?: string
  last_name?: string
}

export default function AuditInfo({
  lastEditedBy,
  lastEditedAt,
  createdBy,
  createdAt,
  className = '',
  showCreated = false
}: AuditInfoProps) {
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({})
  const [loading, setLoading] = useState(false)

  // Fetch user profiles for the user IDs we need
  useEffect(() => {
    const userIds = [lastEditedBy, createdBy].filter(Boolean) as string[]
    if (userIds.length === 0) return

    // Check if we already have all the user profiles we need
    const needToFetch = userIds.filter(id => !userProfiles[id])
    if (needToFetch.length === 0) return

    setLoading(true)

    const fetchUserProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', needToFetch)

        if (error) {
          console.error('Error fetching user profiles:', error)
          return
        }

        if (data) {
          const profilesMap = data.reduce((acc, profile) => {
            acc[profile.id] = profile
            return acc
          }, {} as Record<string, UserProfile>)

          setUserProfiles(prev => ({ ...prev, ...profilesMap }))
        }
      } catch (error) {
        console.error('Error fetching user profiles:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfiles()
  }, [lastEditedBy, createdBy, userProfiles])

  const formatUserName = (userId: string | null): string => {
    if (!userId) return 'Unknown user'

    const profile = userProfiles[userId]
    if (!profile && loading) return 'Loading...'
    if (!profile) return `User ${userId.slice(-8)}`

    // Build full name from first_name and last_name
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')

    // Return full name if available, otherwise email, otherwise fallback
    if (fullName) return fullName
    if (profile.email) return profile.email
    return `User ${userId.slice(-8)}`
  }

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return ''
    
    try {
      const date = new Date(dateStr)
      const timeAgo = formatDistanceToNow(date, { addSuffix: true })
      const exactTime = date.toLocaleString()
      return `${timeAgo} (${exactTime})`
    } catch {
      return dateStr
    }
  }

  if (!lastEditedBy && !lastEditedAt && !createdBy && !createdAt) {
    return null
  }

  return (
    <div className={`text-xs text-gray-500 space-y-1 ${className}`}>
      {lastEditedBy && lastEditedAt && (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>
            Last edited by{' '}
            <span className="font-medium">
              {formatUserName(lastEditedBy)}
            </span>
            {' '}{formatDateTime(lastEditedAt)}
          </span>
        </div>
      )}
      
      {showCreated && createdBy && createdAt && (
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          <span>
            Created by{' '}
            <span className="font-medium">
              {formatUserName(createdBy)}
            </span>
            {' '}{formatDateTime(createdAt)}
          </span>
        </div>
      )}
    </div>
  )
}