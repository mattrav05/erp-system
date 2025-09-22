// Export service for generating CSV exports from database data
import { supabase } from './supabase';

export interface ExportField {
  field: string;
  label: string;
  selected: boolean;
  type?: string;
}

export interface ExportOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  dateFormat?: string;
  numberFormat?: string;
}

export class ExportService {
  private static formatValue(value: any, type: string = 'string', options: ExportOptions = {}): string {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'currency':
        return typeof value === 'number' ? value.toFixed(2) : value.toString();
      case 'percentage':
        return typeof value === 'number' ? `${value}%` : value.toString();
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'date':
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        if (typeof value === 'string') {
          return new Date(value).toISOString().split('T')[0];
        }
        return value.toString();
      case 'number':
        return typeof value === 'number' ? value.toString() : value.toString();
      default:
        return value.toString();
    }
  }

  private static escapeCSVValue(value: string, delimiter: string = ','): string {
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private static generateCSV(data: any[], fields: ExportField[], options: ExportOptions = {}): string {
    const { delimiter = ',', includeHeaders = true } = options;
    const selectedFields = fields.filter(f => f.selected);
    
    let csv = '';
    
    // Add headers
    if (includeHeaders) {
      const headers = selectedFields.map(f => this.escapeCSVValue(f.label, delimiter));
      csv += headers.join(delimiter) + '\n';
    }
    
    // Add data rows
    for (const row of data) {
      const values = selectedFields.map(field => {
        const rawValue = row[field.field];
        const formattedValue = this.formatValue(rawValue, field.type, options);
        return this.escapeCSVValue(formattedValue, delimiter);
      });
      csv += values.join(delimiter) + '\n';
    }
    
    return csv;
  }

  // Export Customers
  static async exportCustomers(fields: ExportField[], options: ExportOptions = {}): Promise<string> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('company_name');

    if (error) throw error;
    
    return this.generateCSV(data || [], fields, options);
  }

  // Export Vendors
  static async exportVendors(fields: ExportField[], options: ExportOptions = {}): Promise<string> {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('company_name');

    if (error) throw error;
    
    return this.generateCSV(data || [], fields, options);
  }

  // Export Products
  static async exportProducts(fields: ExportField[], options: ExportOptions = {}): Promise<string> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');

    if (error) throw error;
    
    return this.generateCSV(data || [], fields, options);
  }

  // Export Inventory with detailed information
  static async exportInventory(fields: ExportField[], options: ExportOptions = {}): Promise<string> {
    // Use the inventory_summary view for comprehensive data
    const { data, error } = await supabase
      .from('inventory_summary')
      .select('*')
      .order('product_name, location_code');

    if (error) {
      // Fallback to basic inventory table if view doesn't exist
      console.warn('inventory_summary view not found, using basic inventory table');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('inventory')
        .select(`
          *,
          products (
            sku,
            name,
            category
          )
        `)
        .order('created_at');

      if (fallbackError) throw fallbackError;

      // Transform the data to match expected format
      const transformedData = (fallbackData || []).map(item => ({
        ...item,
        product_sku: (item.products as any)?.sku || '',
        product_name: (item.products as any)?.name || '',
        product_category: (item.products as any)?.category || '',
        // Calculate inventory value
        inventory_value: item.quantity_on_hand * (item.weighted_average_cost || 0),
        available_value: (item.quantity_on_hand - (item.quantity_allocated || 0)) * (item.weighted_average_cost || 0),
        // Calculate stock status
        stock_status: this.getStockStatus(item),
        // Calculate reorder needed
        reorder_needed: item.safety_stock ? (item.quantity_on_hand - (item.quantity_allocated || 0)) <= item.safety_stock : false,
        // QB variance calculation
        qb_quantity_variance: item.qb_quantity_on_hand ? item.quantity_on_hand - item.qb_quantity_on_hand : null,
      }));

      return this.generateCSV(transformedData, fields, options);
    }

    return this.generateCSV(data || [], fields, options);
  }

  // Export Sales Orders
  static async exportSalesOrders(fields: ExportField[], options: ExportOptions = {}): Promise<string> {
    const { data, error } = await supabase
      .from('sales_orders')
      .select(`
        *,
        customers (company_name),
        sales_order_lines (
          line_number,
          product_id,
          description,
          quantity,
          unit_price,
          line_total
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Flatten the data to include line items
    const flattenedData: any[] = [];
    (data || []).forEach(so => {
      if (so.sales_order_lines && so.sales_order_lines.length > 0) {
        so.sales_order_lines.forEach((line: any) => {
          flattenedData.push({
            ...so,
            customer_name: (so.customers as any)?.company_name || '',
            line_number: line.line_number,
            line_description: line.description,
            line_quantity: line.quantity,
            line_unit_price: line.unit_price,
            line_total: line.line_total
          });
        });
      } else {
        // Include header-only sales orders
        flattenedData.push({
          ...so,
          customer_name: (so.customers as any)?.company_name || '',
        });
      }
    });
    
    return this.generateCSV(flattenedData, fields, options);
  }

  // Export Purchase Orders
  static async exportPurchaseOrders(fields: ExportField[], options: ExportOptions = {}): Promise<string> {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        vendors (company_name),
        purchase_order_lines (
          line_number,
          product_id,
          description,
          quantity,
          unit_cost,
          line_total
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Flatten the data to include line items
    const flattenedData: any[] = [];
    (data || []).forEach(po => {
      if (po.purchase_order_lines && po.purchase_order_lines.length > 0) {
        po.purchase_order_lines.forEach((line: any) => {
          flattenedData.push({
            ...po,
            vendor_name: (po.vendors as any)?.company_name || '',
            line_number: line.line_number,
            line_description: line.description,
            line_quantity: line.quantity,
            line_unit_cost: line.unit_cost,
            line_total: line.line_total
          });
        });
      } else {
        // Include header-only purchase orders
        flattenedData.push({
          ...po,
          vendor_name: (po.vendors as any)?.company_name || '',
        });
      }
    });
    
    return this.generateCSV(flattenedData, fields, options);
  }

  // Export Estimates
  static async exportEstimates(fields: ExportField[], options: ExportOptions = {}): Promise<string> {
    const { data, error } = await supabase
      .from('estimates')
      .select(`
        *,
        customers (company_name),
        estimate_lines (
          line_number,
          product_id,
          description,
          quantity,
          unit_price,
          line_total
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Flatten the data to include line items
    const flattenedData: any[] = [];
    (data || []).forEach(estimate => {
      if (estimate.estimate_lines && estimate.estimate_lines.length > 0) {
        estimate.estimate_lines.forEach((line: any) => {
          flattenedData.push({
            ...estimate,
            customer_name: (estimate.customers as any)?.company_name || '',
            line_number: line.line_number,
            line_description: line.description,
            line_quantity: line.quantity,
            line_unit_price: line.unit_price,
            line_total: line.line_total
          });
        });
      } else {
        // Include header-only estimates
        flattenedData.push({
          ...estimate,
          customer_name: (estimate.customers as any)?.company_name || '',
        });
      }
    });
    
    return this.generateCSV(flattenedData, fields, options);
  }

  // Helper function to determine stock status
  private static getStockStatus(item: any): string {
    const availableQty = item.quantity_on_hand - (item.quantity_allocated || 0);
    
    if (availableQty <= 0) return 'OUT_OF_STOCK';
    if (item.safety_stock && availableQty <= item.safety_stock) return 'BELOW_SAFETY_STOCK';
    if (item.max_stock_level && item.quantity_on_hand >= item.max_stock_level) return 'OVERSTOCK';
    return 'OK';
  }

  // Main export function that routes to the correct module
  static async exportModule(module: string, fields: ExportField[], options: ExportOptions = {}): Promise<string> {
    switch (module) {
      case 'customers':
        return this.exportCustomers(fields, options);
      case 'vendors':
        return this.exportVendors(fields, options);
      case 'products':
        return this.exportProducts(fields, options);
      case 'inventory':
        return this.exportInventory(fields, options);
      case 'sales_orders':
        return this.exportSalesOrders(fields, options);
      case 'purchase_orders':
        return this.exportPurchaseOrders(fields, options);
      case 'estimates':
        return this.exportEstimates(fields, options);
      default:
        throw new Error(`Export not implemented for module: ${module}`);
    }
  }

  // Download function to trigger file download
  static downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}