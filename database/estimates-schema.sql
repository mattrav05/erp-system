-- ============================================
-- ESTIMATES MODULE DATABASE SCHEMA
-- ============================================

-- 1. SALES REPRESENTATIVES
-- ========================
CREATE TABLE IF NOT EXISTS sales_reps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_code VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  commission_rate DECIMAL(5,2) DEFAULT 0.00, -- e.g., 5.50 for 5.5%
  territory VARCHAR(100),
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  last_modified_by UUID
);

-- 2. ESTIMATE TEMPLATES
-- ====================
CREATE TABLE IF NOT EXISTS estimate_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) DEFAULT 'GENERAL' CHECK (template_type IN ('GENERAL', 'USER_SAVED')),
  created_by UUID, -- NULL for general templates, user ID for saved templates
  is_default BOOLEAN DEFAULT false,
  
  -- Template Configuration
  header_logo_url TEXT,
  header_text TEXT,
  footer_text TEXT,
  terms_and_conditions TEXT,
  
  -- Layout Settings
  show_item_descriptions BOOLEAN DEFAULT true,
  show_item_images BOOLEAN DEFAULT false,
  show_labor_section BOOLEAN DEFAULT true,
  show_materials_section BOOLEAN DEFAULT true,
  show_subtotals BOOLEAN DEFAULT true,
  show_taxes BOOLEAN DEFAULT true,
  show_shipping BOOLEAN DEFAULT false,
  
  -- Color Scheme
  primary_color VARCHAR(7) DEFAULT '#2563eb', -- Hex color
  secondary_color VARCHAR(7) DEFAULT '#64748b',
  accent_color VARCHAR(7) DEFAULT '#059669',
  
  -- Font Settings
  font_family VARCHAR(50) DEFAULT 'Arial',
  font_size INTEGER DEFAULT 11,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  last_modified_by UUID
);

-- 3. ESTIMATES (Main Table)
-- =========================
CREATE TABLE IF NOT EXISTS estimates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Customer Information
  customer_id UUID NOT NULL REFERENCES customers(id),
  
  -- Sales Rep Assignment
  sales_rep_id UUID REFERENCES sales_reps(id),
  
  -- Template Used
  template_id UUID REFERENCES estimate_templates(id),
  
  -- Billing Address
  bill_to_company VARCHAR(200),
  bill_to_contact VARCHAR(100),
  bill_to_address_line_1 VARCHAR(200),
  bill_to_address_line_2 VARCHAR(200),
  bill_to_city VARCHAR(100),
  bill_to_state VARCHAR(50),
  bill_to_zip VARCHAR(20),
  bill_to_country VARCHAR(100) DEFAULT 'United States',
  
  -- Shipping Address  
  ship_to_company VARCHAR(200),
  ship_to_contact VARCHAR(100),
  ship_to_address_line_1 VARCHAR(200),
  ship_to_address_line_2 VARCHAR(200),
  ship_to_city VARCHAR(100),
  ship_to_state VARCHAR(50),
  ship_to_zip VARCHAR(20),
  ship_to_country VARCHAR(100) DEFAULT 'United States',
  ship_to_same_as_billing BOOLEAN DEFAULT true,
  
  -- Estimate Details
  estimate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiration_date DATE,
  reference_number VARCHAR(100),
  job_name VARCHAR(200),
  
  -- Financial Totals
  subtotal DECIMAL(15,2) DEFAULT 0.00,
  tax_rate DECIMAL(5,2) DEFAULT 0.00,
  tax_amount DECIMAL(15,2) DEFAULT 0.00,
  shipping_amount DECIMAL(15,2) DEFAULT 0.00,
  discount_amount DECIMAL(15,2) DEFAULT 0.00,
  total_amount DECIMAL(15,2) DEFAULT 0.00,
  
  -- Status Management
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED')),
  
  -- Conversion Tracking
  converted_to_sales_order_id UUID, -- References sales_orders when converted
  converted_at TIMESTAMPTZ,
  
  -- Internal Notes
  internal_notes TEXT,
  customer_notes TEXT,
  terms_and_conditions TEXT,
  
  -- Email Tracking
  last_emailed_at TIMESTAMPTZ,
  email_count INTEGER DEFAULT 0,
  
  -- System Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  last_modified_by UUID,
  
  -- Indexes
  CONSTRAINT fk_estimates_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_estimates_sales_rep FOREIGN KEY (sales_rep_id) REFERENCES sales_reps(id),
  CONSTRAINT fk_estimates_template FOREIGN KEY (template_id) REFERENCES estimate_templates(id)
);

-- 4. ESTIMATE LINE ITEMS
-- ======================
CREATE TABLE IF NOT EXISTS estimate_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  
  -- Line Item Details
  line_number INTEGER NOT NULL,
  item_type VARCHAR(20) DEFAULT 'PRODUCT' CHECK (item_type IN ('PRODUCT', 'SERVICE', 'LABOR', 'MATERIAL', 'MISC')),
  
  -- Product Reference (if applicable)
  product_id UUID REFERENCES products(id),
  
  -- Item Information
  sku VARCHAR(100),
  description TEXT NOT NULL,
  long_description TEXT,
  
  -- Pricing
  quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
  unit_of_measure VARCHAR(20) DEFAULT 'each',
  unit_price DECIMAL(15,4) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  -- Discounts
  discount_type VARCHAR(20) DEFAULT 'NONE' CHECK (discount_type IN ('NONE', 'PERCENT', 'AMOUNT')),
  discount_value DECIMAL(15,4) DEFAULT 0.00,
  discounted_total DECIMAL(15,2),
  
  -- Tax Information
  is_taxable BOOLEAN DEFAULT true,
  tax_code VARCHAR(20),
  
  -- Additional Fields
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(estimate_id, line_number)
);

-- 5. ESTIMATE EMAIL HISTORY
-- =========================
CREATE TABLE IF NOT EXISTS estimate_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  
  -- Email Details
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(200),
  subject VARCHAR(500),
  body TEXT,
  
  -- Attachment Info
  pdf_generated BOOLEAN DEFAULT false,
  pdf_file_path TEXT,
  pdf_file_size INTEGER,
  
  -- Send Status
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by UUID,
  delivery_status VARCHAR(20) DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED')),
  delivery_timestamp TIMESTAMPTZ,
  
  -- Tracking
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INDEXES FOR PERFORMANCE
-- ==========================

-- Sales Reps Indexes
CREATE INDEX IF NOT EXISTS idx_sales_reps_active ON sales_reps(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_reps_territory ON sales_reps(territory);
CREATE INDEX IF NOT EXISTS idx_sales_reps_employee_code ON sales_reps(employee_code);

-- Templates Indexes
CREATE INDEX IF NOT EXISTS idx_estimate_templates_type ON estimate_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_estimate_templates_created_by ON estimate_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_estimate_templates_is_default ON estimate_templates(is_default);

-- Estimates Indexes
CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_sales_rep ON estimates(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_date ON estimates(estimate_date);
CREATE INDEX IF NOT EXISTS idx_estimates_number ON estimates(estimate_number);
CREATE INDEX IF NOT EXISTS idx_estimates_expiration ON estimates(expiration_date);

-- Line Items Indexes
CREATE INDEX IF NOT EXISTS idx_estimate_lines_estimate ON estimate_lines(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_product ON estimate_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_sort ON estimate_lines(estimate_id, sort_order);

-- Email History Indexes
CREATE INDEX IF NOT EXISTS idx_estimate_emails_estimate ON estimate_emails(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_emails_sent ON estimate_emails(sent_at);

-- 7. TRIGGERS FOR VERSION CONTROL
-- ===============================

-- Sales Reps Trigger
DROP TRIGGER IF EXISTS sales_reps_version_audit ON sales_reps;
CREATE TRIGGER sales_reps_version_audit
  BEFORE INSERT OR UPDATE OR DELETE ON sales_reps
  FOR EACH ROW EXECUTE FUNCTION increment_version_and_audit();

-- Templates Trigger
DROP TRIGGER IF EXISTS estimate_templates_version_audit ON estimate_templates;
CREATE TRIGGER estimate_templates_version_audit
  BEFORE INSERT OR UPDATE OR DELETE ON estimate_templates
  FOR EACH ROW EXECUTE FUNCTION increment_version_and_audit();

-- Estimates Trigger
DROP TRIGGER IF EXISTS estimates_version_audit ON estimates;
CREATE TRIGGER estimates_version_audit
  BEFORE INSERT OR UPDATE OR DELETE ON estimates
  FOR EACH ROW EXECUTE FUNCTION increment_version_and_audit();

-- 8. DEFAULT TEMPLATES
-- ====================

-- Insert Default General Templates
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
   'Prices valid for 30 days. Payment terms: Net 30 days. Volume discounts available for large orders.');

-- Insert Default Sales Rep (System)
INSERT INTO sales_reps (employee_code, first_name, last_name, email, commission_rate, territory, is_active)
VALUES ('SYSTEM', 'System', 'Administrator', 'admin@company.com', 0.00, 'All', true);

COMMENT ON TABLE sales_reps IS 'Sales representatives who can be assigned to estimates, sales orders, and invoices';
COMMENT ON TABLE estimate_templates IS 'Customizable templates for estimate generation with layout and styling options';
COMMENT ON TABLE estimates IS 'Main estimates table - starting point of sales process';
COMMENT ON TABLE estimate_lines IS 'Line items for each estimate with product/service details';
COMMENT ON TABLE estimate_emails IS 'Email history and tracking for sent estimates';

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE '✅ Estimates module schema created successfully!';
  RAISE NOTICE '📊 Features: Templates, Sales Reps, Email Tracking, Bill-to/Ship-to, Multi-user Support';
END $$;