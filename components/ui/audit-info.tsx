'use client'

import { formatDistanceToNow } from 'date-fns'
import { Clock, User } from 'lucide-react'

interface AuditInfoProps {
  lastEditedBy?: string | null
  lastEditedAt?: string | null
  createdBy?: string | null
  createdAt?: string | null
  className?: string
  showCreated?: boolean
}

export default function AuditInfo({ 
  lastEditedBy, 
  lastEditedAt, 
  createdBy, 
  createdAt,
  className = '',
  showCreated = false
}: AuditInfoProps) {
  const formatUserName = (userId: string | null): string => {
    if (!userId) return 'Unknown user'
    
    // For now, just show a shortened version of the UUID
    // In a production system, you'd want to fetch actual user names
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