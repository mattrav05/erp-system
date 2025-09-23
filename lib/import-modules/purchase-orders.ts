import { ImportModule, ImportResult, ValidationError, ImportPreview, FieldMapping, ImportJobData } from '../import-service';
import { supabase } from '../supabase';
import { validateRequired, validateDate, validateNumber, validateChoice } from '../csv-utils';

interface PurchaseOrderImportData {
  // Purchase Order Header
  po_number: string;
  vendor_name?: string;
  vendor_id?: string;
  sales_rep_name?: string;
  sales_rep_id?: string;
  
  // Dates
  order_date?: string;
  expected_delivery_date?: string;
  ship_date?: string;
  
  // Reference information
  vendor_reference?: string;
  
  // Billing Address
  bill_to_company_name?: string;
  bill_to_contact_name?: string;
  bill_to_address_line_1?: string;
  bill_to_address_line_2?: string;
  bill_to_city?: string;
  bill_to_state?: string;
  bill_to_zip_code?: string;
  bill_to_country?: string;
  
  // Shipping Address
  ship_to_company_name?: string;
  ship_to_contact_name?: string;
  ship_to_address_line_1?: string;
  ship_to_address_line_2?: string;
  ship_to_city?: string;
  ship_to_state?: string;
  ship_to_zip_code?: string;
  ship_to_country?: string;
  ship_to_same_as_billing?: string;
  
  // Financial
  subtotal?: string;
  tax_rate?: string;
  tax_amount?: string;
  total_amount?: string;
  
  // Status
  status?: string;
  
  // Notes
  internal_notes?: string;
  vendor_notes?: string;
  terms_and_conditions?: string;
  
  // Source tracking
  source_sales_order_number?: string;
  source_sales_order_id?: string;
  
  // Line Items (multiple lines can share same header data)
  line_number?: string;
  product_name?: string;
  product_id?: string;
  item_code?: string;
  line_description?: string;
  quantity?: string;
  unit_price?: string;
  unit_of_measure?: string;
  line_total?: string;
  tax_code?: string;
  line_tax_rate?: string;
  line_tax_amount?: string;
  quantity_received?: string;
  quantity_reserved?: string;
}

interface ProcessedPurchaseOrder {
  header: any;
  lines: any[];
}

export class PurchaseOrderImportModule implements ImportModule {
  name = 'Purchase Orders';
  description = 'Import purchase orders with line items and vendor relationships';
  
  // Available fields for mapping
  availableFields = [
    { key: 'po_number', label: 'Purchase Order Number', type: 'text', required: true },
    { key: 'vendor_name', label: 'Vendor Name', type: 'text' },
    { key: 'vendor_id', label: 'Vendor ID', type: 'text' },
    { key: 'sales_rep_name', label: 'Sales Rep Name', type: 'text' },
    { key: 'sales_rep_id', label: 'Sales Rep ID', type: 'text' },
    
    // Dates
    { key: 'order_date', label: 'Order Date', type: 'date' },
    { key: 'expected_delivery_date', label: 'Expected Delivery Date', type: 'date' },
    { key: 'ship_date', label: 'Ship Date', type: 'date' },
    
    // Reference
    { key: 'vendor_reference', label: 'Vendor Reference', type: 'text' },
    
    // Billing Address
    { key: 'bill_to_company_name', label: 'Bill To Company', type: 'text' },
    { key: 'bill_to_contact_name', label: 'Bill To Contact', type: 'text' },
    { key: 'bill_to_address_line_1', label: 'Bill To Address Line 1', type: 'text' },
    { key: 'bill_to_address_line_2', label: 'Bill To Address Line 2', type: 'text' },
    { key: 'bill_to_city', label: 'Bill To City', type: 'text' },
    { key: 'bill_to_state', label: 'Bill To State', type: 'text' },
    { key: 'bill_to_zip_code', label: 'Bill To ZIP', type: 'text' },
    { key: 'bill_to_country', label: 'Bill To Country', type: 'text' },
    
    // Shipping Address
    { key: 'ship_to_company_name', label: 'Ship To Company', type: 'text' },
    { key: 'ship_to_contact_name', label: 'Ship To Contact', type: 'text' },
    { key: 'ship_to_address_line_1', label: 'Ship To Address Line 1', type: 'text' },
    { key: 'ship_to_address_line_2', label: 'Ship To Address Line 2', type: 'text' },
    { key: 'ship_to_city', label: 'Ship To City', type: 'text' },
    { key: 'ship_to_state', label: 'Ship To State', type: 'text' },
    { key: 'ship_to_zip_code', label: 'Ship To ZIP', type: 'text' },
    { key: 'ship_to_country', label: 'Ship To Country', type: 'text' },
    { key: 'ship_to_same_as_billing', label: 'Ship To Same as Billing', type: 'boolean' },
    
    // Financial
    { key: 'subtotal', label: 'Subtotal', type: 'number' },
    { key: 'tax_rate', label: 'Tax Rate (%)', type: 'number' },
    { key: 'tax_amount', label: 'Tax Amount', type: 'number' },
    { key: 'total_amount', label: 'Total Amount', type: 'number' },
    
    // Status
    { key: 'status', label: 'Status', type: 'choice', 
      choices: ['PENDING', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CANCELLED', 'ON_HOLD'] },
    
    // Notes
    { key: 'internal_notes', label: 'Internal Notes', type: 'text' },
    { key: 'vendor_notes', label: 'Vendor Notes', type: 'text' },
    { key: 'terms_and_conditions', label: 'Terms and Conditions', type: 'text' },
    
    // Source tracking
    { key: 'source_sales_order_number', label: 'Source Sales Order Number', type: 'text' },
    { key: 'source_sales_order_id', label: 'Source Sales Order ID', type: 'text' },
    
    // Line Items
    { key: 'line_number', label: 'Line Number', type: 'number' },
    { key: 'product_name', label: 'Product Name', type: 'text' },
    { key: 'product_id', label: 'Product ID', type: 'text' },
    { key: 'item_code', label: 'Item Code', type: 'text' },
    { key: 'line_description', label: 'Line Description', type: 'text' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'unit_price', label: 'Unit Price', type: 'number' },
    { key: 'unit_of_measure', label: 'Unit of Measure', type: 'text' },
    { key: 'line_total', label: 'Line Total', type: 'number' },
    { key: 'tax_code', label: 'Tax Code', type: 'text' },
    { key: 'line_tax_rate', label: 'Line Tax Rate', type: 'number' },
    { key: 'line_tax_amount', label: 'Line Tax Amount', type: 'number' },
    { key: 'quantity_received', label: 'Quantity Received', type: 'number' },
    { key: 'quantity_reserved', label: 'Quantity Reserved', type: 'number' },
  ];

  async validateData(data: PurchaseOrderImportData[], fieldMappings: FieldMapping[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Cache lookups
    const vendorCache = new Map<string, any>();
    const salesRepCache = new Map<string, any>();
    const productCache = new Map<string, any>();
    const salesOrderCache = new Map<string, any>();
    
    // Load reference data
    const { data: vendors } = await supabase.from('vendors').select('id, vendor_name');
    const { data: salesReps } = await supabase.from('sales_reps').select('id, name');
    const { data: products } = await supabase.from('products').select('id, name, sku');
    const { data: salesOrders } = await supabase.from('sales_orders').select('id, so_number');
    
    // Build lookup caches
    vendors?.forEach(v => {
      vendorCache.set(v.id, v);
      vendorCache.set(v.vendor_name?.toLowerCase() || '', v);
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

    salesOrders?.forEach(so => {
      salesOrderCache.set(so.id, so);
      salesOrderCache.set(so.so_number?.toLowerCase() || '', so);
    });

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Account for header row

      // Required fields
      const poError = validateRequired(row.po_number, 'Purchase Order Number', rowNum);
      if (poError) errors.push(poError);

      // Vendor validation - require either ID or name
      if (!row.vendor_id && !row.vendor_name) {
        errors.push({ row: rowNum, field: 'vendor_id/vendor_name', message: 'Either Vendor ID or Vendor Name is required', severity: 'error' });
      } else {
        // Validate vendor exists
        const vendorKey = row.vendor_id || row.vendor_name?.toLowerCase() || '';
        if (!vendorCache.has(vendorKey)) {
          errors.push({ row: rowNum, field: 'vendor', message: `Vendor '${row.vendor_id || row.vendor_name}' not found`, severity: 'error' });
        }
      }

      // Sales rep validation (optional)
      if (row.sales_rep_id || row.sales_rep_name) {
        const salesRepKey = row.sales_rep_id || row.sales_rep_name?.toLowerCase() || '';
        if (!salesRepCache.has(salesRepKey)) {
          errors.push({ row: rowNum, field: 'sales_rep', message: `Sales rep '${row.sales_rep_id || row.sales_rep_name}' not found`, severity: 'error' });
        }
      }

      // Date validations
      if (row.order_date) {
        errors.push(...validateDate(row.order_date, 'Order Date', rowNum));
      }
      if (row.expected_delivery_date) {
        errors.push(...validateDate(row.expected_delivery_date, 'Expected Delivery Date', rowNum));
      }
      if (row.ship_date) {
        errors.push(...validateDate(row.ship_date, 'Ship Date', rowNum));
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
      if (row.total_amount) {
        errors.push(...validateNumber(row.total_amount, 'Total Amount', rowNum));
      }

      // Status validation
      if (row.status) {
        errors.push(...validateChoice(row.status, 'Status', 
          ['PENDING', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CANCELLED', 'ON_HOLD'], rowNum));
      }

      // Boolean validation
      if (row.ship_to_same_as_billing) {
        if (!['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(row.ship_to_same_as_billing.toLowerCase())) {
          errors.push({ row: rowNum, field: 'ship_to_same_as_billing', message: 'Must be true/false, yes/no, or 1/0' });
        }
      }

      // Source sales order validation (optional)
      if (row.source_sales_order_number || row.source_sales_order_id) {
        const soKey = row.source_sales_order_id || row.source_sales_order_number?.toLowerCase() || '';
        if (!salesOrderCache.has(soKey)) {
          errors.push({ row: rowNum, field: 'source_sales_order', message: `Sales order '${row.source_sales_order_id || row.source_sales_order_number}' not found` });
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

        // Description is required for PO lines
        if (!row.line_description && !row.product_name) {
          errors.push({ row: rowNum, field: 'line_description', message: 'Line description is required for line items' });
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
        if (row.line_tax_rate) {
          errors.push(...validateNumber(row.line_tax_rate, 'Line Tax Rate', rowNum));
        }
        if (row.line_tax_amount) {
          errors.push(...validateNumber(row.line_tax_amount, 'Line Tax Amount', rowNum));
        }
        if (row.quantity_received) {
          errors.push(...validateNumber(row.quantity_received, 'Quantity Received', rowNum));
        }
        if (row.quantity_reserved) {
          errors.push(...validateNumber(row.quantity_reserved, 'Quantity Reserved', rowNum));
        }
      }
    }

    return errors;
  }

  async generatePreview(data: PurchaseOrderImportData[], fieldMappings: FieldMapping[]): Promise<ImportPreview> {
    const processed = this.groupIntoPurchaseOrders(data);
    
    return {
      totalRecords: processed.length,
      sampleData: processed.slice(0, 5).map(po => ({
        'Purchase Order': po.header.po_number,
        'Vendor': po.header.vendor_name || po.header.vendor_id,
        'Order Date': po.header.order_date,
        'Status': po.header.status || 'PENDING',
        'Line Count': po.lines.length,
        'Total': po.header.total_amount || 'Calculated'
      })),
      fieldMappings
    };
  }

  async importData(data: PurchaseOrderImportData[], fieldMappings: FieldMapping[], jobData: ImportJobData): Promise<ImportResult> {
    const errors: ValidationError[] = [];
    const successful: any[] = [];
    let processed = 0;

    try {
      // Group data into purchase orders with their line items
      const purchaseOrders = this.groupIntoPurchaseOrders(data);
      
      // Cache reference data
      const vendorCache = await this.buildVendorCache();
      const salesRepCache = await this.buildSalesRepCache();
      const productCache = await this.buildProductCache();
      const salesOrderCache = await this.buildSalesOrderCache();

      for (const [index, poData] of purchaseOrders.entries()) {
        try {
          // Update progress
          const progress = Math.round((processed / purchaseOrders.length) * 100);
          if (jobData.onProgress) {
            await jobData.onProgress(progress, `Processing purchase order ${processed + 1} of ${purchaseOrders.length}`);
          }

          // Process header data
          const headerData = await this.processHeaderData(poData.header, vendorCache, salesRepCache, salesOrderCache);
          
          // Insert purchase order
          const { data: insertedPO, error: poError } = await supabase
            .from('purchase_orders')
            .insert([headerData])
            .select('id, po_number')
            .single();

          if (poError) {
            errors.push({ row: index + 1, field: 'purchase_order', message: `Failed to insert purchase order: ${poError.message}` });
            continue;
          }

          // Process line items
          const lineData = await this.processLineItems(poData.lines, insertedPO.id, productCache);
          
          if (lineData.length > 0) {
            const { error: linesError } = await supabase
              .from('purchase_order_lines')
              .insert(lineData);

            if (linesError) {
              // Try to delete the header since lines failed
              await supabase.from('purchase_orders').delete().eq('id', insertedPO.id);
              errors.push({ row: index + 1, field: 'lines', message: `Failed to insert line items: ${linesError.message}` });
              continue;
            }
          }

          successful.push({
            po_number: insertedPO.po_number,
            id: insertedPO.id,
            line_count: lineData.length
          });

          processed++;

        } catch (error) {
          errors.push({ 
            row: index + 1, 
            field: 'processing', 
            message: `Error processing purchase order: ${error instanceof Error ? error.message : 'Unknown error'}` 
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

  private groupIntoPurchaseOrders(data: PurchaseOrderImportData[]): ProcessedPurchaseOrder[] {
    const purchaseOrderMap = new Map<string, ProcessedPurchaseOrder>();

    for (const row of data) {
      const poNumber = row.po_number;
      
      if (!purchaseOrderMap.has(poNumber)) {
        // Create new purchase order
        purchaseOrderMap.set(poNumber, {
          header: { ...row },
          lines: []
        });
      }

      const po = purchaseOrderMap.get(poNumber)!;

      // If this row has line item data, add it as a line
      const hasLineData = row.line_number || row.product_name || row.product_id || row.item_code || row.quantity;
      if (hasLineData) {
        po.lines.push({ ...row });
      }

      // Update header with any non-empty values (last wins)
      Object.keys(row).forEach(key => {
        const value = (row as any)[key];
        if (value && value.toString().trim() !== '') {
          (po.header as any)[key] = value;
        }
      });
    }

    return Array.from(purchaseOrderMap.values());
  }

  private async buildVendorCache() {
    const { data: vendors } = await supabase.from('vendors').select('id, vendor_name');
    const cache = new Map<string, any>();
    
    vendors?.forEach(v => {
      cache.set(v.id, v);
      if (v.vendor_name) cache.set(v.vendor_name.toLowerCase(), v);
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

  private async buildSalesOrderCache() {
    const { data: salesOrders } = await supabase.from('sales_orders').select('id, so_number');
    const cache = new Map<string, any>();
    
    salesOrders?.forEach(so => {
      cache.set(so.id, so);
      if (so.so_number) cache.set(so.so_number.toLowerCase(), so);
    });
    
    return cache;
  }

  private async processHeaderData(header: PurchaseOrderImportData, vendorCache: Map<string, any>, salesRepCache: Map<string, any>, salesOrderCache: Map<string, any>) {
    // Resolve vendor
    const vendorKey = header.vendor_id || header.vendor_name?.toLowerCase() || '';
    const vendor = vendorCache.get(vendorKey);
    
    // Resolve sales rep
    const salesRepKey = header.sales_rep_id || header.sales_rep_name?.toLowerCase() || '';
    const salesRep = salesRepCache.get(salesRepKey);
    
    // Resolve source sales order
    const soKey = header.source_sales_order_id || header.source_sales_order_number?.toLowerCase() || '';
    const salesOrder = salesOrderCache.get(soKey);

    return {
      po_number: header.po_number,
      vendor_id: vendor?.id || null,
      sales_rep_id: salesRep?.id || null,
      source_sales_order_id: salesOrder?.id || null,
      
      // Dates
      order_date: header.order_date || new Date().toISOString().split('T')[0],
      expected_delivery_date: header.expected_delivery_date || null,
      ship_date: header.ship_date || null,
      
      // Reference
      vendor_reference: header.vendor_reference || null,
      
      // Billing address
      bill_to_company_name: header.bill_to_company_name || null,
      bill_to_contact_name: header.bill_to_contact_name || null,
      bill_to_address_line_1: header.bill_to_address_line_1 || null,
      bill_to_address_line_2: header.bill_to_address_line_2 || null,
      bill_to_city: header.bill_to_city || null,
      bill_to_state: header.bill_to_state || null,
      bill_to_zip_code: header.bill_to_zip_code || null,
      bill_to_country: header.bill_to_country || 'US',
      
      // Shipping address
      ship_to_company_name: header.ship_to_company_name || null,
      ship_to_contact_name: header.ship_to_contact_name || null,
      ship_to_address_line_1: header.ship_to_address_line_1 || null,
      ship_to_address_line_2: header.ship_to_address_line_2 || null,
      ship_to_city: header.ship_to_city || null,
      ship_to_state: header.ship_to_state || null,
      ship_to_zip_code: header.ship_to_zip_code || null,
      ship_to_country: header.ship_to_country || 'US',
      ship_to_same_as_billing: this.parseBoolean(header.ship_to_same_as_billing) ?? true,
      
      // Financial
      subtotal: this.parseNumber(header.subtotal) ?? 0,
      tax_rate: this.parseNumber(header.tax_rate) ?? 0,
      tax_amount: this.parseNumber(header.tax_amount) ?? 0,
      total_amount: this.parseNumber(header.total_amount) ?? 0,
      
      // Status
      status: header.status || 'PENDING',
      
      // Notes
      internal_notes: header.internal_notes || null,
      vendor_notes: header.vendor_notes || null,
      terms_and_conditions: header.terms_and_conditions || null,
    };
  }

  private async processLineItems(lines: PurchaseOrderImportData[], purchaseOrderId: string, productCache: Map<string, any>) {
    return lines.map((line, index) => {
      // Resolve product
      const productKey = line.product_id || line.product_name?.toLowerCase() || line.item_code?.toLowerCase() || '';
      const product = productCache.get(productKey);

      // Calculate line total if not provided
      const quantity = this.parseNumber(line.quantity) ?? 1;
      const unitPrice = this.parseNumber(line.unit_price) ?? 0;
      const lineTotal = this.parseNumber(line.line_total) ?? (quantity * unitPrice);

      return {
        purchase_order_id: purchaseOrderId,
        line_number: this.parseNumber(line.line_number) ?? (index + 1),
        product_id: product?.id || null,
        item_code: line.item_code || product?.sku || null,
        description: line.line_description || product?.name || 'Unknown item',
        quantity,
        unit_price: unitPrice,
        unit_of_measure: line.unit_of_measure || 'ea',
        line_total: lineTotal,
        tax_code: line.tax_code || 'NON',
        tax_rate: this.parseNumber(line.line_tax_rate) ?? 0,
        tax_amount: this.parseNumber(line.line_tax_amount) ?? 0,
        quantity_received: this.parseNumber(line.quantity_received) ?? 0,
        quantity_reserved: this.parseNumber(line.quantity_reserved) ?? 0
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
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }

  async checkForDuplicates(data: PurchaseOrderImportData[]): Promise<{ field: string; values: string[] }[]> {
    const poNumbers = [...new Set(data.map(row => row.po_number).filter(Boolean))];
    
    if (poNumbers.length === 0) return [];

    const { data: existing } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .in('po_number', poNumbers);

    const duplicates = existing?.map(item => item.po_number) || [];

    return duplicates.length > 0 ? [{ field: 'po_number', values: duplicates }] : [];
  }
}