import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { processImport, ImportOptions } from '@/lib/import-service'
import { validateCSVData } from '@/lib/csv-utils'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { csvData, mappings, module, options = {} } = body

    // Validate request
    if (!csvData || !mappings || !module) {
      return NextResponse.json({ 
        error: 'Missing required fields: csvData, mappings, module' 
      }, { status: 400 })
    }

    // Validate data before processing
    const validationResult = validateCSVData(csvData, mappings, module)
    if (!validationResult.isValid) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.errors
      }, { status: 400 })
    }

    console.log(`📥 Processing import request for ${module}: ${csvData.length} rows`)

    const importOptions: ImportOptions = {
      module,
      mappings,
      duplicateHandling: options.duplicateHandling || 'skip',
      batchSize: options.batchSize || 50,
      validateOnly: options.validateOnly || false
    }

    // Process the import
    const result = await processImport(csvData, importOptions, user.id)

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Import API error:', error)
    
    return NextResponse.json({
      error: 'Import failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Validate import data without processing
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { csvData, mappings, module } = body

    if (!csvData || !mappings || !module) {
      return NextResponse.json({ 
        error: 'Missing required fields: csvData, mappings, module' 
      }, { status: 400 })
    }

    // Run validation
    const validationResult = validateCSVData(csvData, mappings, module)
    
    return NextResponse.json(validationResult)

  } catch (error) {
    console.error('❌ Validation API error:', error)
    
    return NextResponse.json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}