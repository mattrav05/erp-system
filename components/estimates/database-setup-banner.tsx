'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, AlertTriangle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface DatabaseSetupBannerProps {
  tableName: string
  feature: string
}

export default function DatabaseSetupBanner({ tableName, feature }: DatabaseSetupBannerProps) {
  const sqlContent = `
-- Run this SQL in your Supabase SQL Editor to create the ${feature} tables:

-- 1. Sales Representatives Table
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

-- 2. Estimate Templates Table
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

-- 3. Estimates Table
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

-- 4. Estimate Lines Table
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

-- 5. Insert Default Data
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
`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlContent.trim())
    alert('SQL copied to clipboard!')
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-orange-600 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-orange-800 mb-2">
              Database Setup Required
            </h3>
            <p className="text-orange-700 mb-4">
              The {feature} feature requires database tables that haven't been created yet. 
              You need to run a one-time setup to create the required tables.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={copyToClipboard}
                variant="outline"
                className="border-orange-300 text-orange-800 hover:bg-orange-100"
              >
                <Database className="w-4 h-4 mr-2" />
                Copy SQL Setup Code
              </Button>
              
              <Button
                asChild
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <a
                  href="https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql/new"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Supabase SQL Editor
                </a>
              </Button>
            </div>
            
            <div className="mt-4 p-3 bg-white border border-orange-200 rounded">
              <p className="text-sm text-orange-700">
                <strong>Instructions:</strong>
              </p>
              <ol className="text-sm text-orange-700 mt-1 space-y-1 list-decimal list-inside">
                <li>Click "Copy SQL Setup Code" above</li>
                <li>Click "Open Supabase SQL Editor"</li>
                <li>Paste the SQL code and click "RUN"</li>
                <li>Refresh this page once the setup is complete</li>
              </ol>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}