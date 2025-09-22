/**
 * TOOLTIP COMPONENT
 * 
 * Simple tooltip implementation for user interface
 */

'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  children: ReactNode
}

interface TooltipContentProps {
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}

interface TooltipTriggerProps {
  children: ReactNode
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function Tooltip({ children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [content, setContent] = useState<ReactNode>(null)
  const [side, setSide] = useState<'top' | 'bottom' | 'left' | 'right'>('top')
  const triggerRef = useRef<HTMLDivElement>(null)

  const showTooltip = (contentNode: ReactNode, tooltipSide: 'top' | 'bottom' | 'left' | 'right' = 'top') => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    let x = rect.left + rect.width / 2
    let y = rect.top

    switch (tooltipSide) {
      case 'bottom':
        y = rect.bottom + 8
        break
      case 'top':
        y = rect.top - 8
        break
      case 'left':
        x = rect.left - 8
        y = rect.top + rect.height / 2
        break
      case 'right':
        x = rect.right + 8
        y = rect.top + rect.height / 2
        break
    }

    setPosition({ x, y })
    setContent(contentNode)
    setSide(tooltipSide)
    setIsVisible(true)
  }

  const hideTooltip = () => {
    setIsVisible(false)
  }

  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      if (child.type === TooltipTrigger) {
        return React.cloneElement(child, { triggerRef, showTooltip, hideTooltip } as any)
      }
      if (child.type === TooltipContent) {
        return React.cloneElement(child, { showTooltip } as any)
      }
    }
    return child
  })

  return (
    <>
      {childrenWithProps}
      {isVisible && content && typeof document !== 'undefined' && createPortal(
        <div
          className={`
            fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded shadow-lg
            pointer-events-none transition-opacity duration-200
            ${side === 'top' ? 'transform -translate-x-1/2 -translate-y-full' : ''}
            ${side === 'bottom' ? 'transform -translate-x-1/2' : ''}
            ${side === 'left' ? 'transform -translate-x-full -translate-y-1/2' : ''}
            ${side === 'right' ? 'transform -translate-y-1/2' : ''}
          `}
          style={{ left: position.x, top: position.y }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  )
}

export function TooltipTrigger({ 
  children, 
  triggerRef, 
  showTooltip, 
  hideTooltip 
}: TooltipTriggerProps & {
  triggerRef?: React.RefObject<HTMLDivElement>
  showTooltip?: (content: ReactNode, side?: 'top' | 'bottom' | 'left' | 'right') => void
  hideTooltip?: () => void
}) {
  return (
    <div
      ref={triggerRef}
      onMouseEnter={() => {
        const tooltipContent = React.Children.toArray(children).find(
          child => React.isValidElement(child) && child.type === TooltipContent
        ) as React.ReactElement
        
        if (tooltipContent && showTooltip) {
          showTooltip((tooltipContent.props as any).children, (tooltipContent.props as any).side)
        }
      }}
      onMouseLeave={hideTooltip}
      className="inline-block"
    >
      {React.Children.toArray(children).filter(
        child => !(React.isValidElement(child) && child.type === TooltipContent)
      )}
    </div>
  )
}

export function TooltipContent({ children, side = 'top' }: TooltipContentProps) {
  return null // This component is used for data only
}

import React from 'react'