'use client'

import { useState, useEffect, useRef, ReactNode, cloneElement, isValidElement } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuOption {
  id: string
  label: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
  separator?: boolean
}

interface ContextMenuProps {
  options: ContextMenuOption[]
  children: ReactNode
  className?: string
}

export default function ContextMenu({ options, children, className }: ContextMenuProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    
    const x = e.clientX
    const y = e.clientY
    
    // Adjust position if menu would go off screen
    const menuWidth = 200 // Approximate menu width
    const menuHeight = options.length * 36 // Approximate item height
    
    const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x
    const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y
    
    setPosition({ x: adjustedX, y: adjustedY })
    setIsVisible(true)
  }

  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setIsVisible(false)
    }
  }

  const handleOptionClick = (option: ContextMenuOption) => {
    if (!option.disabled) {
      option.onClick()
      setIsVisible(false)
    }
  }

  useEffect(() => {
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          setIsVisible(false)
        }
      })
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isVisible])

  // Clone the child element and add the context menu handler
  const childWithContextMenu = isValidElement(children) 
    ? cloneElement(children as React.ReactElement<any>, {
        onContextMenu: handleContextMenu,
        className: className ? `${(children.props as any)?.className || ''} ${className}`.trim() : (children.props as any)?.className
      })
    : children

  return (
    <>
      {childWithContextMenu}

      {isVisible && mounted && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[200px]"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          {options.map((option, index) => (
            <div key={option.id}>
              {option.separator && index > 0 && (
                <div className="border-t border-gray-100 my-1" />
              )}
              <button
                onClick={() => handleOptionClick(option)}
                disabled={option.disabled}
                className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-3 transition-colors ${
                  option.disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {option.icon && (
                  <span className="flex-shrink-0">{option.icon}</span>
                )}
                <span>{option.label}</span>
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}