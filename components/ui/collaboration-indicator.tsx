/**
 * COLLABORATION INDICATOR
 * 
 * Shows who else is viewing/editing a record in real-time
 * Provides visual feedback for multi-user awareness
 */

'use client'

import { useState, useEffect } from 'react'
import { SimpleActiveUser } from '@/lib/simple-multi-user'
import { Badge } from './badge'
import { Avatar } from './avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { Eye, Edit3, Users } from 'lucide-react'

interface CollaborationIndicatorProps {
  activeUsers: SimpleActiveUser[]
  currentUserId?: string
  className?: string
}

export default function CollaborationIndicator({ 
  activeUsers, 
  currentUserId, 
  className = '' 
}: CollaborationIndicatorProps) {
  const [animateUsers, setAnimateUsers] = useState<Set<string>>(new Set())

  // Filter out current user
  const otherUsers = activeUsers.filter(user => user.user_id !== currentUserId)

  // Animate when new users join
  useEffect(() => {
    const newUserIds = new Set(otherUsers.map(u => u.user_id))
    const previousUserIds = animateUsers

    // Find newly joined users
    const newUsers = otherUsers.filter(u => !previousUserIds.has(u.user_id))
    
    if (newUsers.length > 0) {
      newUsers.forEach(user => {
        setAnimateUsers(prev => new Set(prev.add(user.user_id)))
        
        // Remove animation class after animation completes
        setTimeout(() => {
          setAnimateUsers(prev => {
            const newSet = new Set(prev)
            newSet.delete(user.user_id)
            return newSet
          })
        }, 500)
      })
    }
  }, [otherUsers.length])

  if (otherUsers.length === 0) {
    return null
  }

  const getInitials = (email: string): string => {
    return email.slice(0, 2).toUpperCase()
  }

  const getUserColor = (userId: string): string => {
    // Generate consistent color based on user ID
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ]
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
    return colors[index]
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'editing':
        return <Edit3 className="h-3 w-3" />
      case 'viewing':
        return <Eye className="h-3 w-3" />
      default:
        return <Users className="h-3 w-3" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'editing':
        return 'border-orange-400 bg-orange-50'
      case 'viewing':
        return 'border-blue-400 bg-blue-50'
      default:
        return 'border-gray-400 bg-gray-50'
    }
  }

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Active Users Count */}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Users className="h-4 w-4" />
          <span>{otherUsers.length}</span>
        </div>

        {/* User Avatars */}
        <div className="flex -space-x-2">
          {otherUsers.slice(0, 5).map((user) => (
            <Tooltip key={user.user_id}>
              <TooltipTrigger>
                <div 
                  className={`relative transition-all duration-500 ${
                    animateUsers.has(user.user_id) 
                      ? 'animate-pulse scale-110' 
                      : 'hover:scale-110'
                  }`}
                >
                  <div
                    className={`
                      w-8 h-8 rounded-full ${getUserColor(user.user_id)} 
                      flex items-center justify-center text-white text-xs font-medium
                      border-2 ${getActionColor(user.action)}
                      shadow-sm hover:shadow-md transition-shadow
                    `}
                  >
                    {getInitials(user.email)}
                  </div>
                  
                  {/* Action Indicator */}
                  <div 
                    className={`
                      absolute -bottom-1 -right-1 w-4 h-4 rounded-full
                      ${user.action === 'editing' ? 'bg-orange-500' : 'bg-blue-500'}
                      flex items-center justify-center text-white border-2 border-white
                    `}
                  >
                    {getActionIcon(user.action)}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="text-center">
                  <div className="font-medium">
                    {user.email.split('@')[0]}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    {getActionIcon(user.action)}
                    {user.action === 'editing' ? 'Currently editing' : 'Viewing'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Started {new Date(user.started_at).toLocaleTimeString()}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}

          {/* More Users Indicator */}
          {otherUsers.length > 5 && (
            <Tooltip>
              <TooltipTrigger>
                <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-medium border-2 border-white">
                  +{otherUsers.length - 5}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div>{otherUsers.length - 5} more users active</div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Summary Badge */}
        <div className="flex gap-1">
          {otherUsers.some(u => u.action === 'editing') && (
            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
              <Edit3 className="h-3 w-3 mr-1" />
              Editing
            </Badge>
          )}
          {otherUsers.some(u => u.action === 'viewing') && (
            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
              <Eye className="h-3 w-3 mr-1" />
              Viewing
            </Badge>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

// Pulse animation for new users
const pulseAnimation = `
  @keyframes collaborator-join {
    0% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  
  .animate-collaborator-join {
    animation: collaborator-join 0.5s ease-out;
  }
`

// Add CSS to head if not already present
if (typeof document !== 'undefined' && !document.querySelector('#collaboration-styles')) {
  const style = document.createElement('style')
  style.id = 'collaboration-styles'
  style.textContent = pulseAnimation
  document.head.appendChild(style)
}