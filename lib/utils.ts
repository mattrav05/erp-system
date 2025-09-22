import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatting utilities
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) return '0'
  return value.toFixed(decimals)
}

export function formatDate(date: string | Date): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US')
}

export function formatDateTime(date: string | Date): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US')
}

// Validation utilities  
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidSKU(sku: string): boolean {
  // SKU should be alphanumeric with hyphens, 3-20 characters
  const skuRegex = /^[A-Za-z0-9-]{3,20}$/
  return skuRegex.test(sku)
}

// Business logic utilities
export function calculateMarkup(cost: number, markupPercentage: number): number {
  return cost * (1 + markupPercentage / 100)
}

export function calculateMargin(sellingPrice: number, cost: number): number {
  if (sellingPrice === 0) return 0
  return ((sellingPrice - cost) / sellingPrice) * 100
}

export function calculateWeightedAverageCost(
  currentQty: number,
  currentCost: number,
  newQty: number,
  newCost: number
): number {
  const totalQty = currentQty + newQty
  if (totalQty === 0) return 0
  return ((currentQty * currentCost) + (newQty * newCost)) / totalQty
}

// Generate next number in sequence
export function generateNextNumber(prefix: string, lastNumber?: string): string {
  if (!lastNumber) {
    return `${prefix}-001`
  }
  
  const match = lastNumber.match(/-(\d+)$/)
  if (!match) {
    return `${prefix}-001`
  }
  
  const nextNum = parseInt(match[1]) + 1
  return `${prefix}-${nextNum.toString().padStart(3, '0')}`
}