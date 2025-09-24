import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'erp-auth-token'
  },
  global: {
    headers: {
      'x-application-name': 'erp-system'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  db: {
    schema: 'public'
  }
})

// Types for our database tables
export interface Database {
  public: {
    Tables: {
      // Customers
      customers: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          billing_address: string | null
          shipping_address: string | null
          payment_terms: string | null
          credit_limit: number | null
          tax_exempt: boolean
          version?: number
          last_modified_by?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          billing_address?: string | null
          shipping_address?: string | null
          payment_terms?: string | null
          credit_limit?: number | null
          tax_exempt?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          phone?: string | null
          billing_address?: string | null
          shipping_address?: string | null
          payment_terms?: string | null
          credit_limit?: number | null
          tax_exempt?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      
      // Vendors
      vendors: {
        Row: {
          id: string
          name: string
          contact_email: string | null
          contact_phone: string | null
          address: string | null
          payment_terms: string | null
          tax_id: string | null
          version?: number
          last_modified_by?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          contact_email?: string | null
          contact_phone?: string | null
          address?: string | null
          payment_terms?: string | null
          tax_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact_email?: string | null
          contact_phone?: string | null
          address?: string | null
          payment_terms?: string | null
          tax_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      
      // Products
      products: {
        Row: {
          id: string
          sku: string
          manufacturer_part_number: string | null
          name: string
          description: string | null
          category: string | null
          unit_of_measure: string
          weight: number | null
          dimensions: string | null
          is_inventory_item: boolean
          is_shippable: boolean
          track_inventory: boolean
          default_markup_percentage: number | null
          default_tax_code: string | null
          default_tax_rate: number | null
          reorder_point: number | null
          reorder_quantity: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          manufacturer_part_number?: string | null
          name: string
          description?: string | null
          category?: string | null
          unit_of_measure: string
          weight?: number | null
          dimensions?: string | null
          is_inventory_item?: boolean
          is_shippable?: boolean
          track_inventory?: boolean
          default_markup_percentage?: number | null
          default_tax_code?: string | null
          default_tax_rate?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          manufacturer_part_number?: string | null
          name?: string
          description?: string | null
          category?: string | null
          unit_of_measure?: string
          weight?: number | null
          dimensions?: string | null
          is_inventory_item?: boolean
          is_shippable?: boolean
          track_inventory?: boolean
          default_markup_percentage?: number | null
          default_tax_code?: string | null
          default_tax_rate?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      
      // Inventory
      inventory: {
        Row: {
          id: string
          product_id: string
          quantity_on_hand: number
          quantity_allocated: number
          quantity_available: number
          reserved: number
          weighted_average_cost: number
          last_cost: number | null
          sales_price: number | null
          location: string | null
          margin_percent: number | null
          markup_percent: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity_on_hand?: number
          quantity_allocated?: number
          quantity_available?: number
          reserved?: number
          weighted_average_cost?: number
          last_cost?: number | null
          sales_price?: number | null
          location?: string | null
          margin_percent?: number | null
          markup_percent?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity_on_hand?: number
          quantity_allocated?: number
          quantity_available?: number
          reserved?: number
          weighted_average_cost?: number
          last_cost?: number | null
          sales_price?: number | null
          location?: string | null
          margin_percent?: number | null
          markup_percent?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      
      // Inventory Adjustments
      inventory_adjustments: {
        Row: {
          id: string
          adjustment_number: string
          reason: string | null
          notes: string | null
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          adjustment_number: string
          reason?: string | null
          notes?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          adjustment_number?: string
          reason?: string | null
          notes?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      
      // Inventory Adjustment Lines
      inventory_adjustment_lines: {
        Row: {
          id: string
          adjustment_id: string
          product_id: string
          quantity_before: number
          quantity_after: number
          quantity_change: number
          cost_before: number | null
          cost_after: number | null
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          adjustment_id: string
          product_id: string
          quantity_before: number
          quantity_after: number
          quantity_change: number
          cost_before?: number | null
          cost_after?: number | null
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          adjustment_id?: string
          product_id?: string
          quantity_before?: number
          quantity_after?: number
          quantity_change?: number
          cost_before?: number | null
          cost_after?: number | null
          reason?: string | null
          created_at?: string
        }
      }
      
      // User Profiles
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          role: 'admin' | 'manager' | 'user'
          is_active: boolean
          last_seen: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          role?: 'admin' | 'manager' | 'user'
          is_active?: boolean
          last_seen?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          first_name?: string | null
          last_name?: string | null
          role?: 'admin' | 'manager' | 'user'
          is_active?: boolean
          last_seen?: string
          updated_at?: string
        }
      }
      
      // Audit Log
      audit_log: {
        Row: {
          id: string
          table_name: string
          record_id: string
          action: 'INSERT' | 'UPDATE' | 'DELETE'
          old_values: any
          new_values: any
          changed_fields: string[]
          user_id: string | null
          user_email: string | null
          ip_address: string | null
          user_agent: string | null
          timestamp: string
          version_before: number | null
          version_after: number | null
        }
        Insert: {
          id?: string
          table_name: string
          record_id: string
          action: 'INSERT' | 'UPDATE' | 'DELETE'
          old_values?: any
          new_values?: any
          changed_fields?: string[]
          user_id?: string | null
          user_email?: string | null
          ip_address?: string | null
          user_agent?: string | null
          timestamp?: string
          version_before?: number | null
          version_after?: number | null
        }
        Update: {} // Audit log should not be updated
      }
      
      // Sales Representatives  
      sales_reps: {
        Row: {
          id: string
          employee_code: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          commission_rate: number
          territory: string | null
          hire_date: string | null
          is_active: boolean
          notes: string | null
          version?: number
          last_modified_by?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_code: string
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          commission_rate?: number
          territory?: string | null
          hire_date?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          employee_code?: string
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          commission_rate?: number
          territory?: string | null
          hire_date?: string | null
          is_active?: boolean
          notes?: string | null
          updated_at?: string
        }
      }
      
      // Estimate Templates
      estimate_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          template_type: 'GENERAL' | 'USER_SAVED'
          created_by: string | null
          is_default: boolean
          header_logo_url: string | null
          header_text: string | null
          footer_text: string | null
          terms_and_conditions: string | null
          show_item_descriptions: boolean
          show_item_images: boolean
          show_labor_section: boolean
          show_materials_section: boolean
          show_subtotals: boolean
          show_taxes: boolean
          show_shipping: boolean
          primary_color: string
          secondary_color: string
          accent_color: string
          font_family: string
          font_size: number
          version?: number
          last_modified_by?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          template_type?: 'GENERAL' | 'USER_SAVED'
          created_by?: string | null
          is_default?: boolean
          header_logo_url?: string | null
          header_text?: string | null
          footer_text?: string | null
          terms_and_conditions?: string | null
          show_item_descriptions?: boolean
          show_item_images?: boolean
          show_labor_section?: boolean
          show_materials_section?: boolean
          show_subtotals?: boolean
          show_taxes?: boolean
          show_shipping?: boolean
          primary_color?: string
          secondary_color?: string
          accent_color?: string
          font_family?: string
          font_size?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          template_type?: 'GENERAL' | 'USER_SAVED'
          is_default?: boolean
          header_logo_url?: string | null
          header_text?: string | null
          footer_text?: string | null
          terms_and_conditions?: string | null
          show_item_descriptions?: boolean
          show_item_images?: boolean
          show_labor_section?: boolean
          show_materials_section?: boolean
          show_subtotals?: boolean
          show_taxes?: boolean
          show_shipping?: boolean
          primary_color?: string
          secondary_color?: string
          accent_color?: string
          font_family?: string
          font_size?: number
          updated_at?: string
        }
      }
      
      // Estimates
      estimates: {
        Row: {
          id: string
          estimate_number: string
          customer_id: string
          sales_rep_id: string | null
          template_id: string | null
          bill_to_company: string | null
          bill_to_contact: string | null
          bill_to_address_line_1: string | null
          bill_to_address_line_2: string | null
          bill_to_city: string | null
          bill_to_state: string | null
          bill_to_zip: string | null
          bill_to_country: string
          ship_to_company: string | null
          ship_to_contact: string | null
          ship_to_address_line_1: string | null
          ship_to_address_line_2: string | null
          ship_to_city: string | null
          ship_to_state: string | null
          ship_to_zip: string | null
          ship_to_country: string
          ship_to_same_as_billing: boolean
          estimate_date: string
          expiration_date: string | null
          reference_number: string | null
          job_name: string | null
          subtotal: number
          tax_rate: number
          tax_amount: number
          shipping_amount: number
          discount_amount: number
          total_amount: number
          status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'
          converted_to_sales_order_id: string | null
          converted_at: string | null
          internal_notes: string | null
          customer_notes: string | null
          terms_and_conditions: string | null
          last_emailed_at: string | null
          email_count: number
          version?: number
          last_modified_by?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          estimate_number: string
          customer_id: string
          sales_rep_id?: string | null
          template_id?: string | null
          bill_to_company?: string | null
          bill_to_contact?: string | null
          bill_to_address_line_1?: string | null
          bill_to_address_line_2?: string | null
          bill_to_city?: string | null
          bill_to_state?: string | null
          bill_to_zip?: string | null
          bill_to_country?: string
          ship_to_company?: string | null
          ship_to_contact?: string | null
          ship_to_address_line_1?: string | null
          ship_to_address_line_2?: string | null
          ship_to_city?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          ship_to_country?: string
          ship_to_same_as_billing?: boolean
          estimate_date?: string
          expiration_date?: string | null
          reference_number?: string | null
          job_name?: string | null
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          shipping_amount?: number
          discount_amount?: number
          total_amount?: number
          status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'
          internal_notes?: string | null
          customer_notes?: string | null
          terms_and_conditions?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          estimate_number?: string
          customer_id?: string
          sales_rep_id?: string | null
          template_id?: string | null
          bill_to_company?: string | null
          bill_to_contact?: string | null
          bill_to_address_line_1?: string | null
          bill_to_address_line_2?: string | null
          bill_to_city?: string | null
          bill_to_state?: string | null
          bill_to_zip?: string | null
          bill_to_country?: string
          ship_to_company?: string | null
          ship_to_contact?: string | null
          ship_to_address_line_1?: string | null
          ship_to_address_line_2?: string | null
          ship_to_city?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          ship_to_country?: string
          ship_to_same_as_billing?: boolean
          estimate_date?: string
          expiration_date?: string | null
          reference_number?: string | null
          job_name?: string | null
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          shipping_amount?: number
          discount_amount?: number
          total_amount?: number
          status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'
          internal_notes?: string | null
          customer_notes?: string | null
          terms_and_conditions?: string | null
          updated_at?: string
        }
      }
      
      // Estimate Line Items
      estimate_lines: {
        Row: {
          id: string
          estimate_id: string
          line_number: number
          item_type: 'PRODUCT' | 'SERVICE' | 'LABOR' | 'MATERIAL' | 'MISC'
          product_id: string | null
          sku: string | null
          description: string
          long_description: string | null
          quantity: number
          unit_of_measure: string
          unit_price: number
          line_total: number
          discount_type: 'NONE' | 'PERCENT' | 'AMOUNT'
          discount_value: number
          discounted_total: number | null
          is_taxable: boolean
          tax_code: string | null
          notes: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          estimate_id: string
          line_number: number
          item_type?: 'PRODUCT' | 'SERVICE' | 'LABOR' | 'MATERIAL' | 'MISC'
          product_id?: string | null
          sku?: string | null
          description: string
          long_description?: string | null
          quantity?: number
          unit_of_measure?: string
          unit_price?: number
          discount_type?: 'NONE' | 'PERCENT' | 'AMOUNT'
          discount_value?: number
          discounted_total?: number | null
          is_taxable?: boolean
          tax_code?: string | null
          notes?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          line_number?: number
          item_type?: 'PRODUCT' | 'SERVICE' | 'LABOR' | 'MATERIAL' | 'MISC'
          product_id?: string | null
          sku?: string | null
          description?: string
          long_description?: string | null
          quantity?: number
          unit_of_measure?: string
          unit_price?: number
          discount_type?: 'NONE' | 'PERCENT' | 'AMOUNT'
          discount_value?: number
          discounted_total?: number | null
          is_taxable?: boolean
          tax_code?: string | null
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
      }
      
      // User Sessions
      user_sessions: {
        Row: {
          id: string
          user_id: string
          table_name: string
          record_id: string
          action: 'viewing' | 'editing'
          started_at: string
          last_ping: string
          metadata: any
        }
        Insert: {
          id?: string
          user_id: string
          table_name: string
          record_id: string
          action: 'viewing' | 'editing'
          started_at?: string
          last_ping?: string
          metadata?: any
        }
        Update: {
          last_ping?: string
          metadata?: any
        }
      }
      
      // Sales Orders
      sales_orders: {
        Row: {
          id: string
          so_number: string
          customer_id: string
          sales_rep_id: string | null
          source_estimate_id: string | null
          estimate_number: string | null
          bill_to_company: string | null
          bill_to_contact: string | null
          bill_to_address_line_1: string | null
          bill_to_address_line_2: string | null
          bill_to_city: string | null
          bill_to_state: string | null
          bill_to_zip: string | null
          bill_to_country: string
          ship_to_company: string | null
          ship_to_contact: string | null
          ship_to_address_line_1: string | null
          ship_to_address_line_2: string | null
          ship_to_city: string | null
          ship_to_state: string | null
          ship_to_zip: string | null
          ship_to_country: string
          ship_to_same_as_billing: boolean
          order_date: string
          ship_date: string | null
          due_date: string | null
          reference_number: string | null
          job_name: string | null
          subtotal: number
          tax_rate: number
          tax_amount: number
          shipping_amount: number
          discount_amount: number
          discount_percent: number
          total_amount: number
          status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'SHIPPED' | 'DELIVERED' | 'INVOICED' | 'CANCELLED' | 'ON_HOLD'
          converted_to_invoice_id: string | null
          invoiced_at: string | null
          has_purchase_orders: boolean
          internal_notes: string | null
          customer_notes: string | null
          terms_and_conditions: string | null
          created_at: string
          updated_at: string
          version: number
          last_modified_by: string | null
        }
        Insert: {
          id?: string
          so_number: string
          customer_id: string
          sales_rep_id?: string | null
          source_estimate_id?: string | null
          estimate_number?: string | null
          bill_to_company?: string | null
          bill_to_contact?: string | null
          bill_to_address_line_1?: string | null
          bill_to_address_line_2?: string | null
          bill_to_city?: string | null
          bill_to_state?: string | null
          bill_to_zip?: string | null
          bill_to_country?: string
          ship_to_company?: string | null
          ship_to_contact?: string | null
          ship_to_address_line_1?: string | null
          ship_to_address_line_2?: string | null
          ship_to_city?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          ship_to_country?: string
          ship_to_same_as_billing?: boolean
          order_date?: string
          ship_date?: string | null
          due_date?: string | null
          reference_number?: string | null
          job_name?: string | null
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          shipping_amount?: number
          discount_amount?: number
          discount_percent?: number
          total_amount?: number
          status?: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'SHIPPED' | 'DELIVERED' | 'INVOICED' | 'CANCELLED' | 'ON_HOLD'
          converted_to_invoice_id?: string | null
          invoiced_at?: string | null
          has_purchase_orders?: boolean
          internal_notes?: string | null
          customer_notes?: string | null
          terms_and_conditions?: string | null
          created_at?: string
          updated_at?: string
          version?: number
          last_modified_by?: string | null
        }
        Update: {
          so_number?: string
          customer_id?: string
          sales_rep_id?: string | null
          source_estimate_id?: string | null
          estimate_number?: string | null
          bill_to_company?: string | null
          bill_to_contact?: string | null
          bill_to_address_line_1?: string | null
          bill_to_address_line_2?: string | null
          bill_to_city?: string | null
          bill_to_state?: string | null
          bill_to_zip?: string | null
          bill_to_country?: string
          ship_to_company?: string | null
          ship_to_contact?: string | null
          ship_to_address_line_1?: string | null
          ship_to_address_line_2?: string | null
          ship_to_city?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          ship_to_country?: string
          ship_to_same_as_billing?: boolean
          order_date?: string
          ship_date?: string | null
          due_date?: string | null
          reference_number?: string | null
          job_name?: string | null
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          shipping_amount?: number
          discount_amount?: number
          discount_percent?: number
          total_amount?: number
          status?: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'SHIPPED' | 'DELIVERED' | 'INVOICED' | 'CANCELLED' | 'ON_HOLD'
          converted_to_invoice_id?: string | null
          invoiced_at?: string | null
          has_purchase_orders?: boolean
          internal_notes?: string | null
          customer_notes?: string | null
          terms_and_conditions?: string | null
          updated_at?: string
          version?: number
          last_modified_by?: string | null
        }
      }
      
      // Sales Order Lines
      sales_order_lines: {
        Row: {
          id: string
          sales_order_id: string
          line_number: number
          product_id: string | null
          item_code: string | null
          description: string | null
          quantity: number
          quantity_shipped: number
          quantity_invoiced: number
          quantity_reserved: number
          unit_price: number
          unit_of_measure: string
          discount_percent: number
          discount_amount: number
          tax_code: string | null
          tax_rate: number
          tax_amount: number
          line_total: number
          fulfillment_status: 'PENDING' | 'PARTIAL' | 'COMPLETE' | 'CANCELLED'
          source_estimate_line_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sales_order_id: string
          line_number: number
          product_id?: string | null
          item_code?: string | null
          description?: string | null
          quantity?: number
          quantity_shipped?: number
          quantity_invoiced?: number
          quantity_reserved?: number
          unit_price?: number
          unit_of_measure?: string
          discount_percent?: number
          discount_amount?: number
          tax_code?: string | null
          tax_rate?: number
          tax_amount?: number
          line_total?: number
          fulfillment_status?: 'PENDING' | 'PARTIAL' | 'COMPLETE' | 'CANCELLED'
          source_estimate_line_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          line_number?: number
          product_id?: string | null
          item_code?: string | null
          description?: string | null
          quantity?: number
          quantity_shipped?: number
          quantity_invoiced?: number
          quantity_reserved?: number
          unit_price?: number
          unit_of_measure?: string
          discount_percent?: number
          discount_amount?: number
          tax_code?: string | null
          tax_rate?: number
          tax_amount?: number
          line_total?: number
          fulfillment_status?: 'PENDING' | 'PARTIAL' | 'COMPLETE' | 'CANCELLED'
          source_estimate_line_id?: string | null
          updated_at?: string
        }
      }
      
      // Document Links
      document_links: {
        Row: {
          id: string
          source_type: 'ESTIMATE' | 'SALES_ORDER' | 'INVOICE' | 'PURCHASE_ORDER'
          source_id: string
          target_type: 'ESTIMATE' | 'SALES_ORDER' | 'INVOICE' | 'PURCHASE_ORDER'
          target_id: string
          link_type: 'CONVERTED' | 'RELATED' | 'PARTIAL'
          created_at: string
          created_by: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          source_type: 'ESTIMATE' | 'SALES_ORDER' | 'INVOICE' | 'PURCHASE_ORDER'
          source_id: string
          target_type: 'ESTIMATE' | 'SALES_ORDER' | 'INVOICE' | 'PURCHASE_ORDER'
          target_id: string
          link_type?: 'CONVERTED' | 'RELATED' | 'PARTIAL'
          created_at?: string
          created_by?: string | null
          notes?: string | null
        }
        Update: {
          source_type?: 'ESTIMATE' | 'SALES_ORDER' | 'INVOICE' | 'PURCHASE_ORDER'
          source_id?: string
          target_type?: 'ESTIMATE' | 'SALES_ORDER' | 'INVOICE' | 'PURCHASE_ORDER'
          target_id?: string
          link_type?: 'CONVERTED' | 'RELATED' | 'PARTIAL'
          created_by?: string | null
          notes?: string | null
        }
      }
      
      // Inventory Reservations
      inventory_reservations: {
        Row: {
          id: string
          product_id: string
          inventory_id: string | null
          sales_order_id: string
          sales_order_line_id: string
          quantity_reserved: number
          reservation_date: string
          expiry_date: string | null
          status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED'
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          product_id: string
          inventory_id?: string | null
          sales_order_id: string
          sales_order_line_id: string
          quantity_reserved: number
          reservation_date?: string
          expiry_date?: string | null
          status?: 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED'
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          product_id?: string
          inventory_id?: string | null
          sales_order_id?: string
          sales_order_line_id?: string
          quantity_reserved?: number
          reservation_date?: string
          expiry_date?: string | null
          status?: 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED'
          notes?: string | null
          updated_at?: string
          created_by?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      customer_type: 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR'
      vendor_type: 'SUPPLIER' | 'SERVICE_PROVIDER' | 'CONTRACTOR'
    }
  }
}