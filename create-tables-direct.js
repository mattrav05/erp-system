require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

console.log('Environment check:')
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Found' : 'Missing')
console.log('Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Found' : 'Missing')

// Use service role key to bypass RLS and execute admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
)

async function createTables() {
  console.log('Creating estimates tables using service role...')
  
  try {
    // First, let's verify we can connect
    const { data: testData, error: testError } = await supabase
      .from('customers')
      .select('id')
      .limit(1)
    
    if (testError) {
      console.log('Connection test result:', testError.message)
    } else {
      console.log('✓ Successfully connected to Supabase')
    }

    // Let's try to create the tables by executing our SQL
    // Since we can't execute DDL directly, let's check what we can do
    
    // Option 1: Check if tables already exist
    console.log('\nChecking existing tables...')
    
    const checkQueries = [
      { name: 'sales_reps', query: supabase.from('sales_reps').select('id').limit(1) },
      { name: 'estimate_templates', query: supabase.from('estimate_templates').select('id').limit(1) },
      { name: 'estimates', query: supabase.from('estimates').select('id').limit(1) },
      { name: 'estimate_lines', query: supabase.from('estimate_lines').select('id').limit(1) }
    ]
    
    for (const check of checkQueries) {
      const { data, error } = await check.query
      if (error) {
        if (error.message.includes('does not exist')) {
          console.log(`❌ Table "${check.name}" does not exist`)
        } else {
          console.log(`❓ Table "${check.name}": ${error.message}`)
        }
      } else {
        console.log(`✓ Table "${check.name}" exists`)
      }
    }
    
    console.log('\n--- SOLUTION ---')
    console.log('The tables need to be created via SQL Editor. Here\'s the exact SQL to run:')
    console.log('Go to: https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql/new')
    console.log('Copy and paste this SQL:')
    
    const sql = `-- ESTIMATES MODULE SETUP
-- Run this in Supabase SQL Editor

-- 1. Sales Representatives
CREATE TABLE IF NOT EXISTS sales_reps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_code VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  commission_rate DECIMAL(5,2) DEFAULT 0.00,
  territory VARCHAR(100),
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  last_modified_by UUID
);

-- 2. Estimate Templates
CREATE TABLE IF NOT EXISTS estimate_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) DEFAULT 'GENERAL' CHECK (template_type IN ('GENERAL', 'USER_SAVED')),
  created_by UUID,
  is_default BOOLEAN DEFAULT false,
  header_logo_url TEXT,
  header_text TEXT,
  footer_text TEXT,
  terms_and_conditions TEXT,
  show_item_descriptions BOOLEAN DEFAULT true,
  show_item_images BOOLEAN DEFAULT false,
  show_labor_section BOOLEAN DEFAULT true,
  show_materials_section BOOLEAN DEFAULT true,
  show_subtotals BOOLEAN DEFAULT true,
  show_taxes BOOLEAN DEFAULT true,
  show_shipping BOOLEAN DEFAULT false,
  primary_color VARCHAR(7) DEFAULT '#2563eb',
  secondary_color VARCHAR(7) DEFAULT '#64748b',
  accent_color VARCHAR(7) DEFAULT '#059669',
  font_family VARCHAR(50) DEFAULT 'Arial',
  font_size INTEGER DEFAULT 11,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  last_modified_by UUID
);

-- 3. Estimates
CREATE TABLE IF NOT EXISTS estimates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  sales_rep_id UUID REFERENCES sales_reps(id),
  template_id UUID REFERENCES estimate_templates(id),
  bill_to_company VARCHAR(200),
  bill_to_contact VARCHAR(100),
  bill_to_address_line_1 VARCHAR(200),
  bill_to_address_line_2 VARCHAR(200),
  bill_to_city VARCHAR(100),
  bill_to_state VARCHAR(50),
  bill_to_zip VARCHAR(20),
  bill_to_country VARCHAR(100) DEFAULT 'United States',
  ship_to_company VARCHAR(200),
  ship_to_contact VARCHAR(100),
  ship_to_address_line_1 VARCHAR(200),
  ship_to_address_line_2 VARCHAR(200),
  ship_to_city VARCHAR(100),
  ship_to_state VARCHAR(50),
  ship_to_zip VARCHAR(20),
  ship_to_country VARCHAR(100) DEFAULT 'United States',
  ship_to_same_as_billing BOOLEAN DEFAULT true,
  estimate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiration_date DATE,
  reference_number VARCHAR(100),
  job_name VARCHAR(200),
  subtotal DECIMAL(15,2) DEFAULT 0.00,
  tax_rate DECIMAL(5,2) DEFAULT 0.00,
  tax_amount DECIMAL(15,2) DEFAULT 0.00,
  shipping_amount DECIMAL(15,2) DEFAULT 0.00,
  discount_amount DECIMAL(15,2) DEFAULT 0.00,
  total_amount DECIMAL(15,2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED')),
  converted_to_sales_order_id UUID,
  converted_at TIMESTAMPTZ,
  internal_notes TEXT,
  customer_notes TEXT,
  terms_and_conditions TEXT,
  last_emailed_at TIMESTAMPTZ,
  email_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  last_modified_by UUID
);

-- 4. Estimate Lines
CREATE TABLE IF NOT EXISTS estimate_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_type VARCHAR(20) DEFAULT 'PRODUCT' CHECK (item_type IN ('PRODUCT', 'SERVICE', 'LABOR', 'MATERIAL', 'MISC')),
  product_id UUID REFERENCES products(id),
  sku VARCHAR(100),
  description TEXT NOT NULL,
  long_description TEXT,
  quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
  unit_of_measure VARCHAR(20) DEFAULT 'each',
  unit_price DECIMAL(15,4) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  discount_type VARCHAR(20) DEFAULT 'NONE' CHECK (discount_type IN ('NONE', 'PERCENT', 'AMOUNT')),
  discount_value DECIMAL(15,4) DEFAULT 0.00,
  discounted_total DECIMAL(15,2),
  is_taxable BOOLEAN DEFAULT true,
  tax_code VARCHAR(20),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(estimate_id, line_number)
);

-- 5. Default Data
INSERT INTO estimate_templates (name, description, template_type, is_default, header_text, footer_text, terms_and_conditions)
VALUES 
  ('Standard Estimate', 'Standard business estimate template', 'GENERAL', true, 
   'Thank you for your interest in our services. Please review the estimate below.', 
   'We appreciate your business and look forward to working with you.',
   'This estimate is valid for 30 days. All work will be completed in a professional manner using quality materials.'),
   
  ('Service Estimate', 'Template for service-based estimates', 'GENERAL', false,
   'Professional Service Estimate', 
   'All services include warranty as specified. Additional charges may apply for work beyond scope.',
   'Estimate valid for 30 days. 50% deposit required to begin work. Balance due upon completion.'),
   
  ('Product Quote', 'Template for product sales estimates', 'GENERAL', false,
   'Product Quotation', 
   'All prices include standard warranty. Shipping costs calculated separately.',
   'Prices valid for 30 days. Payment terms: Net 30 days. Volume discounts available for large orders.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO sales_reps (employee_code, first_name, last_name, email, commission_rate, territory, is_active)
VALUES ('SYSTEM', 'System', 'Administrator', 'admin@company.com', 0.00, 'All', true)
ON CONFLICT (employee_code) DO NOTHING;

-- Success!
SELECT 'Estimates module tables created successfully!' as message;`

    console.log('\n' + '='.repeat(80))
    console.log(sql)
    console.log('='.repeat(80))
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

createTables()