'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDown, Plus, Settings } from 'lucide-react'
import TermsEditor from '@/components/terms/terms-editor'

interface PaymentTerm {
  id: string
  name: string
  description: string
  net_days: number
  discount_percent: number
  discount_days: number
  is_active: boolean
  is_default: boolean
}

interface TermsSelectorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function TermsSelector({ 
  value, 
  onChange, 
  placeholder = "Enter payment terms...",
  disabled = false,
  className = ""
}: TermsSelectorProps) {
  const [terms, setTerms] = useState<PaymentTerm[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchTerms()
  }, [])

  const fetchTerms = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name')

      if (error) throw error
      setTerms(data || [])
    } catch (error) {
      console.error('Error fetching payment terms:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTermSelect = (term: PaymentTerm) => {
    onChange(term.name)
    setIsDropdownOpen(false)
  }

  const handleTermCreated = (newTerm: PaymentTerm) => {
    // Refresh terms list and select the newly created term
    fetchTerms()
    onChange(newTerm.name)
    setIsEditorOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      {/* Input with dropdown button */}
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-20"
        />
        <div className="absolute right-1 top-1 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={disabled || isLoading}
            className="h-8 w-8 p-0"
            title="Select from existing terms"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsEditorOpen(true)}
            disabled={disabled}
            className="h-8 w-8 p-0"
            title="Manage payment terms"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-sm text-gray-500">Loading terms...</div>
          ) : terms.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No payment terms found</div>
          ) : (
            <>
              {terms.map((term) => (
                <div
                  key={term.id}
                  onClick={() => handleTermSelect(term)}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{term.name}</div>
                      {term.description && (
                        <div className="text-xs text-gray-500 mt-1">{term.description}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {term.net_days} days
                      {term.discount_percent > 0 && (
                        <span className="ml-1">({term.discount_percent}%)</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-200">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsDropdownOpen(false)
                    setIsEditorOpen(true)
                  }}
                  className="w-full justify-start p-3 h-auto text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Payment Terms
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}

      {/* Terms Editor Modal */}
      {isEditorOpen && (
        <TermsEditor
          onClose={() => setIsEditorOpen(false)}
          onTermCreated={handleTermCreated}
        />
      )}
    </div>
  )
}