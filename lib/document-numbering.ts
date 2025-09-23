import { supabase } from '@/lib/supabase'

export interface DocumentNumberConfig {
  prefix: string
  nextNumber: number
  format?: string
}

/**
 * Generate a document number from a format string and number
 * @param format - Format string like "EST-######" or "INV-2024-###"
 * @param number - The number to insert
 * @returns Formatted document number
 */
export function generateFormattedNumber(format: string, number: number): string {
  // Replace # placeholders with padded numbers
  let result = format
  const hashCount = (format.match(/#/g) || []).length
  if (hashCount > 0) {
    const paddedNumber = String(number).padStart(hashCount, '0')
    result = format.replace(/#+/, paddedNumber)
  }
  return result
}

/**
 * Get the next document number for a given document type
 * @param documentType - Type of document ('estimate', 'invoice', 'sales_order', 'purchase_order')
 * @returns Promise with the next formatted document number
 */
export async function getNextDocumentNumber(documentType: string): Promise<string> {
  try {
    // Get company settings for this document type
    const { data: settings, error } = await supabase
      .from('company_settings')
      .select(`${documentType}_prefix, ${documentType}_next_number`)
      .eq('is_active', true)
      .single()

    if (error) throw error

    const prefix = (settings as any)[`${documentType}_prefix`] || getDefaultPrefix(documentType)
    const nextNumber = (settings as any)[`${documentType}_next_number`] || 1

    // Use default format if no custom format is stored
    const format = `${prefix}-######`

    return generateFormattedNumber(format, nextNumber)
  } catch (error) {
    console.error(`Error getting next ${documentType} number:`, error)
    // Fallback to default format
    const prefix = getDefaultPrefix(documentType)
    return generateFormattedNumber(`${prefix}-######`, 1)
  }
}

/**
 * Increment the next number for a document type in the database
 * @param documentType - Type of document
 * @returns Promise that resolves when the number is incremented
 */
export async function incrementDocumentNumber(documentType: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_document_number', {
      doc_type: documentType
    })

    if (error) {
      // Fallback: manually increment
      const { data: settings, error: fetchError } = await supabase
        .from('company_settings')
        .select(`${documentType}_next_number`)
        .eq('is_active', true)
        .single()

      if (fetchError) throw fetchError

      const currentNumber = (settings as any)[`${documentType}_next_number`] || 1
      const updateData: any = {}
      updateData[`${documentType}_next_number`] = currentNumber + 1

      const { error: updateError } = await supabase
        .from('company_settings')
        .update(updateData)
        .eq('is_active', true)

      if (updateError) throw updateError
    }
  } catch (error) {
    console.error(`Error incrementing ${documentType} number:`, error)
    throw error
  }
}

/**
 * Get default prefix for a document type
 */
function getDefaultPrefix(documentType: string): string {
  switch (documentType) {
    case 'estimate': return 'EST'
    case 'invoice': return 'INV'
    case 'sales_order': return 'SO'
    case 'purchase_order': return 'PO'
    default: return 'DOC'
  }
}

/**
 * Validate a document number format
 * @param format - Format string to validate
 * @returns Whether the format is valid
 */
export function validateDocumentFormat(format: string): boolean {
  // Must contain at least one # placeholder or be a complete number
  return format.includes('#') || /\d/.test(format)
}

/**
 * Extract the numeric part from a document number
 * @param documentNumber - Full document number like "EST-000123"
 * @returns The numeric part as a number
 */
export function extractNumberFromDocument(documentNumber: string): number {
  const match = documentNumber.match(/(\d+)(?!.*\d)/) // Last number in string
  return match ? parseInt(match[1]) : 0
}