// CSV parsing and validation utilities for import/export system

export interface CSVParseOptions {
  delimiter?: string
  skipHeaderRows?: number
  encoding?: string
  maxRows?: number
  columns?: string[]
}

export interface CSVValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  rowCount: number
  columnCount: number
  headers: string[]
  sampleData: any[]
}

// Validation utility functions
export function validateRequired(value: any, fieldName: string): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    return { type: 'error', message: `${fieldName} is required`, row: 0, column: fieldName }
  }
  return null
}

export function validateDate(value: any, fieldName: string): ValidationError | null {
  if (!value) return null
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return { type: 'error', message: `${fieldName} must be a valid date`, row: 0, column: fieldName }
  }
  return null
}

export function validateNumber(value: any, fieldName: string): ValidationError | null {
  if (!value) return null
  const num = parseFloat(value)
  if (isNaN(num)) {
    return { type: 'error', message: `${fieldName} must be a valid number`, row: 0, column: fieldName }
  }
  return null
}

export function validateChoice(value: any, fieldName: string, choices: string[]): ValidationError | null {
  if (!value) return null
  if (!choices.includes(value)) {
    return { type: 'error', message: `${fieldName} must be one of: ${choices.join(', ')}`, row: 0, column: fieldName }
  }
  return null
}

export interface ValidationError {
  row?: number
  column?: string
  message: string
  value?: any
  type: 'missing_required' | 'invalid_format' | 'invalid_type' | 'duplicate' | 'relationship_error'
}

export interface ValidationWarning {
  row?: number
  column?: string
  message: string
  value?: any
  type: 'empty_value' | 'unknown_column' | 'data_truncation' | 'suspicious_value'
}

export interface FieldMapping {
  csvColumn: string
  dbField: string
  required?: boolean
  dataType?: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone' | 'currency'
  transform?: string
  defaultValue?: any
  maxLength?: number
  validValues?: any[]
}

// Parse CSV content into array of objects
export function parseCSV(content: string, options: CSVParseOptions = {}): any[] {
  console.log('📊 Starting CSV parse with options:', options)
  
  const delimiter = options.delimiter || ','
  const skipRows = options.skipHeaderRows || 1
  
  try {
    const lines = content.trim().split('\n')
    
    if (lines.length <= skipRows) {
      console.warn('CSV file has no data rows after skipping headers')
      return []
    }
    
    // Parse headers
    const headerLine = lines[skipRows - 1]
    const headers = parseCSVLine(headerLine, delimiter).map(h => h.trim())
    console.log('📋 Detected headers:', headers)
    
    // Parse data rows
    const data: any[] = []
    for (let i = skipRows; i < lines.length; i++) {
      if (options.maxRows && data.length >= options.maxRows) {
        console.log(`⚠️ Reached max rows limit (${options.maxRows})`)
        break
      }
      
      const line = lines[i].trim()
      if (!line) continue // Skip empty lines
      
      const values = parseCSVLine(line, delimiter)
      const row: any = {}
      
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      
      data.push({
        _rowNumber: i + 1,
        ...row
      })
    }
    
    console.log(`✅ Successfully parsed ${data.length} rows`)
    return data
    
  } catch (error) {
    console.error('❌ CSV parse error:', error)
    throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  // Add last field
  result.push(current)
  
  return result
}

// Validate CSV data against field mappings
export function validateCSVData(
  data: any[],
  mappings: FieldMapping[],
  module: string
): CSVValidationResult {
  console.log(`🔍 Validating ${data.length} rows for module: ${module}`)
  
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const headers = data.length > 0 ? Object.keys(data[0]).filter(k => k !== '_rowNumber') : []
  
  // Check for required columns
  const requiredMappings = mappings.filter(m => m.required)
  for (const mapping of requiredMappings) {
    if (!headers.includes(mapping.csvColumn)) {
      errors.push({
        column: mapping.csvColumn,
        message: `Required column "${mapping.csvColumn}" is missing`,
        type: 'missing_required'
      })
    }
  }
  
  // Check for unknown columns
  const mappedColumns = mappings.map(m => m.csvColumn)
  for (const header of headers) {
    if (!mappedColumns.includes(header)) {
      warnings.push({
        column: header,
        message: `Unknown column "${header}" will be ignored`,
        type: 'unknown_column'
      })
    }
  }
  
  // Validate each row
  const seenValues = new Map<string, Set<any>>()
  
  for (const row of data) {
    const rowNumber = row._rowNumber
    
    for (const mapping of mappings) {
      const value = row[mapping.csvColumn]
      
      // Check required fields
      if (mapping.required && (!value || value === '')) {
        errors.push({
          row: rowNumber,
          column: mapping.csvColumn,
          message: `Required field is empty`,
          type: 'missing_required'
        })
        continue
      }
      
      // Skip validation for empty non-required fields
      if (!value || value === '') continue
      
      // Validate data type
      if (mapping.dataType) {
        const typeError = validateDataType(value, mapping.dataType)
        if (typeError) {
          errors.push({
            row: rowNumber,
            column: mapping.csvColumn,
            message: typeError,
            value,
            type: 'invalid_type'
          })
        }
      }
      
      // Check max length
      if (mapping.maxLength && String(value).length > mapping.maxLength) {
        warnings.push({
          row: rowNumber,
          column: mapping.csvColumn,
          message: `Value will be truncated to ${mapping.maxLength} characters`,
          value,
          type: 'data_truncation'
        })
      }
      
      // Check valid values
      if (mapping.validValues && mapping.validValues.length > 0) {
        if (!mapping.validValues.includes(value)) {
          errors.push({
            row: rowNumber,
            column: mapping.csvColumn,
            message: `Invalid value. Must be one of: ${mapping.validValues.join(', ')}`,
            value,
            type: 'invalid_format'
          })
        }
      }
      
      // Track for duplicate detection
      const key = `${mapping.dbField}`
      if (!seenValues.has(key)) {
        seenValues.set(key, new Set())
      }
      
      if (seenValues.get(key)?.has(value)) {
        warnings.push({
          row: rowNumber,
          column: mapping.csvColumn,
          message: `Duplicate value found in file`,
          value,
          type: 'suspicious_value'
        })
      }
      
      seenValues.get(key)?.add(value)
    }
  }
  
  const sampleData = data.slice(0, 5).map(row => {
    const { _rowNumber, ...rest } = row
    return rest
  })
  
  console.log(`✅ Validation complete: ${errors.length} errors, ${warnings.length} warnings`)
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    rowCount: data.length,
    columnCount: headers.length,
    headers,
    sampleData
  }
}

// Validate data type
function validateDataType(value: any, dataType: string): string | null {
  const stringValue = String(value).trim()
  
  switch (dataType) {
    case 'number':
      if (isNaN(Number(stringValue))) {
        return 'Value must be a valid number'
      }
      break
      
    case 'boolean':
      const validBooleans = ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n']
      if (!validBooleans.includes(stringValue.toLowerCase())) {
        return 'Value must be true/false, yes/no, or 1/0'
      }
      break
      
    case 'date':
      if (isNaN(Date.parse(stringValue))) {
        return 'Value must be a valid date'
      }
      break
      
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(stringValue)) {
        return 'Value must be a valid email address'
      }
      break
      
    case 'phone':
      const phoneRegex = /^[\d\s\-\+\(\)]+$/
      if (!phoneRegex.test(stringValue)) {
        return 'Value must be a valid phone number'
      }
      break
      
    case 'currency':
      const currencyValue = stringValue.replace(/[$,]/g, '')
      if (isNaN(Number(currencyValue))) {
        return 'Value must be a valid currency amount'
      }
      break
  }
  
  return null
}

// Transform data based on mapping rules
export function transformData(value: any, transform?: string): any {
  if (!transform || !value) return value
  
  const stringValue = String(value).trim()
  
  switch (transform) {
    case 'uppercase':
      return stringValue.toUpperCase()
      
    case 'lowercase':
      return stringValue.toLowerCase()
      
    case 'trim':
      return stringValue
      
    case 'remove_special':
      return stringValue.replace(/[^a-zA-Z0-9\s]/g, '')
      
    case 'numbers_only':
      return stringValue.replace(/\D/g, '')
      
    case 'boolean_yes_no':
      return ['yes', 'y', '1', 'true'].includes(stringValue.toLowerCase())
      
    case 'currency_to_number':
      return parseFloat(stringValue.replace(/[$,]/g, ''))
      
    case 'phone_normalize':
      return stringValue.replace(/\D/g, '').slice(-10)
      
    default:
      return value
  }
}

// Generate CSV content from data
export function generateCSV(
  data: any[],
  columns: { field: string; label: string }[],
  options: { delimiter?: string; includeHeaders?: boolean } = {}
): string {
  const delimiter = options.delimiter || ','
  const includeHeaders = options.includeHeaders !== false
  
  const lines: string[] = []
  
  // Add headers
  if (includeHeaders) {
    const headerLine = columns.map(col => escapeCSVValue(col.label)).join(delimiter)
    lines.push(headerLine)
  }
  
  // Add data rows
  for (const row of data) {
    const values = columns.map(col => {
      const value = getNestedProperty(row, col.field)
      return escapeCSVValue(value)
    })
    lines.push(values.join(delimiter))
  }
  
  return lines.join('\n')
}

// Escape CSV value for proper formatting
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) return ''
  
  const stringValue = String(value)
  
  // Check if value needs escaping
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Escape quotes by doubling them
    const escaped = stringValue.replace(/"/g, '""')
    return `"${escaped}"`
  }
  
  return stringValue
}

// Get nested property from object (e.g., "customer.name")
function getNestedProperty(obj: any, path: string): any {
  const keys = path.split('.')
  let result = obj
  
  for (const key of keys) {
    if (result === null || result === undefined) return ''
    result = result[key]
  }
  
  return result
}

// Detect CSV delimiter
export function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0]
  const delimiters = [',', ';', '\t', '|']
  
  let maxCount = 0
  let detectedDelimiter = ','
  
  for (const delimiter of delimiters) {
    const count = (firstLine.match(new RegExp(delimiter, 'g')) || []).length
    if (count > maxCount) {
      maxCount = count
      detectedDelimiter = delimiter
    }
  }
  
  console.log(`🔍 Detected delimiter: "${detectedDelimiter}" (found ${maxCount} occurrences)`)
  return detectedDelimiter
}

// Create default field mappings based on common patterns
export function suggestFieldMappings(headers: string[], module: string): FieldMapping[] {
  const mappings: FieldMapping[] = []
  
  // Common field patterns for each module
  const patterns: Record<string, Record<string, string[]>> = {
    customers: {
      company_name: ['company', 'company name', 'customer name', 'name', 'business name'],
      contact_name: ['contact', 'contact name', 'contact person', 'primary contact'],
      email: ['email', 'email address', 'e-mail'],
      phone: ['phone', 'telephone', 'phone number', 'tel'],
      address_line_1: ['address', 'address 1', 'address line 1', 'street', 'street address'],
      city: ['city', 'town'],
      state: ['state', 'province', 'region'],
      zip_code: ['zip', 'zip code', 'postal code', 'postcode'],
      credit_limit: ['credit limit', 'credit', 'limit']
    },
    products: {
      name: ['product name', 'item name', 'name', 'description', 'item'],
      sku: ['sku', 'item code', 'product code', 'code', 'part number'],
      cost: ['cost', 'unit cost', 'purchase price', 'buy price'],
      price: ['price', 'sell price', 'selling price', 'retail price', 'list price'],
      quantity_on_hand: ['quantity', 'qty', 'stock', 'on hand', 'inventory']
    }
  }
  
  const modulePatterns = patterns[module] || {}
  
  for (const header of headers) {
    const lowerHeader = header.toLowerCase().trim()
    let matched = false
    
    for (const [dbField, patterns] of Object.entries(modulePatterns)) {
      if (patterns.some(pattern => lowerHeader === pattern)) {
        mappings.push({
          csvColumn: header,
          dbField,
          required: ['company_name', 'name', 'sku'].includes(dbField),
          dataType: getFieldDataType(dbField)
        })
        matched = true
        break
      }
    }
    
    if (!matched) {
      // Add unmapped field for user to configure
      mappings.push({
        csvColumn: header,
        dbField: '',
        required: false
      })
    }
  }
  
  console.log('🎯 Suggested mappings:', mappings)
  return mappings
}

// Get appropriate data type for field
function getFieldDataType(field: string): FieldMapping['dataType'] {
  if (field.includes('email')) return 'email'
  if (field.includes('phone')) return 'phone'
  if (field.includes('price') || field.includes('cost') || field.includes('limit')) return 'currency'
  if (field.includes('quantity') || field.includes('qty')) return 'number'
  if (field.includes('date')) return 'date'
  return 'string'
}