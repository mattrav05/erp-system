import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useDefaultTaxRate() {
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(6.0) // Fallback to 6%
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDefaultTaxRate()
  }, [])

  const fetchDefaultTaxRate = async () => {
    try {
      // Get the default tax code from settings
      const { data: defaultTaxCode, error } = await supabase
        .from('tax_codes')
        .select('tax_rate')
        .eq('is_default', true)
        .eq('is_active', true)
        .single()

      if (error) {
        console.log('No default tax code found, using fallback rate of 6%')
        setDefaultTaxRate(6.0)
      } else {
        setDefaultTaxRate(defaultTaxCode.tax_rate || 6.0)
      }
    } catch (error) {
      console.error('Error fetching default tax rate:', error)
      setDefaultTaxRate(6.0) // Fallback to 6%
    } finally {
      setIsLoading(false)
    }
  }

  return { defaultTaxRate, isLoading, refetch: fetchDefaultTaxRate }
}