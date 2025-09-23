import { ImportModule, ImportResult, ValidationError, ImportPreview, FieldMapping, ImportJobData } from '../import-service';
import { supabase } from '../supabase';
import { validateRequired, validateDate, validateNumber, validateChoice } from '../csv-utils';

interface SalesOrderImportData {
  // Sales Order Header
  so_number: string;
  customer_name?: string;
  customer_id?: string;
  sales_rep_name?: string;
  sales_rep_id?: string;
  
  // Dates
  order_date?: string;
  ship_date?: string;
  due_date?: string;
  
  // Reference information
  reference_number?: string;
  job_name?: string;
  source_estimate_number?: string;
  
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
  discount_percent?: string;
  total_amount?: string;
  
  // Status
  status?: string;
  
  // Notes
  internal_notes?: string;
  customer_notes?: string;
  terms_and_conditions?: string;
  
  // Line Items (multiple lines can share same header data)
  line_number?: string;
  product_name?: string;
  product_id?: string;
  item_code?: string;
  line_description?: string;
  quantity?: string;
  unit_price?: string;
  unit_of_measure?: string;
  line_discount_percent?: string;
  line_discount_amount?: string;
  line_tax_code?: string;
  line_tax_rate?: string;
  line_tax_amount?: string;
  line_total?: string;
  fulfillment_status?: string;
}

interface ProcessedSalesOrder {
  header: any;
  lines: any[];
}

export class SalesOrderImportModule implements ImportModule {
  name = 'Sales Orders';
  description = 'Import sales orders with line items and customer relationships';
  
  // Available fields for mapping
  availableFields = [
    { key: 'so_number', label: 'Sales Order Number', type: 'text', required: true },
    { key: 'customer_name', label: 'Customer Name', type: 'text' },
    { key: 'customer_id', label: 'Customer ID', type: 'text' },
    { key: 'sales_rep_name', label: 'Sales Rep Name', type: 'text' },
    { key: 'sales_rep_id', label: 'Sales Rep ID', type: 'text' },
    
    // Dates
    { key: 'order_date', label: 'Order Date', type: 'date' },
    { key: 'ship_date', label: 'Ship Date', type: 'date' },
    { key: 'due_date', label: 'Due Date', type: 'date' },
    
    // Reference
    { key: 'reference_number', label: 'Reference Number', type: 'text' },
    { key: 'job_name', label: 'Job Name', type: 'text' },
    { key: 'source_estimate_number', label: 'Source Estimate Number', type: 'text' },
    
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
    { key: 'discount_percent', label: 'Discount Percent', type: 'number' },
    { key: 'total_amount', label: 'Total Amount', type: 'number' },
    
    // Status
    { key: 'status', label: 'Status', type: 'choice', 
      choices: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'SHIPPED', 'DELIVERED', 'INVOICED', 'CANCELLED', 'ON_HOLD'] },
    
    // Notes
    { key: 'internal_notes', label: 'Internal Notes', type: 'text' },
    { key: 'customer_notes', label: 'Customer Notes', type: 'text' },
    { key: 'terms_and_conditions', label: 'Terms and Conditions', type: 'text' },
    
    // Line Items
    { key: 'line_number', label: 'Line Number', type: 'number' },
    { key: 'product_name', label: 'Product Name', type: 'text' },
    { key: 'product_id', label: 'Product ID', type: 'text' },
    { key: 'item_code', label: 'Item Code', type: 'text' },
    { key: 'line_description', label: 'Line Description', type: 'text' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'unit_price', label: 'Unit Price', type: 'number' },
    { key: 'unit_of_measure', label: 'Unit of Measure', type: 'text' },
    { key: 'line_discount_percent', label: 'Line Discount %', type: 'number' },
    { key: 'line_discount_amount', label: 'Line Discount Amount', type: 'number' },
    { key: 'line_tax_code', label: 'Line Tax Code', type: 'text' },
    { key: 'line_tax_rate', label: 'Line Tax Rate', type: 'number' },
    { key: 'line_tax_amount', label: 'Line Tax Amount', type: 'number' },
    { key: 'line_total', label: 'Line Total', type: 'number' },
    { key: 'fulfillment_status', label: 'Fulfillment Status', type: 'choice',
      choices: ['PENDING', 'PARTIAL', 'COMPLETE', 'CANCELLED'] },
  ];

  async validateData(data: SalesOrderImportData[], fieldMappings: FieldMapping[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Cache lookups
    const customerCache = new Map<string, any>();
    const salesRepCache = new Map<string, any>();
    const productCache = new Map<string, any>();
    const estimateCache = new Map<string, any>();
    
    // Load reference data
    const { data: customers } = await supabase.from('customers').select('id, company_name, name');
    const { data: salesReps } = await supabase.from('sales_reps').select('id, name');
    const { data: products } = await supabase.from('products').select('id, name, sku');
    const { data: estimates } = await supabase.from('estimates').select('id, estimate_number');
    
    // Build lookup caches
    customers?.forEach(c => {
      customerCache.set(c.id, c);
      customerCache.set(c.company_name?.toLowerCase() || '', c);
      customerCache.set(c.name?.toLowerCase() || '', c);
    });
    
    salesReps?.forEach(sr => {
      salesRepCache.set(sr.id, sr);
      salesRepCache.set(sr.name?.toLowerCase() || '', sr);
    });
    
    products?.forEach(p => {
      productCache.set(p.id, p);
      productCache.set(p.name?.toLowerCase() || '', p);
      productCache.set(p.sku?.toLowerCase() || '', p);
    });
    
    estimates?.forEach(e => {
      estimateCache.set(e.id, e);
      estimateCache.set(e.estimate_number?.toLowerCase() || '', e);
    });

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Account for header row

      // Required fields
      errors.push(...validateRequired(row.so_number, 'Sales Order Number', rowNum));

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

      // Date validations
      if (row.order_date) {
        errors.push(...validateDate(row.order_date, 'Order Date', rowNum));
      }
      if (row.ship_date) {
        errors.push(...validateDate(row.ship_date, 'Ship Date', rowNum));
      }
      if (row.due_date) {
        errors.push(...validateDate(row.due_date, 'Due Date', rowNum));
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
      if (row.discount_percent) {
        errors.push(...validateNumber(row.discount_percent, 'Discount Percent', rowNum));
      }
      if (row.total_amount) {
        errors.push(...validateNumber(row.total_amount, 'Total Amount', rowNum));
      }

      // Status validation
      if (row.status) {
        errors.push(...validateChoice(row.status, 'Status', 
          ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'SHIPPED', 'DELIVERED', 'INVOICED', 'CANCELLED', 'ON_HOLD'], rowNum));
      }

      // Boolean validation
      if (row.ship_to_same_as_billing) {
        if (!['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(row.ship_to_same_as_billing.toLowerCase())) {
          errors.push({ row: rowNum, field: 'ship_to_same_as_billing', message: 'Must be true/false, yes/no, or 1/0' });
        }
      }

      // Source estimate validation (optional)
      if (row.source_estimate_number) {
        const estimateKey = row.source_estimate_number.toLowerCase();
        if (!estimateCache.has(estimateKey)) {
          errors.push({ row: rowNum, field: 'source_estimate_number', message: `Estimate '${row.source_estimate_number}' not found` });
        }
      }

      // Line item validations (if line data is present)
      const hasLineData = row.line_number || row.product_name || row.product_id || row.item_code || row.quantity;
      
      if (hasLineData) {
        // Line number validation
        if (row.line_number) {
          errors.push(...validateNumber(row.line_number, 'Line Number', rowNum));
        }

        // Product validation - require either ID, name, or item code
        if (!row.product_id && !row.product_name && !row.item_code) {
          errors.push({ row: rowNum, field: 'product', message: 'Either Product ID, Product Name, or Item Code is required for line items' });
        } else {
          const productKey = row.product_id || row.product_name?.toLowerCase() || row.item_code?.toLowerCase() || '';
          if (!productCache.has(productKey)) {
            errors.push({ row: rowNum, field: 'product', message: `Product '${row.product_id || row.product_name || row.item_code}' not found` });
          }
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
        if (row.line_discount_percent) {
          errors.push(...validateNumber(row.line_discount_percent, 'Line Discount Percent', rowNum));
        }
        if (row.line_discount_amount) {
          errors.push(...validateNumber(row.line_discount_amount, 'Line Discount Amount', rowNum));
        }
        if (row.line_tax_rate) {
          errors.push(...validateNumber(row.line_tax_rate, 'Line Tax Rate', rowNum));
        }
        if (row.line_tax_amount) {
          errors.push(...validateNumber(row.line_tax_amount, 'Line Tax Amount', rowNum));
        }
        if (row.line_total) {
          errors.push(...validateNumber(row.line_total, 'Line Total', rowNum));
        }

        // Fulfillment status validation
        if (row.fulfillment_status) {
          errors.push(...validateChoice(row.fulfillment_status, 'Fulfillment Status', 
            ['PENDING', 'PARTIAL', 'COMPLETE', 'CANCELLED'], rowNum));
        }
      }
    }

    return errors;
  }

  async generatePreview(data: SalesOrderImportData[], fieldMappings: FieldMapping[]): Promise<ImportPreview> {
    const processed = this.groupIntoSalesOrders(data);
    
    return {
      totalRecords: processed.length,
      sampleData: processed.slice(0, 5).map(so => ({
        'Sales Order': so.header.so_number,
        'Customer': so.header.customer_name || so.header.customer_id,
        'Order Date': so.header.order_date,
        'Status': so.header.status || 'PENDING',
        'Line Count': so.lines.length,
        'Total': so.header.total_amount || 'Calculated'
      })),
      fieldMappings
    };
  }

  async importData(data: SalesOrderImportData[], fieldMappings: FieldMapping[], jobData: ImportJobData): Promise<ImportResult> {
    const errors: ValidationError[] = [];
    const successful: any[] = [];
    let processed = 0;

    try {
      // Group data into sales orders with their line items
      const salesOrders = this.groupIntoSalesOrders(data);
      
      // Cache reference data
      const customerCache = await this.buildCustomerCache();
      const salesRepCache = await this.buildSalesRepCache();
      const productCache = await this.buildProductCache();
      const estimateCache = await this.buildEstimateCache();

      for (const [index, soData] of salesOrders.entries()) {
        try {
          // Update progress
          const progress = Math.round((processed / salesOrders.length) * 100);
          if (jobData.onProgress) {
            await jobData.onProgress(progress, `Processing sales order ${processed + 1} of ${salesOrders.length}`);
          }

          // Process header data
          const headerData = await this.processHeaderData(soData.header, customerCache, salesRepCache, estimateCache);
          
          // Insert sales order
          const { data: insertedSO, error: soError } = await supabase
            .from('sales_orders')
            .insert([headerData])
            .select('id, so_number')
            .single();

          if (soError) {
            errors.push({ row: index + 1, field: 'sales_order', message: `Failed to insert sales order: ${soError.message}` });
            continue;
          }

          // Process line items
          const lineData = await this.processLineItems(soData.lines, insertedSO.id, productCache);
          
          if (lineData.length > 0) {
            const { error: linesError } = await supabase
              .from('sales_order_lines')
              .insert(lineData);

            if (linesError) {
              // Try to delete the header since lines failed
              await supabase.from('sales_orders').delete().eq('id', insertedSO.id);
              errors.push({ row: index + 1, field: 'lines', message: `Failed to insert line items: ${linesError.message}` });
              continue;
            }
          }

          successful.push({
            so_number: insertedSO.so_number,
            id: insertedSO.id,
            line_count: lineData.length
          });

          processed++;

        } catch (error) {
          errors.push({ 
            row: index + 1, 
            field: 'processing', 
            message: `Error processing sales order: ${error instanceof Error ? error.message : 'Unknown error'}` 
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

  private groupIntoSalesOrders(data: SalesOrderImportData[]): ProcessedSalesOrder[] {
    const salesOrderMap = new Map<string, ProcessedSalesOrder>();

    for (const row of data) {
      const soNumber = row.so_number;
      
      if (!salesOrderMap.has(soNumber)) {
        // Create new sales order
        salesOrderMap.set(soNumber, {
          header: { ...row },
          lines: []
        });
      }

      const so = salesOrderMap.get(soNumber)!;

      // If this row has line item data, add it as a line
      const hasLineData = row.line_number || row.product_name || row.product_id || row.item_code || row.quantity;
      if (hasLineData) {
        so.lines.push({ ...row });
      }

      // Update header with any non-empty values (last wins)
      Object.keys(row).forEach(key => {
        const value = (row as any)[key];
        if (value && value.toString().trim() !== '') {
          (so.header as any)[key] = value;
        }
      });
    }

    return Array.from(salesOrderMap.values());
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
    const { data: salesReps } = await supabase.from('sales_reps').select('id, name');
    const cache = new Map<string, any>();
    
    salesReps?.forEach(sr => {
      cache.set(sr.id, sr);
      if (sr.name) cache.set(sr.name.toLowerCase(), sr);
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

  private async buildEstimateCache() {
    const { data: estimates } = await supabase.from('estimates').select('id, estimate_number');
    const cache = new Map<string, any>();
    
    estimates?.forEach(e => {
      cache.set(e.id, e);
      if (e.estimate_number) cache.set(e.estimate_number.toLowerCase(), e);
    });
    
    return cache;
  }

  private async processHeaderData(header: SalesOrderImportData, customerCache: Map<string, any>, salesRepCache: Map<string, any>, estimateCache: Map<string, any>) {
    // Resolve customer
    const customerKey = header.customer_id || header.customer_name?.toLowerCase() || '';
    const customer = customerCache.get(customerKey);
    
    // Resolve sales rep
    const salesRepKey = header.sales_rep_id || header.sales_rep_name?.toLowerCase() || '';
    const salesRep = salesRepCache.get(salesRepKey);
    
    // Resolve source estimate
    const estimateKey = header.source_estimate_number?.toLowerCase() || '';
    const estimate = estimateCache.get(estimateKey);

    return {
      so_number: header.so_number,
      customer_id: customer?.id || null,
      sales_rep_id: salesRep?.id || null,
      source_estimate_id: estimate?.id || null,
      estimate_number: header.source_estimate_number || null,
      
      // Dates
      order_date: header.order_date || new Date().toISOString().split('T')[0],
      ship_date: header.ship_date || null,
      due_date: header.due_date || null,
      
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
      discount_percent: this.parseNumber(header.discount_percent) ?? 0,
      total_amount: this.parseNumber(header.total_amount) ?? 0,
      
      // Status
      status: header.status || 'PENDING',
      
      // Notes
      internal_notes: header.internal_notes || null,
      customer_notes: header.customer_notes || null,
      terms_and_conditions: header.terms_and_conditions || null,
    };
  }

  private async processLineItems(lines: SalesOrderImportData[], salesOrderId: string, productCache: Map<string, any>) {
    return lines.map((line, index) => {
      // Resolve product
      const productKey = line.product_id || line.product_name?.toLowerCase() || line.item_code?.toLowerCase() || '';
      const product = productCache.get(productKey);

      // Calculate line total if not provided
      const quantity = this.parseNumber(line.quantity) ?? 1;
      const unitPrice = this.parseNumber(line.unit_price) ?? 0;
      const discountAmount = this.parseNumber(line.line_discount_amount) ?? 0;
      const discountPercent = this.parseNumber(line.line_discount_percent) ?? 0;
      
      let lineTotal = quantity * unitPrice;
      if (discountAmount > 0) {
        lineTotal -= discountAmount;
      } else if (discountPercent > 0) {
        lineTotal *= (1 - discountPercent / 100);
      }

      return {
        sales_order_id: salesOrderId,
        line_number: this.parseNumber(line.line_number) ?? (index + 1),
        product_id: product?.id || null,
        item_code: line.item_code || product?.sku || null,
        description: line.line_description || product?.name || null,
        quantity,
        unit_price: unitPrice,
        unit_of_measure: line.unit_of_measure || 'ea',
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        tax_code: line.line_tax_code || null,
        tax_rate: this.parseNumber(line.line_tax_rate) ?? 0,
        tax_amount: this.parseNumber(line.line_tax_amount) ?? 0,
        line_total: this.parseNumber(line.line_total) ?? lineTotal,
        fulfillment_status: line.fulfillment_status || 'PENDING'
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
      .from('sales_orders')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }

  async checkForDuplicates(data: SalesOrderImportData[]): Promise<{ field: string; values: string[] }[]> {
    const soNumbers = [...new Set(data.map(row => row.so_number).filter(Boolean))];
    
    if (soNumbers.length === 0) return [];

    const { data: existing } = await supabase
      .from('sales_orders')
      .select('so_number')
      .in('so_number', soNumbers);

    const duplicates = existing?.map(item => item.so_number) || [];

    return duplicates.length > 0 ? [{ field: 'so_number', values: duplicates }] : [];
  }
}