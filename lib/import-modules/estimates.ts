import { ImportModule, ImportResult, ValidationError, ImportPreview, FieldMapping, ImportJobData } from '../import-service';
import { supabase } from '../supabase';
import { validateRequired, validateEmail, validateDate, validateNumber, validateChoice } from '../csv-utils';

interface EstimateImportData {
  // Estimate Header
  estimate_number: string;
  customer_name?: string;
  customer_id?: string;
  sales_rep_name?: string;
  sales_rep_id?: string;
  template_name?: string;
  template_id?: string;
  
  // Dates
  estimate_date?: string;
  expiration_date?: string;
  
  // Reference information
  reference_number?: string;
  job_name?: string;
  
  // Billing Address
  bill_to_company?: string;
  bill_to_contact?: string;
  bill_to_address_line_1?: string;
  bill_to_address_line_2?: string;
  bill_to_city?: string;
  bill_to_state?: string;
  bill_to_zip?: string;
  bill_to_country?: string;
  
  // Shipping Address
  ship_to_company?: string;
  ship_to_contact?: string;
  ship_to_address_line_1?: string;
  ship_to_address_line_2?: string;
  ship_to_city?: string;
  ship_to_state?: string;
  ship_to_zip?: string;
  ship_to_country?: string;
  ship_to_same_as_billing?: string;
  
  // Financial
  subtotal?: string;
  tax_rate?: string;
  tax_amount?: string;
  shipping_amount?: string;
  discount_amount?: string;
  total_amount?: string;
  
  // Status
  status?: string;
  
  // Notes
  internal_notes?: string;
  customer_notes?: string;
  terms_and_conditions?: string;
  
  // Line Items (multiple lines can share same header data)
  line_number?: string;
  item_type?: string;
  product_name?: string;
  product_id?: string;
  sku?: string;
  line_description?: string;
  long_description?: string;
  quantity?: string;
  unit_of_measure?: string;
  unit_price?: string;
  line_total?: string;
  discount_type?: string;
  discount_value?: string;
  discounted_total?: string;
  is_taxable?: string;
  tax_code?: string;
  line_notes?: string;
  sort_order?: string;
}

interface ProcessedEstimate {
  header: any;
  lines: any[];
}

export class EstimateImportModule implements ImportModule {
  name = 'Estimates';
  description = 'Import estimates with line items and customer relationships';
  
  // Available fields for mapping
  availableFields = [
    { key: 'estimate_number', label: 'Estimate Number', type: 'text', required: true },
    { key: 'customer_name', label: 'Customer Name', type: 'text' },
    { key: 'customer_id', label: 'Customer ID', type: 'text' },
    { key: 'sales_rep_name', label: 'Sales Rep Name', type: 'text' },
    { key: 'sales_rep_id', label: 'Sales Rep ID', type: 'text' },
    { key: 'template_name', label: 'Template Name', type: 'text' },
    { key: 'template_id', label: 'Template ID', type: 'text' },
    
    // Dates
    { key: 'estimate_date', label: 'Estimate Date', type: 'date' },
    { key: 'expiration_date', label: 'Expiration Date', type: 'date' },
    
    // Reference
    { key: 'reference_number', label: 'Reference Number', type: 'text' },
    { key: 'job_name', label: 'Job Name', type: 'text' },
    
    // Billing Address
    { key: 'bill_to_company', label: 'Bill To Company', type: 'text' },
    { key: 'bill_to_contact', label: 'Bill To Contact', type: 'text' },
    { key: 'bill_to_address_line_1', label: 'Bill To Address Line 1', type: 'text' },
    { key: 'bill_to_address_line_2', label: 'Bill To Address Line 2', type: 'text' },
    { key: 'bill_to_city', label: 'Bill To City', type: 'text' },
    { key: 'bill_to_state', label: 'Bill To State', type: 'text' },
    { key: 'bill_to_zip', label: 'Bill To ZIP', type: 'text' },
    { key: 'bill_to_country', label: 'Bill To Country', type: 'text' },
    
    // Shipping Address
    { key: 'ship_to_company', label: 'Ship To Company', type: 'text' },
    { key: 'ship_to_contact', label: 'Ship To Contact', type: 'text' },
    { key: 'ship_to_address_line_1', label: 'Ship To Address Line 1', type: 'text' },
    { key: 'ship_to_address_line_2', label: 'Ship To Address Line 2', type: 'text' },
    { key: 'ship_to_city', label: 'Ship To City', type: 'text' },
    { key: 'ship_to_state', label: 'Ship To State', type: 'text' },
    { key: 'ship_to_zip', label: 'Ship To ZIP', type: 'text' },
    { key: 'ship_to_country', label: 'Ship To Country', type: 'text' },
    { key: 'ship_to_same_as_billing', label: 'Ship To Same as Billing', type: 'boolean' },
    
    // Financial
    { key: 'subtotal', label: 'Subtotal', type: 'number' },
    { key: 'tax_rate', label: 'Tax Rate (%)', type: 'number' },
    { key: 'tax_amount', label: 'Tax Amount', type: 'number' },
    { key: 'shipping_amount', label: 'Shipping Amount', type: 'number' },
    { key: 'discount_amount', label: 'Discount Amount', type: 'number' },
    { key: 'total_amount', label: 'Total Amount', type: 'number' },
    
    // Status
    { key: 'status', label: 'Status', type: 'choice', 
      choices: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'] },
    
    // Notes
    { key: 'internal_notes', label: 'Internal Notes', type: 'text' },
    { key: 'customer_notes', label: 'Customer Notes', type: 'text' },
    { key: 'terms_and_conditions', label: 'Terms and Conditions', type: 'text' },
    
    // Line Items
    { key: 'line_number', label: 'Line Number', type: 'number' },
    { key: 'item_type', label: 'Item Type', type: 'choice',
      choices: ['PRODUCT', 'SERVICE', 'LABOR', 'MATERIAL', 'MISC'] },
    { key: 'product_name', label: 'Product Name', type: 'text' },
    { key: 'product_id', label: 'Product ID', type: 'text' },
    { key: 'sku', label: 'SKU', type: 'text' },
    { key: 'line_description', label: 'Line Description', type: 'text' },
    { key: 'long_description', label: 'Long Description', type: 'text' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'unit_of_measure', label: 'Unit of Measure', type: 'text' },
    { key: 'unit_price', label: 'Unit Price', type: 'number' },
    { key: 'line_total', label: 'Line Total', type: 'number' },
    { key: 'discount_type', label: 'Discount Type', type: 'choice',
      choices: ['NONE', 'PERCENT', 'AMOUNT'] },
    { key: 'discount_value', label: 'Discount Value', type: 'number' },
    { key: 'discounted_total', label: 'Discounted Total', type: 'number' },
    { key: 'is_taxable', label: 'Is Taxable', type: 'boolean' },
    { key: 'tax_code', label: 'Tax Code', type: 'text' },
    { key: 'line_notes', label: 'Line Notes', type: 'text' },
    { key: 'sort_order', label: 'Sort Order', type: 'number' },
  ];

  async validateData(data: EstimateImportData[], fieldMappings: FieldMapping[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Cache lookups
    const customerCache = new Map<string, any>();
    const salesRepCache = new Map<string, any>();
    const productCache = new Map<string, any>();
    const templateCache = new Map<string, any>();
    
    // Load reference data
    const { data: customers } = await supabase.from('customers').select('id, company_name, name');
    const { data: salesReps } = await supabase.from('sales_reps').select('id, first_name, last_name');
    const { data: products } = await supabase.from('products').select('id, name, sku');
    const { data: templates } = await supabase.from('estimate_templates').select('id, name');
    
    // Build lookup caches
    customers?.forEach(c => {
      customerCache.set(c.id, c);
      customerCache.set(c.company_name?.toLowerCase() || '', c);
      customerCache.set(c.name?.toLowerCase() || '', c);
    });
    
    salesReps?.forEach(sr => {
      customerCache.set(sr.id, sr);
      const fullName = `${sr.first_name} ${sr.last_name}`.toLowerCase();
      salesRepCache.set(fullName, sr);
    });
    
    products?.forEach(p => {
      productCache.set(p.id, p);
      productCache.set(p.name?.toLowerCase() || '', p);
      productCache.set(p.sku?.toLowerCase() || '', p);
    });

    templates?.forEach(t => {
      templateCache.set(t.id, t);
      templateCache.set(t.name?.toLowerCase() || '', t);
    });

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Account for header row

      // Required fields
      errors.push(...validateRequired(row.estimate_number, 'Estimate Number', rowNum));

      // Customer validation - require either ID or name
      if (!row.customer_id && !row.customer_name) {
        errors.push({ row: rowNum, field: 'customer_id/customer_name', message: 'Either Customer ID or Customer Name is required' });
      } else {
        // Validate customer exists
        const customerKey = row.customer_id || row.customer_name?.toLowerCase() || '';
        if (!customerCache.has(customerKey)) {
          errors.push({ row: rowNum, field: 'customer', message: `Customer '${row.customer_id || row.customer_name}' not found` });
        }
      }

      // Sales rep validation (optional)
      if (row.sales_rep_id || row.sales_rep_name) {
        const salesRepKey = row.sales_rep_id || row.sales_rep_name?.toLowerCase() || '';
        if (!salesRepCache.has(salesRepKey)) {
          errors.push({ row: rowNum, field: 'sales_rep', message: `Sales rep '${row.sales_rep_id || row.sales_rep_name}' not found` });
        }
      }

      // Template validation (optional)
      if (row.template_id || row.template_name) {
        const templateKey = row.template_id || row.template_name?.toLowerCase() || '';
        if (!templateCache.has(templateKey)) {
          errors.push({ row: rowNum, field: 'template', message: `Template '${row.template_id || row.template_name}' not found` });
        }
      }

      // Date validations
      if (row.estimate_date) {
        errors.push(...validateDate(row.estimate_date, 'Estimate Date', rowNum));
      }
      if (row.expiration_date) {
        errors.push(...validateDate(row.expiration_date, 'Expiration Date', rowNum));
      }

      // Financial validations
      if (row.subtotal) {
        errors.push(...validateNumber(row.subtotal, 'Subtotal', rowNum));
      }
      if (row.tax_rate) {
        errors.push(...validateNumber(row.tax_rate, 'Tax Rate', rowNum));
      }
      if (row.tax_amount) {
        errors.push(...validateNumber(row.tax_amount, 'Tax Amount', rowNum));
      }
      if (row.shipping_amount) {
        errors.push(...validateNumber(row.shipping_amount, 'Shipping Amount', rowNum));
      }
      if (row.discount_amount) {
        errors.push(...validateNumber(row.discount_amount, 'Discount Amount', rowNum));
      }
      if (row.total_amount) {
        errors.push(...validateNumber(row.total_amount, 'Total Amount', rowNum));
      }

      // Status validation
      if (row.status) {
        errors.push(...validateChoice(row.status, 'Status', 
          ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'], rowNum));
      }

      // Boolean validation
      if (row.ship_to_same_as_billing) {
        if (!['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(row.ship_to_same_as_billing.toLowerCase())) {
          errors.push({ row: rowNum, field: 'ship_to_same_as_billing', message: 'Must be true/false, yes/no, or 1/0' });
        }
      }

      // Line item validations (if line data is present)
      const hasLineData = row.line_number || row.product_name || row.product_id || row.line_description || row.quantity;
      
      if (hasLineData) {
        // Line number validation
        if (row.line_number) {
          errors.push(...validateNumber(row.line_number, 'Line Number', rowNum));
        }

        // Description is required for estimate lines
        if (!row.line_description && !row.product_name) {
          errors.push({ row: rowNum, field: 'line_description', message: 'Line description is required for line items' });
        }

        // Product validation (optional - can have non-product lines)
        if (row.product_id || row.product_name || row.sku) {
          const productKey = row.product_id || row.product_name?.toLowerCase() || row.sku?.toLowerCase() || '';
          if (!productCache.has(productKey)) {
            errors.push({ row: rowNum, field: 'product', message: `Product '${row.product_id || row.product_name || row.sku}' not found` });
          }
        }

        // Item type validation
        if (row.item_type) {
          errors.push(...validateChoice(row.item_type, 'Item Type', 
            ['PRODUCT', 'SERVICE', 'LABOR', 'MATERIAL', 'MISC'], rowNum));
        }

        // Quantity validation (required for line items)
        if (!row.quantity) {
          errors.push({ row: rowNum, field: 'quantity', message: 'Quantity is required for line items' });
        } else {
          errors.push(...validateNumber(row.quantity, 'Quantity', rowNum));
          if (parseFloat(row.quantity) <= 0) {
            errors.push({ row: rowNum, field: 'quantity', message: 'Quantity must be greater than 0' });
          }
        }

        // Price validation (required for line items)
        if (!row.unit_price) {
          errors.push({ row: rowNum, field: 'unit_price', message: 'Unit Price is required for line items' });
        } else {
          errors.push(...validateNumber(row.unit_price, 'Unit Price', rowNum));
        }

        // Optional line field validations
        if (row.line_total) {
          errors.push(...validateNumber(row.line_total, 'Line Total', rowNum));
        }
        if (row.discount_type) {
          errors.push(...validateChoice(row.discount_type, 'Discount Type', 
            ['NONE', 'PERCENT', 'AMOUNT'], rowNum));
        }
        if (row.discount_value) {
          errors.push(...validateNumber(row.discount_value, 'Discount Value', rowNum));
        }
        if (row.discounted_total) {
          errors.push(...validateNumber(row.discounted_total, 'Discounted Total', rowNum));
        }
        if (row.sort_order) {
          errors.push(...validateNumber(row.sort_order, 'Sort Order', rowNum));
        }

        // Boolean validation for taxable
        if (row.is_taxable) {
          if (!['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(row.is_taxable.toLowerCase())) {
            errors.push({ row: rowNum, field: 'is_taxable', message: 'Must be true/false, yes/no, or 1/0' });
          }
        }
      }
    }

    return errors;
  }

  async generatePreview(data: EstimateImportData[], fieldMappings: FieldMapping[]): Promise<ImportPreview> {
    const processed = this.groupIntoEstimates(data);
    
    return {
      totalRecords: processed.length,
      sampleData: processed.slice(0, 5).map(est => ({
        'Estimate': est.header.estimate_number,
        'Customer': est.header.customer_name || est.header.customer_id,
        'Estimate Date': est.header.estimate_date,
        'Status': est.header.status || 'DRAFT',
        'Line Count': est.lines.length,
        'Total': est.header.total_amount || 'Calculated'
      })),
      fieldMappings
    };
  }

  async importData(data: EstimateImportData[], fieldMappings: FieldMapping[], jobData: ImportJobData): Promise<ImportResult> {
    const errors: ValidationError[] = [];
    const successful: any[] = [];
    let processed = 0;

    try {
      // Group data into estimates with their line items
      const estimates = this.groupIntoEstimates(data);
      
      // Cache reference data
      const customerCache = await this.buildCustomerCache();
      const salesRepCache = await this.buildSalesRepCache();
      const productCache = await this.buildProductCache();
      const templateCache = await this.buildTemplateCache();

      for (const [index, estData] of estimates.entries()) {
        try {
          // Update progress
          const progress = Math.round((processed / estimates.length) * 100);
          if (jobData.onProgress) {
            await jobData.onProgress(progress, `Processing estimate ${processed + 1} of ${estimates.length}`);
          }

          // Process header data
          const headerData = await this.processHeaderData(estData.header, customerCache, salesRepCache, templateCache);
          
          // Insert estimate
          const { data: insertedEst, error: estError } = await supabase
            .from('estimates')
            .insert([headerData])
            .select('id, estimate_number')
            .single();

          if (estError) {
            errors.push({ row: index + 1, field: 'estimate', message: `Failed to insert estimate: ${estError.message}` });
            continue;
          }

          // Process line items
          const lineData = await this.processLineItems(estData.lines, insertedEst.id, productCache);
          
          if (lineData.length > 0) {
            const { error: linesError } = await supabase
              .from('estimate_lines')
              .insert(lineData);

            if (linesError) {
              // Try to delete the header since lines failed
              await supabase.from('estimates').delete().eq('id', insertedEst.id);
              errors.push({ row: index + 1, field: 'lines', message: `Failed to insert line items: ${linesError.message}` });
              continue;
            }
          }

          successful.push({
            estimate_number: insertedEst.estimate_number,
            id: insertedEst.id,
            line_count: lineData.length
          });

          processed++;

        } catch (error) {
          errors.push({ 
            row: index + 1, 
            field: 'processing', 
            message: `Error processing estimate: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
      }

      return {
        success: errors.length === 0,
        processed,
        errors,
        results: successful
      };

    } catch (error) {
      return {
        success: false,
        processed: 0,
        errors: [{ row: 0, field: 'system', message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        results: []
      };
    }
  }

  private groupIntoEstimates(data: EstimateImportData[]): ProcessedEstimate[] {
    const estimateMap = new Map<string, ProcessedEstimate>();

    for (const row of data) {
      const estimateNumber = row.estimate_number;
      
      if (!estimateMap.has(estimateNumber)) {
        // Create new estimate
        estimateMap.set(estimateNumber, {
          header: { ...row },
          lines: []
        });
      }

      const est = estimateMap.get(estimateNumber)!;

      // If this row has line item data, add it as a line
      const hasLineData = row.line_number || row.product_name || row.product_id || row.line_description || row.quantity;
      if (hasLineData) {
        est.lines.push({ ...row });
      }

      // Update header with any non-empty values (last wins)
      Object.keys(row).forEach(key => {
        const value = (row as any)[key];
        if (value && value.toString().trim() !== '') {
          (est.header as any)[key] = value;
        }
      });
    }

    return Array.from(estimateMap.values());
  }

  private async buildCustomerCache() {
    const { data: customers } = await supabase.from('customers').select('id, company_name, name');
    const cache = new Map<string, any>();
    
    customers?.forEach(c => {
      cache.set(c.id, c);
      if (c.company_name) cache.set(c.company_name.toLowerCase(), c);
      if (c.name) cache.set(c.name.toLowerCase(), c);
    });
    
    return cache;
  }

  private async buildSalesRepCache() {
    const { data: salesReps } = await supabase.from('sales_reps').select('id, first_name, last_name');
    const cache = new Map<string, any>();
    
    salesReps?.forEach(sr => {
      cache.set(sr.id, sr);
      const fullName = `${sr.first_name} ${sr.last_name}`.toLowerCase();
      cache.set(fullName, sr);
    });
    
    return cache;
  }

  private async buildProductCache() {
    const { data: products } = await supabase.from('products').select('id, name, sku');
    const cache = new Map<string, any>();
    
    products?.forEach(p => {
      cache.set(p.id, p);
      if (p.name) cache.set(p.name.toLowerCase(), p);
      if (p.sku) cache.set(p.sku.toLowerCase(), p);
    });
    
    return cache;
  }

  private async buildTemplateCache() {
    const { data: templates } = await supabase.from('estimate_templates').select('id, name');
    const cache = new Map<string, any>();
    
    templates?.forEach(t => {
      cache.set(t.id, t);
      if (t.name) cache.set(t.name.toLowerCase(), t);
    });
    
    return cache;
  }

  private async processHeaderData(header: EstimateImportData, customerCache: Map<string, any>, salesRepCache: Map<string, any>, templateCache: Map<string, any>) {
    // Resolve customer
    const customerKey = header.customer_id || header.customer_name?.toLowerCase() || '';
    const customer = customerCache.get(customerKey);
    
    // Resolve sales rep
    const salesRepKey = header.sales_rep_id || header.sales_rep_name?.toLowerCase() || '';
    const salesRep = salesRepCache.get(salesRepKey);
    
    // Resolve template
    const templateKey = header.template_id || header.template_name?.toLowerCase() || '';
    const template = templateCache.get(templateKey);

    return {
      estimate_number: header.estimate_number,
      customer_id: customer?.id || null,
      sales_rep_id: salesRep?.id || null,
      template_id: template?.id || null,
      
      // Dates
      estimate_date: header.estimate_date || new Date().toISOString().split('T')[0],
      expiration_date: header.expiration_date || null,
      
      // Reference
      reference_number: header.reference_number || null,
      job_name: header.job_name || null,
      
      // Billing address
      bill_to_company: header.bill_to_company || null,
      bill_to_contact: header.bill_to_contact || null,
      bill_to_address_line_1: header.bill_to_address_line_1 || null,
      bill_to_address_line_2: header.bill_to_address_line_2 || null,
      bill_to_city: header.bill_to_city || null,
      bill_to_state: header.bill_to_state || null,
      bill_to_zip: header.bill_to_zip || null,
      bill_to_country: header.bill_to_country || 'United States',
      
      // Shipping address
      ship_to_company: header.ship_to_company || null,
      ship_to_contact: header.ship_to_contact || null,
      ship_to_address_line_1: header.ship_to_address_line_1 || null,
      ship_to_address_line_2: header.ship_to_address_line_2 || null,
      ship_to_city: header.ship_to_city || null,
      ship_to_state: header.ship_to_state || null,
      ship_to_zip: header.ship_to_zip || null,
      ship_to_country: header.ship_to_country || 'United States',
      ship_to_same_as_billing: this.parseBoolean(header.ship_to_same_as_billing) ?? true,
      
      // Financial
      subtotal: this.parseNumber(header.subtotal) ?? 0,
      tax_rate: this.parseNumber(header.tax_rate) ?? 0,
      tax_amount: this.parseNumber(header.tax_amount) ?? 0,
      shipping_amount: this.parseNumber(header.shipping_amount) ?? 0,
      discount_amount: this.parseNumber(header.discount_amount) ?? 0,
      total_amount: this.parseNumber(header.total_amount) ?? 0,
      
      // Status
      status: header.status || 'DRAFT',
      
      // Notes
      internal_notes: header.internal_notes || null,
      customer_notes: header.customer_notes || null,
      terms_and_conditions: header.terms_and_conditions || null,
    };
  }

  private async processLineItems(lines: EstimateImportData[], estimateId: string, productCache: Map<string, any>) {
    return lines.map((line, index) => {
      // Resolve product
      const productKey = line.product_id || line.product_name?.toLowerCase() || line.sku?.toLowerCase() || '';
      const product = productCache.get(productKey);

      return {
        estimate_id: estimateId,
        line_number: this.parseNumber(line.line_number) ?? (index + 1),
        item_type: line.item_type || 'PRODUCT',
        product_id: product?.id || null,
        sku: line.sku || product?.sku || null,
        description: line.line_description || product?.name || 'Unknown item',
        long_description: line.long_description || null,
        quantity: this.parseNumber(line.quantity) ?? 1,
        unit_of_measure: line.unit_of_measure || 'each',
        unit_price: this.parseNumber(line.unit_price) ?? 0,
        discount_type: line.discount_type || 'NONE',
        discount_value: this.parseNumber(line.discount_value) ?? 0,
        discounted_total: this.parseNumber(line.discounted_total) || null,
        is_taxable: this.parseBoolean(line.is_taxable) ?? true,
        tax_code: line.tax_code || null,
        notes: line.line_notes || null,
        sort_order: this.parseNumber(line.sort_order) ?? (index + 1) * 10
      };
    });
  }

  private parseNumber(value: string | undefined): number | null {
    if (!value || value.trim() === '') return null;
    const parsed = parseFloat(value.replace(/[,$]/g, ''));
    return isNaN(parsed) ? null : parsed;
  }

  private parseBoolean(value: string | undefined): boolean | null {
    if (!value || value.trim() === '') return null;
    const lower = value.toLowerCase().trim();
    if (['true', '1', 'yes', 'y'].includes(lower)) return true;
    if (['false', '0', 'no', 'n'].includes(lower)) return false;
    return null;
  }

  async getExistingRecordCount(): Promise<number> {
    const { count } = await supabase
      .from('estimates')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }

  async checkForDuplicates(data: EstimateImportData[]): Promise<{ field: string; values: string[] }[]> {
    const estimateNumbers = [...new Set(data.map(row => row.estimate_number).filter(Boolean))];
    
    if (estimateNumbers.length === 0) return [];

    const { data: existing } = await supabase
      .from('estimates')
      .select('estimate_number')
      .in('estimate_number', estimateNumbers);

    const duplicates = existing?.map(item => item.estimate_number) || [];

    return duplicates.length > 0 ? [{ field: 'estimate_number', values: duplicates }] : [];
  }
}