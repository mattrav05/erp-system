'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, ChevronDown, Receipt, FileX, Percent } from 'lucide-react'

interface TaxCode {
  id: string
  code: string
  description: string
  tax_rate: number
  is_active: boolean
  is_default: boolean
}

interface TaxCodeDropdownProps {
  value?: string
  onChange: (taxCode: TaxCode | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  compact?: boolean // When true, only shows the code when selected
}

export default function TaxCodeDropdown({ 
  value, 
  onChange, 
  placeholder = "Select tax code...", 
  disabled = false,
  className = "",
  compact = false
}: TaxCodeDropdownProps) {
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedTaxCode, setSelectedTaxCode] = useState<TaxCode | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // New tax code form
  const [newTaxCode, setNewTaxCode] = useState({
    code: '',
    description: '',
    tax_rate: 0,
    is_active: true
  })

  useEffect(() => {
    fetchTaxCodes()
  }, [])

  useEffect(() => {
    // Find selected tax code by value
    const found = taxCodes.find(tc => tc.code === value)
    setSelectedTaxCode(found || null)
  }, [value, taxCodes])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getDefaultTaxCodes = (): TaxCode[] => [
    {
      id: '1',
      code: 'TAX',
      description: 'Standard Tax',
      tax_rate: 8.5,
      is_active: true,
      is_default: true
    },
    {
      id: '2',
      code: 'NON',
      description: 'Non-Taxable',
      tax_rate: 0,
      is_active: true,
      is_default: false
    },
    {
      id: '3',
      code: 'EXE',
      description: 'Tax Exempt',
      tax_rate: 0,
      is_active: true,
      is_default: false
    }
  ]

  const fetchTaxCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('tax_codes')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('code')

      if (error) {
        // If table doesn't exist, use default codes
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.log('Tax codes table does not exist, using default codes')
          setTaxCodes(getDefaultTaxCodes())
        } else {
          throw error
        }
      } else {
        if (!data || data.length === 0) {
          setTaxCodes(getDefaultTaxCodes())
        } else {
          setTaxCodes(data)
        }
      }
    } catch (error) {
      console.error('Error fetching tax codes:', error)
      setTaxCodes(getDefaultTaxCodes())
    }
  }

  const handleSelect = (taxCode: TaxCode) => {
    setSelectedTaxCode(taxCode)
    onChange(taxCode)
    setIsOpen(false)
  }

  const handleAddNew = () => {
    setNewTaxCode({
      code: '',
      description: '',
      tax_rate: 0,
      is_active: true
    })
    setShowAddModal(true)
  }

  const handleSaveNew = async () => {
    try {
      const taxCode: TaxCode = {
        id: Date.now().toString(),
        ...newTaxCode,
        is_default: false
      }

      // Add to local state
      setTaxCodes(prev => [...prev, taxCode])
      
      // Select the new tax code
      handleSelect(taxCode)
      
      setShowAddModal(false)
      
      // TODO: Save to database when table exists
      console.log('New tax code created:', taxCode)
    } catch (error) {
      console.error('Error creating tax code:', error)
    }
  }

  return (
    <>
      <div ref={dropdownRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full flex items-center justify-between px-3 py-2 text-left border border-gray-300 rounded-md shadow-sm bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'hover:border-gray-400'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {selectedTaxCode ? (
              compact ? (
                // Compact mode: only show the code
                <span className="font-medium text-sm">{selectedTaxCode.code}</span>
              ) : (
                // Full mode: show icon, code, description, and percentage
                <>
                  <div className="flex-shrink-0">
                    {selectedTaxCode.tax_rate > 0 ? (
                      <Receipt className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <FileX className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <span className="font-medium">{selectedTaxCode.code}</span>
                  <span className="text-gray-500 truncate">{selectedTaxCode.description}</span>
                  {selectedTaxCode.tax_rate > 0 && (
                    <div className="flex items-center text-gray-400 flex-shrink-0">
                      <span className="text-xs">({selectedTaxCode.tax_rate}%)</span>
                    </div>
                  )}
                </>
              )
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
          </div>
          {!disabled && <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {taxCodes.map((taxCode) => (
              <button
                key={taxCode.id}
                type="button"
                onClick={() => handleSelect(taxCode)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0">
                    {taxCode.tax_rate > 0 ? (
                      <Receipt className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <FileX className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{taxCode.code}</span>
                      {taxCode.is_default && (
                        <span className="px-1 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{taxCode.description}</span>
                      {taxCode.tax_rate > 0 && (
                        <div className="flex items-center text-gray-400">
                          <Percent className="w-3 h-3 mr-1" />
                          <span className="text-xs">{taxCode.tax_rate}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            
            {/* Add New Tax Code Option */}
            <div className="border-t border-gray-200">
              <button
                type="button"
                onClick={handleAddNew}
                className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none text-blue-600 font-medium"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Add New Tax Code</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add New Tax Code Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Add New Tax Code</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddModal(false)}
              >
                ×
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Code *
                </label>
                <Input
                  value={newTaxCode.code}
                  onChange={(e) => setNewTaxCode(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., TAX, NON, EXE"
                  maxLength={10}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <Input
                  value={newTaxCode.description}
                  onChange={(e) => setNewTaxCode(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Standard Sales Tax"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Rate (%)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newTaxCode.tax_rate}
                    onChange={(e) => setNewTaxCode(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="pr-8"
                  />
                  <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 px-4 py-4 border-t bg-gray-50">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveNew}
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={!newTaxCode.code.trim() || !newTaxCode.description.trim()}
              >
                Add Tax Code
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}