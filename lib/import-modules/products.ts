import { ImportModule, ImportResult, ValidationError, ImportPreview, FieldMapping, ImportJobData } from '../import-service';
import { supabase } from '../supabase';

export class ProductImportModule implements ImportModule {
  name = 'Products';
  description = 'Import product/inventory items with pricing and specifications';
  
  availableFields = [
    { key: 'name', label: 'Product Name', type: 'text', required: true },
    { key: 'sku', label: 'SKU', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'unit_price', label: 'Unit Price', type: 'number' },
    { key: 'cost', label: 'Cost', type: 'number' },
    { key: 'quantity_on_hand', label: 'Quantity on Hand', type: 'number' },
    { key: 'unit_of_measure', label: 'Unit of Measure', type: 'text' },
    { key: 'track_inventory', label: 'Track Inventory', type: 'boolean' },
    { key: 'is_active', label: 'Is Active', type: 'boolean' },
    { key: 'item_type', label: 'Item Type (QB)', type: 'select', options: ['Inventory', 'NonInventory', 'Service', 'Bundle', 'Assembly'] },
    { key: 'income_account', label: 'Income Account (QB)', type: 'text' },
    { key: 'expense_account', label: 'Expense Account (QB)', type: 'text' },
    { key: 'asset_account', label: 'Asset Account (QB)', type: 'text' },
    { key: 'manufacturer_part_number', label: 'Manufacturer Part Number', type: 'text' },
    { key: 'taxable', label: 'Taxable', type: 'boolean' },
    { key: 'tax_code', label: 'Tax Code', type: 'text' },
    { key: 'reorder_point', label: 'Reorder Point', type: 'number' },
    { key: 'preferred_vendor', label: 'Preferred Vendor', type: 'text' },
    { key: 'qb_item_id', label: 'QuickBooks Item ID', type: 'text' },
    { key: 'qb_sync_token', label: 'QuickBooks Sync Token', type: 'text' },
    { key: 'qb_last_sync', label: 'QB Last Sync', type: 'date' },
    { key: 'weight', label: 'Weight', type: 'number' },
    { key: 'dimensions', label: 'Dimensions (L x W x H)', type: 'text' },
    { key: 'margin_percentage', label: 'Margin %', type: 'number' },
    { key: 'markup_percentage', label: 'Markup %', type: 'number' },
  ];

  async validateData(data: any[], fieldMappings: FieldMapping[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const fieldMap = new Map(fieldMappings.map(fm => [fm.csvColumn, fm.dbField]));

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
          });
        }
      }

      // Validate numeric fields
      const numericFields = ['unit_price', 'cost', 'quantity_on_hand', 'reorder_point', 'weight', 'margin_percentage', 'markup_percentage'];
      for (const fieldKey of numericFields) {
        const sourceField = [...fieldMap.entries()].find(([_, target]) => target === fieldKey)?.[0];
        if (sourceField && row[sourceField] && isNaN(Number(row[sourceField]))) {
          errors.push({
            row: i + 1,
            field: fieldKey,
            message: `'${this.availableFields.find(f => f.key === fieldKey)?.label}' must be a valid number`,
          });
        }
      }

      // Validate boolean fields
      const booleanFields = ['track_inventory', 'is_active', 'taxable'];
      for (const fieldKey of booleanFields) {
        const sourceField = [...fieldMap.entries()].find(([_, target]) => target === fieldKey)?.[0];
        if (sourceField && row[sourceField]) {
          const value = String(row[sourceField]).toLowerCase();
          if (!['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(value)) {
            errors.push({
              row: i + 1,
              field: fieldKey,
              message: `'${this.availableFields.find(f => f.key === fieldKey)?.label}' must be true/false, yes/no, or 1/0`,
              });
          }
        }
      }

      // Validate item_type options
      const itemTypeSource = [...fieldMap.entries()].find(([_, target]) => target === 'item_type')?.[0];
      if (itemTypeSource && row[itemTypeSource]) {
        const validTypes = ['Inventory', 'NonInventory', 'Service', 'Bundle', 'Assembly'];
        if (!validTypes.includes(row[itemTypeSource])) {
          errors.push({
            row: i + 1,
            field: 'item_type',
            message: `Item Type must be one of: ${validTypes.join(', ')}`,
          });
        }
      }

      // Validate SKU uniqueness within the dataset
      const skuSource = [...fieldMap.entries()].find(([_, target]) => target === 'sku')?.[0];
      if (skuSource && row[skuSource]) {
        const duplicateIndex = data.findIndex((otherRow, otherIndex) => 
          otherIndex !== i && otherRow[skuSource] === row[skuSource]
        );
        if (duplicateIndex !== -1) {
          errors.push({
            row: i + 1,
            field: 'sku',
            message: `Duplicate SKU found at rows ${i + 1} and ${duplicateIndex + 1}`,
          });
        }
      }

      // Validate percentage fields (0-100)
      const percentageFields = ['margin_percentage', 'markup_percentage'];
      for (const fieldKey of percentageFields) {
        const sourceField = [...fieldMap.entries()].find(([_, target]) => target === fieldKey)?.[0];
        if (sourceField && row[sourceField]) {
          const value = Number(row[sourceField]);
          if (!isNaN(value) && (value < 0 || value > 100)) {
            errors.push({
              row: i + 1,
              field: fieldKey,
              message: `'${this.availableFields.find(f => f.key === fieldKey)?.label}' must be between 0 and 100`
            });
          }
        }
      }

      // Validate date format for qb_last_sync
      const syncDateSource = [...fieldMap.entries()].find(([_, target]) => target === 'qb_last_sync')?.[0];
      if (syncDateSource && row[syncDateSource]) {
        const date = new Date(row[syncDateSource]);
        if (isNaN(date.getTime())) {
          errors.push({
            row: i + 1,
            field: 'qb_last_sync',
            message: 'QB Last Sync must be a valid date format',
          });
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

    const fieldMap = new Map(fieldMappings.map(fm => [fm.csvColumn, fm.dbField]));

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

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Prepare product data
        const productData: any = {
          name: getValue(row, 'name'),
          sku: getValue(row, 'sku'),
          description: getValue(row, 'description') || null,
          category: getValue(row, 'category') || null,
          unit_price: getValue(row, 'unit_price') ? Number(getValue(row, 'unit_price')) : null,
          cost: getValue(row, 'cost') ? Number(getValue(row, 'cost')) : null,
          quantity_on_hand: getValue(row, 'quantity_on_hand') ? Number(getValue(row, 'quantity_on_hand')) : 0,
          unit_of_measure: getValue(row, 'unit_of_measure') || null,
          track_inventory: parseBoolean(getValue(row, 'track_inventory')),
          is_active: parseBoolean(getValue(row, 'is_active')),
          // QuickBooks integration fields
          item_type: getValue(row, 'item_type') || 'Inventory',
          income_account: getValue(row, 'income_account') || null,
          expense_account: getValue(row, 'expense_account') || null,
          asset_account: getValue(row, 'asset_account') || null,
          manufacturer_part_number: getValue(row, 'manufacturer_part_number') || null,
          taxable: parseBoolean(getValue(row, 'taxable')),
          tax_code: getValue(row, 'tax_code') || null,
          reorder_point: getValue(row, 'reorder_point') ? Number(getValue(row, 'reorder_point')) : null,
          preferred_vendor: getValue(row, 'preferred_vendor') || null,
          qb_item_id: getValue(row, 'qb_item_id') || null,
          qb_sync_token: getValue(row, 'qb_sync_token') || null,
          qb_last_sync: getValue(row, 'qb_last_sync') ? new Date(getValue(row, 'qb_last_sync')).toISOString() : null,
          weight: getValue(row, 'weight') ? Number(getValue(row, 'weight')) : null,
          dimensions: getValue(row, 'dimensions') || null,
          margin_percentage: getValue(row, 'margin_percentage') ? Number(getValue(row, 'margin_percentage')) : null,
          markup_percentage: getValue(row, 'markup_percentage') ? Number(getValue(row, 'markup_percentage')) : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Check for existing product by SKU (for updates vs inserts)
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('sku', productData.sku)
          .single();

        let result;
        if (existing && (jobData as any).duplicateStrategy === 'update') {
          // Update existing product
          const { data: updated, error } = await supabase
            .from('products')
            .update({
              ...productData,
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
        } else if (existing && (jobData as any).duplicateStrategy === 'skip') {
          // Skip existing product
          results.results.push({
            action: 'skipped',
            record: existing,
            rowNumber: i + 1
          });
          results.processed++;
          continue;
        } else {
          // Insert new product (or duplicate with 'create_new' strategy)
          if (existing && (jobData as any).duplicateStrategy === 'create_new') {
            // Modify SKU to make it unique
            productData.sku = `${productData.sku}_${Date.now()}`;
          }

          const { data: inserted, error } = await supabase
            .from('products')
            .insert(productData)
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
    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
    return count || 0;
  }

  async checkForDuplicates(data: any[]): Promise<{ field: string; values: string[] }[]> {
    const duplicates: { field: string; values: string[] }[] = [];

    // Check for duplicate SKUs in the import data
    const skuCounts = new Map<string, number>();
    data.forEach(row => {
      if (row.sku) {
        skuCounts.set(row.sku, (skuCounts.get(row.sku) || 0) + 1);
      }
    });

    const duplicateSkus = Array.from(skuCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([sku, _]) => sku);

    if (duplicateSkus.length > 0) {
      duplicates.push({
        field: 'sku',
        values: duplicateSkus
      });
    }

    // Check for duplicate Product Names
    const nameCounts = new Map<string, number>();
    data.forEach(row => {
      if (row.name) {
        nameCounts.set(row.name, (nameCounts.get(row.name) || 0) + 1);
      }
    });

    const duplicateNames = Array.from(nameCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([name, _]) => name);

    if (duplicateNames.length > 0) {
      duplicates.push({
        field: 'name',
        values: duplicateNames
      });
    }

    // Check for existing SKUs in database
    const importSkus = data.map(row => row.sku).filter(Boolean);
    if (importSkus.length > 0) {
      const { data: existingProducts } = await supabase
        .from('products')
        .select('sku')
        .in('sku', importSkus);

      const existingSkus = existingProducts?.map(p => p.sku) || [];
      if (existingSkus.length > 0) {
        duplicates.push({
          field: 'existing_sku',
          values: existingSkus
        });
      }
    }

    // Check for existing QuickBooks Item IDs in database
    const qbItemIds = data.map(row => row.qb_item_id).filter(Boolean);
    if (qbItemIds.length > 0) {
      const { data: existingQbItems } = await supabase
        .from('products')
        .select('qb_item_id')
        .in('qb_item_id', qbItemIds);

      const existingQbIds = existingQbItems?.map(p => p.qb_item_id) || [];
      if (existingQbIds.length > 0) {
        duplicates.push({
          field: 'existing_qb_item_id',
          values: existingQbIds
        });
      }
    }

    return duplicates;
  }
}