'use client'

import { useState, useEffect, ReactNode } from 'react'
import { X, Minimize2, Maximize2 } from 'lucide-react'

interface SubWindowProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  className?: string
}

export default function SubWindow({
  isOpen,
  onClose,
  title,
  children,
  width = 800,
  height = 600,
  minWidth = 400,
  minHeight = 300,
  className
}: SubWindowProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  // Reset minimized state when window opens
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false)
    }
  }, [isOpen])

  // Handle escape key and body scroll prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
      document.body.style.height = '100vh'
    } else {
      // Restore body scroll
      document.body.style.overflow = ''
      document.body.style.height = ''
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      document.body.style.height = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-20" onClick={onClose} />
      
      {/* Window */}
      <div
        className={`relative bg-white rounded-lg shadow-xl border border-gray-300 flex flex-col my-auto ${className || ''}`}
        style={{
          width: `${width}px`,
          maxHeight: 'calc(100vh - 2rem)',
          minWidth: `${minWidth}px`,
          minHeight: isMinimized ? '40px' : `${minHeight}px`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Window Header */}
        <div
          className="window-header bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between select-none flex-shrink-0"
        >
          <h3 className="font-medium text-gray-900 truncate">{title}</h3>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title={isMinimized ? 'Restore' : 'Minimize'}
            >
              {isMinimized ? (
                <Maximize2 className="h-4 w-4 text-gray-600" />
              ) : (
                <Minimize2 className="h-4 w-4 text-gray-600" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="Close"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Window Content */}
        {!isMinimized && (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
            {children}
          </div>
        )}

      </div>
    </div>
  )
}