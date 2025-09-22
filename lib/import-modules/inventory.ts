import { ImportModule, ImportResult, ValidationError, ImportPreview, FieldMapping, ImportJobData } from '../import-service';
import { supabase } from '../supabase';

export class InventoryImportModule implements ImportModule {
  name = 'Inventory';
  description = 'Import inventory items with quantities, locations, and QuickBooks integration';
  
  availableFields = [
    // Core Inventory Fields
    { key: 'product_sku', label: 'Product SKU', type: 'text', required: true, description: 'Must match existing product SKU' },
    { key: 'location_code', label: 'Location/Warehouse Code', type: 'text', required: true, description: 'Warehouse or location identifier' },
    { key: 'bin_location', label: 'Bin Location', type: 'text', description: 'Specific shelf or bin location' },
    
    // Quantity Fields
    { key: 'quantity_on_hand', label: 'Quantity on Hand', type: 'number', required: true, description: 'Current physical quantity' },
    { key: 'quantity_allocated', label: 'Quantity Allocated', type: 'number', description: 'Quantity reserved for orders' },
    { key: 'quantity_available', label: 'Quantity Available', type: 'number', description: 'Available for sale (on hand - allocated)' },
    { key: 'safety_stock', label: 'Safety Stock Level', type: 'number', description: 'Minimum safety stock to maintain' },
    { key: 'max_stock_level', label: 'Maximum Stock Level', type: 'number', description: 'Maximum stock level' },
    
    // Cost Fields
    { key: 'weighted_average_cost', label: 'Weighted Average Cost', type: 'number', description: 'Current weighted average cost' },
    { key: 'last_cost', label: 'Last Cost', type: 'number', description: 'Most recent purchase cost' },
    { key: 'sales_price', label: 'Sales Price', type: 'number', description: 'Current selling price' },
    
    // Pricing & Margin Fields
    { key: 'margin_percent', label: 'Margin %', type: 'number', description: 'Profit margin percentage (0-100)' },
    { key: 'markup_percent', label: 'Markup %', type: 'number', description: 'Markup percentage over cost' },
    
    // Tax Fields
    { key: 'default_tax_code', label: 'Default Tax Code', type: 'text', description: 'Tax code for this inventory item' },
    { key: 'default_tax_rate', label: 'Default Tax Rate', type: 'number', description: 'Tax rate percentage (0-100)' },
    
    // Tracking Options
    { key: 'track_serial_numbers', label: 'Track Serial Numbers', type: 'boolean', description: 'Enable serial number tracking' },
    { key: 'track_lot_numbers', label: 'Track Lot Numbers', type: 'boolean', description: 'Enable lot number tracking' },
    { key: 'abc_classification', label: 'ABC Classification', type: 'select', options: ['A', 'B', 'C'], description: 'ABC inventory classification' },
    
    // Inventory Management
    { key: 'lead_time_days', label: 'Lead Time (Days)', type: 'number', description: 'Replenishment lead time in days' },
    { key: 'last_physical_count_date', label: 'Last Physical Count Date', type: 'date', description: 'Date of last physical inventory count' },
    { key: 'variance_tolerance_percent', label: 'Variance Tolerance %', type: 'number', description: 'Acceptable variance percentage for counts' },
    
    // QuickBooks Integration Fields
    { key: 'qb_item_id', label: 'QuickBooks Item ID', type: 'text', description: 'QB Online Item ID for sync' },
    { key: 'qb_sync_token', label: 'QuickBooks Sync Token', type: 'text', description: 'QB sync token for updates' },
    { key: 'qb_last_sync', label: 'QB Last Sync Date', type: 'date', description: 'Last successful QB sync' },
    { key: 'qb_quantity_on_hand', label: 'QB Quantity on Hand', type: 'number', description: 'QB tracked quantity for reconciliation' },
    { key: 'qb_average_cost', label: 'QB Average Cost', type: 'number', description: 'QB calculated average cost' },
    { key: 'income_account', label: 'Income Account (QB)', type: 'text', description: 'QB income account' },
    { key: 'asset_account', label: 'Asset Account (QB)', type: 'text', description: 'QB asset account for inventory' },
    { key: 'expense_account', label: 'Expense Account (QB)', type: 'text', description: 'QB COGS expense account' },
    
    // Status & Notes
    { key: 'is_active', label: 'Is Active', type: 'boolean', description: 'Whether inventory item is active' },
    { key: 'notes', label: 'Notes', type: 'text', description: 'Additional notes or comments' },
  ];

  async validateData(data: any[], fieldMappings: FieldMapping[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const fieldMap = new Map(fieldMappings.map(fm => [fm.sourceField, fm.targetField]));

    // Get all product SKUs for validation
    const { data: products } = await supabase
      .from('products')
      .select('sku, id');
    
    const validSkus = new Set(products?.map(p => p.sku) || []);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Check required fields
      for (const field of this.availableFields.filter(f => f.required)) {
        const sourceField = [...fieldMap.entries()].find(([_, target]) => target === field.key)?.[0];
        if (!sourceField || !row[sourceField] || String(row[sourceField]).trim() === '') {
          errors.push({
            row: i + 1,
            field: field.key,
            message: `Required field '${field.label}' is missing or empty`,
            severity: 'error'
          });
        }
      }

      // Validate product SKU exists
      const skuSource = [...fieldMap.entries()].find(([_, target]) => target === 'product_sku')?.[0];
      if (skuSource && row[skuSource] && !validSkus.has(row[skuSource])) {
        errors.push({
          row: i + 1,
          field: 'product_sku',
          message: `Product SKU '${row[skuSource]}' not found. Must match existing product.`,
          severity: 'error'
        });
      }

      // Validate numeric fields
      const numericFields = [
        'quantity_on_hand', 'quantity_allocated', 'quantity_available', 'safety_stock', 'max_stock_level',
        'weighted_average_cost', 'last_cost', 'sales_price', 'margin_percent', 'markup_percent',
        'default_tax_rate', 'lead_time_days', 'variance_tolerance_percent', 'qb_quantity_on_hand', 'qb_average_cost'
      ];
      
      for (const fieldKey of numericFields) {
        const sourceField = [...fieldMap.entries()].find(([_, target]) => target === fieldKey)?.[0];
        if (sourceField && row[sourceField] && isNaN(Number(row[sourceField]))) {
          errors.push({
            row: i + 1,
            field: fieldKey,
            message: `'${this.availableFields.find(f => f.key === fieldKey)?.label}' must be a valid number`,
            severity: 'error'
          });
        }
      }

      // Validate quantity consistency
      const qohSource = [...fieldMap.entries()].find(([_, target]) => target === 'quantity_on_hand')?.[0];
      const allocatedSource = [...fieldMap.entries()].find(([_, target]) => target === 'quantity_allocated')?.[0];
      const availableSource = [...fieldMap.entries()].find(([_, target]) => target === 'quantity_available')?.[0];
      
      if (qohSource && allocatedSource && availableSource && 
          row[qohSource] && row[allocatedSource] && row[availableSource]) {
        const qoh = Number(row[qohSource]);
        const allocated = Number(row[allocatedSource]);
        const available = Number(row[availableSource]);
        
        if (available !== (qoh - allocated)) {
          errors.push({
            row: i + 1,
            field: 'quantity_available',
            message: `Available quantity should equal On Hand (${qoh}) minus Allocated (${allocated}) = ${qoh - allocated}`,
            severity: 'warning'
          });
        }
      }

      // Validate boolean fields
      const booleanFields = ['track_serial_numbers', 'track_lot_numbers', 'is_active'];
      for (const fieldKey of booleanFields) {
        const sourceField = [...fieldMap.entries()].find(([_, target]) => target === fieldKey)?.[0];
        if (sourceField && row[sourceField]) {
          const value = String(row[sourceField]).toLowerCase();
          if (!['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(value)) {
            errors.push({
              row: i + 1,
              field: fieldKey,
              message: `'${this.availableFields.find(f => f.key === fieldKey)?.label}' must be true/false, yes/no, or 1/0`,
              severity: 'error'
            });
          }
        }
      }

      // Validate ABC classification
      const abcSource = [...fieldMap.entries()].find(([_, target]) => target === 'abc_classification')?.[0];
      if (abcSource && row[abcSource] && !['A', 'B', 'C'].includes(row[abcSource])) {
        errors.push({
          row: i + 1,
          field: 'abc_classification',
          message: 'ABC Classification must be A, B, or C',
          severity: 'error'
        });
      }

      // Validate percentage ranges
      const percentageFields = ['margin_percent', 'markup_percent', 'default_tax_rate', 'variance_tolerance_percent'];
      for (const fieldKey of percentageFields) {
        const sourceField = [...fieldMap.entries()].find(([_, target]) => target === fieldKey)?.[0];
        if (sourceField && row[sourceField]) {
          const value = Number(row[sourceField]);
          if (!isNaN(value) && (value < 0 || value > 100)) {
            errors.push({
              row: i + 1,
              field: fieldKey,
              message: `'${this.availableFields.find(f => f.key === fieldKey)?.label}' must be between 0 and 100`,
              severity: 'warning'
            });
          }
        }
      }

      // Validate date formats
      const dateFields = ['last_physical_count_date', 'qb_last_sync'];
      for (const fieldKey of dateFields) {
        const sourceField = [...fieldMap.entries()].find(([_, target]) => target === fieldKey)?.[0];
        if (sourceField && row[sourceField]) {
          const date = new Date(row[sourceField]);
          if (isNaN(date.getTime())) {
            errors.push({
              row: i + 1,
              field: fieldKey,
              message: `'${this.availableFields.find(f => f.key === fieldKey)?.label}' must be a valid date format`,
              severity: 'error'
            });
          }
        }
      }
    }

    return errors;
  }

  async generatePreview(data: any[], fieldMappings: FieldMapping[]): Promise<ImportPreview> {
    return {
      totalRecords: data.length,
      sampleData: data.slice(0, 5),
      fieldMappings
    };
  }

  async importData(data: any[], fieldMappings: FieldMapping[], jobData: ImportJobData): Promise<ImportResult> {
    const results: ImportResult = {
      success: false,
      processed: 0,
      errors: [],
      results: []
    };

    const fieldMap = new Map(fieldMappings.map(fm => [fm.sourceField, fm.targetField]));

    // Helper function to get mapped value
    const getValue = (row: any, targetField: string) => {
      const sourceField = [...fieldMap.entries()].find(([_, target]) => target === targetField)?.[0];
      return sourceField ? row[sourceField] : null;
    };

    // Helper function to convert boolean values
    const parseBoolean = (value: any) => {
      if (value === null || value === undefined || value === '') return false;
      const str = String(value).toLowerCase();
      return ['true', '1', 'yes', 'y'].includes(str);
    };

    // Get product ID mapping
    const { data: products } = await supabase
      .from('products')
      .select('id, sku');
    
    const productSkuToId = new Map(products?.map(p => [p.sku, p.id]) || []);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const productSku = getValue(row, 'product_sku');
        const productId = productSkuToId.get(productSku);
        
        if (!productId) {
          results.errors.push({
            row: i + 1,
            field: 'product_sku',
            message: `Product SKU '${productSku}' not found`,
            severity: 'error'
          });
          continue;
        }

        // Prepare inventory data
        const inventoryData: any = {
          product_id: productId,
          location_code: getValue(row, 'location_code') || 'MAIN',
          bin_location: getValue(row, 'bin_location') || null,
          quantity_on_hand: getValue(row, 'quantity_on_hand') ? Number(getValue(row, 'quantity_on_hand')) : 0,
          quantity_allocated: getValue(row, 'quantity_allocated') ? Number(getValue(row, 'quantity_allocated')) : 0,
          quantity_available: getValue(row, 'quantity_available') ? 
            Number(getValue(row, 'quantity_available')) : 
            (Number(getValue(row, 'quantity_on_hand') || 0) - Number(getValue(row, 'quantity_allocated') || 0)),
          safety_stock: getValue(row, 'safety_stock') ? Number(getValue(row, 'safety_stock')) : null,
          max_stock_level: getValue(row, 'max_stock_level') ? Number(getValue(row, 'max_stock_level')) : null,
          weighted_average_cost: getValue(row, 'weighted_average_cost') ? Number(getValue(row, 'weighted_average_cost')) : 0,
          last_cost: getValue(row, 'last_cost') ? Number(getValue(row, 'last_cost')) : null,
          sales_price: getValue(row, 'sales_price') ? Number(getValue(row, 'sales_price')) : null,
          margin_percent: getValue(row, 'margin_percent') ? Number(getValue(row, 'margin_percent')) : null,
          markup_percent: getValue(row, 'markup_percent') ? Number(getValue(row, 'markup_percent')) : null,
          default_tax_code: getValue(row, 'default_tax_code') || null,
          default_tax_rate: getValue(row, 'default_tax_rate') ? Number(getValue(row, 'default_tax_rate')) : null,
          track_serial_numbers: parseBoolean(getValue(row, 'track_serial_numbers')),
          track_lot_numbers: parseBoolean(getValue(row, 'track_lot_numbers')),
          abc_classification: getValue(row, 'abc_classification') || null,
          lead_time_days: getValue(row, 'lead_time_days') ? Number(getValue(row, 'lead_time_days')) : null,
          last_physical_count_date: getValue(row, 'last_physical_count_date') ? 
            new Date(getValue(row, 'last_physical_count_date')).toISOString().split('T')[0] : null,
          variance_tolerance_percent: getValue(row, 'variance_tolerance_percent') ? 
            Number(getValue(row, 'variance_tolerance_percent')) : null,
          // QB fields
          qb_item_id: getValue(row, 'qb_item_id') || null,
          qb_sync_token: getValue(row, 'qb_sync_token') ? Number(getValue(row, 'qb_sync_token')) : 0,
          qb_last_sync: getValue(row, 'qb_last_sync') ? 
            new Date(getValue(row, 'qb_last_sync')).toISOString() : null,
          qb_quantity_on_hand: getValue(row, 'qb_quantity_on_hand') ? 
            Number(getValue(row, 'qb_quantity_on_hand')) : null,
          qb_average_cost: getValue(row, 'qb_average_cost') ? 
            Number(getValue(row, 'qb_average_cost')) : null,
          income_account: getValue(row, 'income_account') || null,
          asset_account: getValue(row, 'asset_account') || null,
          expense_account: getValue(row, 'expense_account') || null,
          qb_sync_status: 'pending',
          is_active: parseBoolean(getValue(row, 'is_active')) !== false, // Default to true if not specified
          notes: getValue(row, 'notes') || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Check for existing inventory record (product + location)
        const { data: existing } = await supabase
          .from('inventory')
          .select('id')
          .eq('product_id', productId)
          .eq('location_code', inventoryData.location_code)
          .single();

        let result;
        if (existing && jobData.duplicateStrategy === 'update') {
          // Update existing inventory
          const { data: updated, error } = await supabase
            .from('inventory')
            .update({
              ...inventoryData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;
          result = updated;
          results.results.push({
            action: 'updated',
            record: result,
            rowNumber: i + 1
          });
        } else if (existing && jobData.duplicateStrategy === 'skip') {
          // Skip existing inventory
          results.results.push({
            action: 'skipped',
            record: existing,
            rowNumber: i + 1
          });
          results.processed++;
          continue;
        } else {
          // Insert new inventory record
          if (existing && jobData.duplicateStrategy === 'create_new') {
            // Modify location to make it unique
            inventoryData.location_code = `${inventoryData.location_code}_${Date.now()}`;
          }

          const { data: inserted, error } = await supabase
            .from('inventory')
            .insert(inventoryData)
            .select()
            .single();

          if (error) throw error;
          result = inserted;
          results.results.push({
            action: 'inserted',
            record: result,
            rowNumber: i + 1
          });
        }

        results.processed++;

      } catch (error: any) {
        results.errors.push({
          row: i + 1,
          field: 'general',
          message: error.message || 'Unknown error occurred',
          severity: 'error'
        });
      }
    }

    results.success = results.errors.length === 0;
    return results;
  }

  async getExistingRecordCount(): Promise<number> {
    const { count } = await supabase.from('inventory').select('*', { count: 'exact', head: true });
    return count || 0;
  }

  async checkForDuplicates(data: any[]): Promise<{ field: string; values: string[] }[]> {
    const duplicates: { field: string; values: string[] }[] = [];

    // Check for duplicate product/location combinations within the import
    const combinations = new Map<string, number>();
    data.forEach((row, index) => {
      if (row.product_sku && row.location_code) {
        const key = `${row.product_sku}|${row.location_code}`;
        combinations.set(key, (combinations.get(key) || 0) + 1);
      }
    });

    const duplicateCombinations = Array.from(combinations.entries())
      .filter(([_, count]) => count > 1)
      .map(([key, _]) => key);

    if (duplicateCombinations.length > 0) {
      duplicates.push({
        field: 'product_location_combination',
        values: duplicateCombinations
      });
    }

    // Check for existing inventory records in database
    const skuLocationPairs = data.map(row => ({
      sku: row.product_sku,
      location: row.location_code || 'MAIN'
    })).filter(pair => pair.sku);

    if (skuLocationPairs.length > 0) {
      // Get products to convert SKUs to IDs
      const skus = [...new Set(skuLocationPairs.map(p => p.sku))];
      const { data: products } = await supabase
        .from('products')
        .select('id, sku')
        .in('sku', skus);

      const skuToId = new Map(products?.map(p => [p.sku, p.id]) || []);

      // Check for existing inventory records
      const existingChecks = skuLocationPairs
        .map(pair => ({ product_id: skuToId.get(pair.sku), location_code: pair.location }))
        .filter(pair => pair.product_id);

      if (existingChecks.length > 0) {
        const productIds = existingChecks.map(c => c.product_id);
        const locations = [...new Set(existingChecks.map(c => c.location_code))];
        
        const { data: existingInventory } = await supabase
          .from('inventory')
          .select('product_id, location_code, products!inner(sku)')
          .in('product_id', productIds)
          .in('location_code', locations);

        const existingCombinations = existingInventory?.map(inv => 
          `${(inv as any).products.sku}|${inv.location_code}`
        ) || [];

        if (existingCombinations.length > 0) {
          duplicates.push({
            field: 'existing_inventory_records',
            values: existingCombinations
          });
        }
      }
    }

    return duplicates;
  }
}