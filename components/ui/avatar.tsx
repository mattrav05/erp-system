/**
 * AVATAR COMPONENT
 * 
 * Simple avatar component for user display
 */

'use client'

import { ReactNode } from 'react'

interface AvatarProps {
  children: ReactNode
  className?: string
}

export function Avatar({ children, className = '' }: AvatarProps) {
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      {children}
    </div>
  )
}

export function AvatarImage({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="w-full h-full object-cover rounded-full" />
}

export function AvatarFallback({ children }: { children: ReactNode }) {
  return <div className="w-full h-full flex items-center justify-center text-sm font-medium">{children}</div>
}