/**
 * Comprehensive error handling utilities for ERP operations
 * Provides detailed error messages for debugging and user feedback
 */

export interface ERPError {
  code: string
  message: string
  details?: any
  userMessage: string
  debugInfo?: any
  timestamp: string
  operation: string
  documentType: string
  documentId?: string
}

export interface SaveResult<T = any> {
  success: boolean
  data?: T
  error?: ERPError
}

/**
 * Database error codes and their meanings
 */
const DB_ERROR_CODES = {
  // PostgreSQL error codes
  '23505': 'DUPLICATE_KEY',
  '23503': 'FOREIGN_KEY_VIOLATION', 
  '23502': 'NOT_NULL_VIOLATION',
  '23514': 'CHECK_CONSTRAINT_VIOLATION',
  '42703': 'UNDEFINED_COLUMN',
  '42P01': 'UNDEFINED_TABLE',
  '25P02': 'IN_FAILED_TRANSACTION',
  '40001': 'SERIALIZATION_FAILURE',
  '53300': 'TOO_MANY_CONNECTIONS',
  
  // Supabase specific
  'PGRST116': 'NOT_FOUND',
  'PGRST301': 'PERMISSION_DENIED'
}

/**
 * User-friendly error messages
 */
const USER_MESSAGES = {
  DUPLICATE_KEY: 'This record already exists. Please check for duplicates.',
  FOREIGN_KEY_VIOLATION: 'Cannot save due to missing related data. Please check all linked records.',
  NOT_NULL_VIOLATION: 'Required fields are missing. Please fill in all required information.',
  CHECK_CONSTRAINT_VIOLATION: 'Invalid data format or values. Please check your input.',
  UNDEFINED_COLUMN: 'System error: Database structure issue. Please contact support.',
  UNDEFINED_TABLE: 'System error: Database table missing. Please contact support.',
  IN_FAILED_TRANSACTION: 'Save operation failed. Please try again.',
  SERIALIZATION_FAILURE: 'Conflict with another user\'s changes. Please refresh and try again.',
  TOO_MANY_CONNECTIONS: 'System is busy. Please try again in a moment.',
  NOT_FOUND: 'Record not found. It may have been deleted by another user.',
  PERMISSION_DENIED: 'You don\'t have permission to perform this action.',
  NETWORK_ERROR: 'Network connection issue. Please check your internet connection.',
  TIMEOUT_ERROR: 'Operation timed out. Please try again.',
  VALIDATION_ERROR: 'Please check your input data for errors.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again or contact support.'
}

/**
 * Create a standardized error object
 */
export function createERPError(
  operation: string,
  documentType: string,
  error: any,
  documentId?: string,
  additionalContext?: any
): ERPError {
  const timestamp = new Date().toISOString()
  
  // Parse database errors
  let code = 'UNKNOWN_ERROR'
  let userMessage = USER_MESSAGES.UNKNOWN_ERROR
  let details = error
  
  if (error?.code && DB_ERROR_CODES[error.code as keyof typeof DB_ERROR_CODES]) {
    code = DB_ERROR_CODES[error.code as keyof typeof DB_ERROR_CODES]
    userMessage = USER_MESSAGES[code as keyof typeof USER_MESSAGES]
  } else if (error?.message) {
    // Handle specific error patterns
    const message = error.message.toLowerCase()
    
    if (message.includes('network') || message.includes('fetch')) {
      code = 'NETWORK_ERROR'
      userMessage = USER_MESSAGES.NETWORK_ERROR
    } else if (message.includes('timeout')) {
      code = 'TIMEOUT_ERROR' 
      userMessage = USER_MESSAGES.TIMEOUT_ERROR
    } else if (message.includes('duplicate') || message.includes('already exists')) {
      code = 'DUPLICATE_KEY'
      userMessage = USER_MESSAGES.DUPLICATE_KEY
    } else if (message.includes('validation') || message.includes('invalid')) {
      code = 'VALIDATION_ERROR'
      userMessage = USER_MESSAGES.VALIDATION_ERROR
    }
  }
  
  // Enhance error messages with document context
  const contextualMessage = `${userMessage} (${documentType}${documentId ? ` #${documentId}` : ''})`
  
  return {
    code,
    message: error?.message || 'Unknown error',
    details,
    userMessage: contextualMessage,
    debugInfo: {
      originalError: error,
      additionalContext,
      stackTrace: error?.stack
    },
    timestamp,
    operation,
    documentType,
    documentId
  }
}

/**
 * Log error for debugging (in development) and monitoring
 */
export function logERPError(erpError: ERPError) {
  const logEntry = {
    timestamp: erpError.timestamp,
    level: 'ERROR',
    operation: erpError.operation,
    documentType: erpError.documentType,
    documentId: erpError.documentId,
    code: erpError.code,
    message: erpError.message,
    userMessage: erpError.userMessage
  }
  
  // In development, log full details
  if (process.env.NODE_ENV === 'development') {
    console.error('ERP Error:', {
      ...logEntry,
      details: erpError.details,
      debugInfo: erpError.debugInfo
    })
  } else {
    // In production, log without sensitive details
    console.error('ERP Error:', logEntry)
  }
  
  // TODO: Send to monitoring service (DataDog, Sentry, etc.)
  // sendToMonitoring(erpError)
}

/**
 * Validate common document fields
 */
export function validateDocument(documentType: string, data: any): string[] {
  const errors: string[] = []
  
  switch (documentType) {
    case 'sales_order':
      if (!data.customer_id) errors.push('Customer is required')
      if (!data.order_date) errors.push('Order date is required')
      if (!data.so_number) errors.push('Sales order number is required')
      if (!data.line_items || data.line_items.length === 0) {
        errors.push('At least one line item is required')
      }
      // Validate line items
      data.line_items?.forEach((item: any, index: number) => {
        if (!item.description?.trim()) {
          errors.push(`Line ${index + 1}: Description is required`)
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Line ${index + 1}: Quantity must be greater than 0`)
        }
        if (item.unit_price < 0) {
          errors.push(`Line ${index + 1}: Unit price cannot be negative`)
        }
      })
      break
      
    case 'invoice':
      if (!data.customer_id) errors.push('Customer is required')
      if (!data.invoice_date) errors.push('Invoice date is required')
      if (!data.invoice_number) errors.push('Invoice number is required')
      if (!data.line_items || data.line_items.length === 0) {
        errors.push('At least one line item is required')
      }
      // Check for partial invoice validation
      if (data.sales_order_id && data.is_partial_invoice) {
        if (!data.invoice_sequence) {
          errors.push('Invoice sequence is required for partial invoices')
        }
      }
      break
      
    case 'purchase_order':
      if (!data.vendor_id) errors.push('Vendor is required')
      if (!data.order_date) errors.push('Order date is required')
      if (!data.po_number) errors.push('Purchase order number is required')
      if (!data.line_items || data.line_items.length === 0) {
        errors.push('At least one line item is required')
      }
      break
      
    case 'estimate':
      if (!data.customer_id) errors.push('Customer is required')
      if (!data.estimate_date) errors.push('Estimate date is required')
      if (!data.estimate_number) errors.push('Estimate number is required')
      if (!data.line_items || data.line_items.length === 0) {
        errors.push('At least one line item is required')
      }
      break
      
    case 'purchase_order':
      if (!data.vendor_id) errors.push('Vendor is required')
      if (!data.order_date) errors.push('Order date is required')
      if (!data.po_number) errors.push('Purchase order number is required')
      if (!data.line_items || data.line_items.length === 0) {
        errors.push('At least one line item is required')
      }
      // Validate line items
      data.line_items?.forEach((item: any, index: number) => {
        if (!item.description?.trim()) {
          errors.push(`Line ${index + 1}: Description is required`)
        }
        if (!item.qty || item.qty <= 0) {
          errors.push(`Line ${index + 1}: Quantity must be greater than 0`)
        }
        if (item.rate < 0) {
          errors.push(`Line ${index + 1}: Unit price cannot be negative`)
        }
      })
      break
  }
  
  return errors
}

/**
 * Wrapper for save operations with comprehensive error handling
 */
export async function executeSaveOperation<T>(
  operation: string,
  documentType: string,
  documentId: string | undefined,
  saveFunction: () => Promise<T>,
  validationData?: any
): Promise<SaveResult<T>> {
  try {
    // Pre-save validation
    if (validationData) {
      const validationErrors = validateDocument(documentType, validationData)
      if (validationErrors.length > 0) {
        const error = createERPError(
          operation,
          documentType,
          new Error(`Validation failed: ${validationErrors.join(', ')}`),
          documentId,
          { validationErrors }
        )
        logERPError(error)
        return { success: false, error }
      }
    }
    
    const startTime = Date.now()
    const result = await saveFunction()
    const duration = Date.now() - startTime
    
    // Log successful operations (for performance monitoring)
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ ${operation} completed in ${duration}ms`, {
        documentType,
        documentId,
        timestamp: new Date().toISOString()
      })
    }
    
    return { success: true, data: result }
    
  } catch (error) {
    const erpError = createERPError(operation, documentType, error, documentId, validationData)
    logERPError(erpError)
    return { success: false, error: erpError }
  }
}

/**
 * Display user-friendly error messages
 */
export function displayError(error: ERPError, showDetails = false): string {
  if (showDetails && process.env.NODE_ENV === 'development') {
    return `${error.userMessage}\n\nTechnical details: ${error.message} (${error.code})`
  }
  return error.userMessage
}