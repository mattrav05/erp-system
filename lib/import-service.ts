// Import service for handling database operations and import processing

import { supabase } from '@/lib/supabase'
import { transformData, validateCSVData } from '@/lib/csv-utils'

// Import modules
import { CustomerImportModule } from './import-modules/customers'
import { VendorImportModule } from './import-modules/vendors'
import { ProductImportModule } from './import-modules/products'
import { InventoryImportModule } from './import-modules/inventory'
import { SalesOrderImportModule } from './import-modules/sales-orders'
import { PurchaseOrderImportModule } from './import-modules/purchase-orders'
import { EstimateImportModule } from './import-modules/estimates'

// Type definitions for import modules
export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface FieldMapping {
  csvColumn: string;
  dbField: string;
  transform?: any;
  defaultValue?: any;
  dataType?: string;
}

export interface ImportPreview {
  totalRecords: number;
  sampleData: any[];
  fieldMappings: FieldMapping[];
}

export interface ImportResult {
  success: boolean;
  processed: number;
  errors: ValidationError[];
  results: any[];
}

export interface ImportJobData {
  jobId: string;
  onProgress?: (progress: number, message: string) => Promise<void>;
}

export interface ImportModule {
  name: string;
  description: string;
  availableFields: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    choices?: string[];
  }>;
  validateData(data: any[], fieldMappings: FieldMapping[]): Promise<ValidationError[]>;
  generatePreview(data: any[], fieldMappings: FieldMapping[]): Promise<ImportPreview>;
  importData(data: any[], fieldMappings: FieldMapping[], jobData: ImportJobData): Promise<ImportResult>;
  getExistingRecordCount(): Promise<number>;
  checkForDuplicates(data: any[]): Promise<{ field: string; values: string[] }[]>;
}

export interface ImportJobResult {
  success: boolean
  jobId: string
  totalRows: number
  imported: number
  failed: number
  skipped: number
  errors: string[]
  warnings: string[]
}

export interface ImportOptions {
  module: string
  mappings: any[]
  duplicateHandling: 'skip' | 'update' | 'create_new'
  batchSize?: number
  validateOnly?: boolean
}

// Import module registry
const importModules: Record<string, ImportModule> = {
  'customers': new CustomerImportModule(),
  'vendors': new VendorImportModule(), 
  'products': new ProductImportModule(),
  'inventory': new InventoryImportModule(),
  'sales_orders': new SalesOrderImportModule(),
  'sales-orders': new SalesOrderImportModule(), // Support both naming conventions
  'purchase_orders': new PurchaseOrderImportModule(),
  'purchase-orders': new PurchaseOrderImportModule(), // Support both naming conventions
  'estimates': new EstimateImportModule()
};

export function getImportModule(moduleName: string): ImportModule | null {
  return importModules[moduleName] || null;
}

export function getAllImportModules(): Record<string, ImportModule> {
  return importModules;
}

// Main import function
export async function processImport(
  data: any[],
  options: ImportOptions,
  userId: string
): Promise<ImportJobResult> {
  console.log(`🚀 Starting import process for ${options.module}`)
  
  // Create import job record
  const jobId = await createImportJob({
    userId,
    module: options.module,
    totalRows: data.length,
    mappings: options.mappings,
    fileName: 'import.csv' // TODO: Get actual filename
  })

  try {
    const result = await processModuleImport(data, options, jobId)
    
    // Update job with final results
    await updateImportJob(jobId, {
      status: result.success ? 'completed' : 'failed',
      rowsImported: result.imported,
      rowsFailed: result.failed,
      rowsSkipped: result.skipped,
      errors: result.errors,
      completedAt: new Date().toISOString()
    })

    return { ...result, jobId }
    
  } catch (error) {
    console.error('❌ Import process failed:', error)
    
    await updateImportJob(jobId, {
      status: 'failed',
      errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      completedAt: new Date().toISOString()
    })

    return {
      success: false,
      jobId,
      totalRows: data.length,
      imported: 0,
      failed: data.length,
      skipped: 0,
      errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: []
    }
  }
}

// Process import for specific modules using the new modular system
async function processModuleImport(
  data: any[],
  options: ImportOptions,
  jobId: string
): Promise<Omit<ImportJobResult, 'jobId'>> {
  
  // Try new modular system first
  const importModule = getImportModule(options.module);
  if (importModule) {
    const result = await importModule.importData(data, options.mappings, {
      jobId,
      onProgress: async (progress: number, message: string) => {
        await updateImportJob(jobId, {
          status: 'processing',
          progress,
          current_message: message
        });
      }
    });

    return {
      success: result.success,
      totalRows: data.length,
      imported: result.processed,
      failed: result.errors.length,
      skipped: 0, // Calculated differently in new system
      errors: result.errors.map(e => `Row ${e.row}: ${e.message}`),
      warnings: []
    };
  }

  // Fallback to legacy implementations for modules not yet converted
  switch (options.module) {
    case 'inventory':
      return await importInventory(data, options, jobId)
    default:
      throw new Error(`Import not implemented for module: ${options.module}`)
  }
}

// Customer import implementation
async function importCustomers(
  data: any[],
  options: ImportOptions,
  jobId: string
): Promise<Omit<ImportJobResult, 'jobId'>> {
  console.log(`👥 Processing ${data.length} customer records`)
  
  let imported = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []
  const warnings: string[] = []

  const batchSize = options.batchSize || 50
  const batches = chunkArray(data, batchSize)

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} records)`)
    
    for (const row of batch) {
      try {
        // Transform row data according to mappings
        const transformedData = transformRowData(row, options.mappings)
        
        // Validate required fields
        if (!transformedData.company_name) {
          failed++
          errors.push(`Row ${row._rowNumber}: Company name is required`)
          await createImportJobItem(jobId, row._rowNumber, 'failed', 'customers', row, null, ['Company name is required'])
          continue
        }

        // Check for duplicates
        const existingCustomer = await findExistingCustomer(transformedData)
        
        if (existingCustomer) {
          if (options.duplicateHandling === 'skip') {
            skipped++
            warnings.push(`Row ${row._rowNumber}: Customer "${transformedData.company_name}" already exists, skipped`)
            await createImportJobItem(jobId, row._rowNumber, 'skipped', 'customers', row, null, [], true, existingCustomer.id)
            continue
          } else if (options.duplicateHandling === 'update') {
            // Update existing customer
            const { error } = await supabase
              .from('customers')
              .update({
                ...transformedData,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingCustomer.id)

            if (error) {
              failed++
              errors.push(`Row ${row._rowNumber}: Failed to update customer - ${error.message}`)
              await createImportJobItem(jobId, row._rowNumber, 'failed', 'customers', row, null, [error.message])
            } else {
              imported++
              await createImportJobItem(jobId, row._rowNumber, 'success', 'customers', row, transformedData, [], false, existingCustomer.id)
            }
            continue
          }
        }

        // Insert new customer
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert([{
            ...transformedData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single()

        if (error) {
          failed++
          errors.push(`Row ${row._rowNumber}: Failed to create customer - ${error.message}`)
          await createImportJobItem(jobId, row._rowNumber, 'failed', 'customers', row, transformedData, [error.message])
        } else {
          imported++
          await createImportJobItem(jobId, row._rowNumber, 'success', 'customers', row, transformedData, [], false, newCustomer.id)
        }

      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Row ${row._rowNumber}: ${errorMessage}`)
        await createImportJobItem(jobId, row._rowNumber, 'failed', 'customers', row, null, [errorMessage])
      }
    }
    
    // Add small delay between batches to prevent overwhelming the database
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  console.log(`✅ Customer import completed: ${imported} imported, ${failed} failed, ${skipped} skipped`)

  return {
    success: failed === 0,
    totalRows: data.length,
    imported,
    failed,
    skipped,
    errors,
    warnings
  }
}

// Vendor import implementation
async function importVendors(
  data: any[],
  options: ImportOptions,
  jobId: string
): Promise<Omit<ImportJobResult, 'jobId'>> {
  console.log(`🏭 Processing ${data.length} vendor records`)
  
  let imported = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []
  const warnings: string[] = []

  for (const row of data) {
    try {
      // Transform row data according to mappings
      const transformedData = transformRowData(row, options.mappings)
      
      // Validate required fields
      if (!transformedData.vendor_name) {
        failed++
        errors.push(`Row ${row._rowNumber}: Vendor name is required`)
        await createImportJobItem(jobId, row._rowNumber, 'failed', 'vendors', row, null, ['Vendor name is required'])
        continue
      }

      // Check for duplicates by name
      const { data: existingVendor } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .ilike('vendor_name', transformedData.vendor_name)
        .single()
      
      if (existingVendor && options.duplicateHandling === 'skip') {
        skipped++
        warnings.push(`Row ${row._rowNumber}: Vendor "${transformedData.vendor_name}" already exists, skipped`)
        await createImportJobItem(jobId, row._rowNumber, 'skipped', 'vendors', row, null, [], true, existingVendor.id)
        continue
      }

      // Insert new vendor
      const { data: newVendor, error } = await supabase
        .from('vendors')
        .insert([{
          ...transformedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        failed++
        errors.push(`Row ${row._rowNumber}: Failed to create vendor - ${error.message}`)
        await createImportJobItem(jobId, row._rowNumber, 'failed', 'vendors', row, transformedData, [error.message])
      } else {
        imported++
        await createImportJobItem(jobId, row._rowNumber, 'success', 'vendors', row, transformedData, [], false, newVendor.id)
      }

    } catch (error) {
      failed++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Row ${row._rowNumber}: ${errorMessage}`)
      await createImportJobItem(jobId, row._rowNumber, 'failed', 'vendors', row, null, [errorMessage])
    }
  }

  console.log(`✅ Vendor import completed: ${imported} imported, ${failed} failed, ${skipped} skipped`)

  return {
    success: failed === 0,
    totalRows: data.length,
    imported,
    failed,
    skipped,
    errors,
    warnings
  }
}

// Product import implementation  
async function importProducts(
  data: any[],
  options: ImportOptions,
  jobId: string
): Promise<Omit<ImportJobResult, 'jobId'>> {
  console.log(`📦 Processing ${data.length} product records`)
  
  let imported = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []
  const warnings: string[] = []

  for (const row of data) {
    try {
      const transformedData = transformRowData(row, options.mappings)
      
      // Validate required fields
      if (!transformedData.name || !transformedData.sku) {
        failed++
        errors.push(`Row ${row._rowNumber}: Product name and SKU are required`)
        await createImportJobItem(jobId, row._rowNumber, 'failed', 'products', row, null, ['Product name and SKU are required'])
        continue
      }

      // Check for duplicate SKU
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id, sku')
        .eq('sku', transformedData.sku)
        .single()
      
      if (existingProduct && options.duplicateHandling === 'skip') {
        skipped++
        warnings.push(`Row ${row._rowNumber}: Product with SKU "${transformedData.sku}" already exists, skipped`)
        await createImportJobItem(jobId, row._rowNumber, 'skipped', 'products', row, null, [], true, existingProduct.id)
        continue
      }

      // Insert new product
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert([{
          ...transformedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        failed++
        errors.push(`Row ${row._rowNumber}: Failed to create product - ${error.message}`)
        await createImportJobItem(jobId, row._rowNumber, 'failed', 'products', row, transformedData, [error.message])
      } else {
        imported++
        
        // Create inventory record if quantity provided
        if (transformedData.quantity_on_hand !== undefined) {
          await supabase
            .from('inventory')
            .insert([{
              product_id: newProduct.id,
              quantity_on_hand: transformedData.quantity_on_hand || 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
        }
        
        await createImportJobItem(jobId, row._rowNumber, 'success', 'products', row, transformedData, [], false, newProduct.id)
      }

    } catch (error) {
      failed++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Row ${row._rowNumber}: ${errorMessage}`)
      await createImportJobItem(jobId, row._rowNumber, 'failed', 'products', row, null, [errorMessage])
    }
  }

  console.log(`✅ Product import completed: ${imported} imported, ${failed} failed, ${skipped} skipped`)

  return {
    success: failed === 0,
    totalRows: data.length,
    imported,
    failed,
    skipped,
    errors,
    warnings
  }
}

// Inventory import (separate from products)
async function importInventory(
  data: any[],
  options: ImportOptions,
  jobId: string
): Promise<Omit<ImportJobResult, 'jobId'>> {
  console.log(`📊 Processing ${data.length} inventory records`)
  
  let imported = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []
  const warnings: string[] = []

  for (const row of data) {
    try {
      const transformedData = transformRowData(row, options.mappings)
      
      // Find product by SKU
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, sku')
        .eq('sku', transformedData.sku)
        .single()

      if (productError || !product) {
        failed++
        errors.push(`Row ${row._rowNumber}: Product with SKU "${transformedData.sku}" not found`)
        await createImportJobItem(jobId, row._rowNumber, 'failed', 'inventory', row, null, [`Product with SKU "${transformedData.sku}" not found`])
        continue
      }

      // Update or create inventory record
      const { data: existingInventory } = await supabase
        .from('inventory')
        .select('id')
        .eq('product_id', product.id)
        .single()

      if (existingInventory) {
        // Update existing
        const { error } = await supabase
          .from('inventory')
          .update({
            quantity_on_hand: transformedData.quantity_on_hand || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingInventory.id)

        if (error) {
          failed++
          errors.push(`Row ${row._rowNumber}: Failed to update inventory - ${error.message}`)
          await createImportJobItem(jobId, row._rowNumber, 'failed', 'inventory', row, transformedData, [error.message])
        } else {
          imported++
          await createImportJobItem(jobId, row._rowNumber, 'success', 'inventory', row, transformedData, [], false, existingInventory.id)
        }
      } else {
        // Create new
        const { data: newInventory, error } = await supabase
          .from('inventory')
          .insert([{
            product_id: product.id,
            quantity_on_hand: transformedData.quantity_on_hand || 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single()

        if (error) {
          failed++
          errors.push(`Row ${row._rowNumber}: Failed to create inventory - ${error.message}`)
          await createImportJobItem(jobId, row._rowNumber, 'failed', 'inventory', row, transformedData, [error.message])
        } else {
          imported++
          await createImportJobItem(jobId, row._rowNumber, 'success', 'inventory', row, transformedData, [], false, newInventory.id)
        }
      }

    } catch (error) {
      failed++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Row ${row._rowNumber}: ${errorMessage}`)
      await createImportJobItem(jobId, row._rowNumber, 'failed', 'inventory', row, null, [errorMessage])
    }
  }

  return {
    success: failed === 0,
    totalRows: data.length,
    imported,
    failed,
    skipped,
    errors,
    warnings
  }
}

// Helper functions
function transformRowData(row: any, mappings: any[]): any {
  const result: any = {}
  
  for (const mapping of mappings) {
    if (!mapping.dbField || !mapping.csvColumn) continue
    
    let value = row[mapping.csvColumn]
    
    // Apply transformations
    if (value && mapping.transform) {
      value = transformData(value, mapping.transform)
    }
    
    // Apply default value if empty
    if ((value === '' || value === null || value === undefined) && mapping.defaultValue !== undefined) {
      value = mapping.defaultValue
    }
    
    // Type conversion
    if (value !== null && value !== undefined && value !== '') {
      switch (mapping.dataType) {
        case 'number':
        case 'currency':
          value = parseFloat(String(value).replace(/[^\d.-]/g, '')) || 0
          break
        case 'boolean':
          value = ['true', '1', 'yes', 'y'].includes(String(value).toLowerCase())
          break
        case 'date':
          value = new Date(value).toISOString()
          break
      }
    }
    
    result[mapping.dbField] = value
  }
  
  return result
}

async function findExistingCustomer(customerData: any) {
  // Look for existing customer by company name or email
  let query = supabase
    .from('customers')
    .select('id, company_name, email')
  
  if (customerData.email) {
    query = query.or(`company_name.ilike.${customerData.company_name},email.eq.${customerData.email}`)
  } else {
    query = query.ilike('company_name', customerData.company_name)
  }
  
  const { data } = await query.single()
  return data
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

// Database helper functions
async function createImportJob(params: {
  userId: string
  module: string
  totalRows: number
  mappings: any[]
  fileName: string
}): Promise<string> {
  const { data, error } = await supabase
    .from('import_jobs')
    .insert([{
      user_id: params.userId,
      module: params.module,
      file_name: params.fileName,
      total_rows: params.totalRows,
      status: 'processing',
      started_at: new Date().toISOString(),
      mapping_used: params.mappings
    }])
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

async function updateImportJob(jobId: string, updates: any): Promise<void> {
  const { error } = await supabase
    .from('import_jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)

  if (error) throw error
}

async function createImportJobItem(
  jobId: string,
  rowNumber: number,
  status: string,
  entityType: string,
  originalData: any,
  processedData: any,
  errors: string[],
  isDuplicate: boolean = false,
  entityId?: string
): Promise<void> {
  const { error } = await supabase
    .from('import_job_items')
    .insert([{
      job_id: jobId,
      row_number: rowNumber,
      status,
      entity_type: entityType,
      entity_id: entityId,
      original_data: originalData,
      processed_data: processedData,
      validation_errors: errors,
      is_duplicate: isDuplicate
    }])

  if (error) {
    console.error('Failed to create import job item:', error)
    // Don't throw here as it would fail the entire import
  }
}