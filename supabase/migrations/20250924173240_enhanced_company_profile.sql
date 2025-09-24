-- Enhanced Company Profile Schema for ERP System
-- This expands the existing company_settings table with all fields needed
-- for comprehensive business document generation and ERP functionality

-- Drop existing table constraints if they exist
ALTER TABLE IF EXISTS company_settings DROP CONSTRAINT IF EXISTS company_settings_pkey CASCADE;

-- Enhanced company_settings table
CREATE TABLE IF NOT EXISTS enhanced_company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,

  -- Basic Company Information
  company_name TEXT NOT NULL,
  legal_business_name TEXT, -- For legal documents
  dba_name TEXT, -- "Doing Business As" name
  company_logo_url TEXT,
  company_tagline TEXT,
  company_website TEXT,

  -- Business Registration & Tax Information
  business_registration_number TEXT,
  tax_id TEXT, -- Federal Tax ID/EIN
  state_tax_id TEXT,
  sales_tax_license TEXT,
  reseller_permit TEXT,
  duns_number TEXT, -- D-U-N-S Number for business credit

  -- Industry & Business Type
  industry TEXT,
  business_type TEXT, -- LLC, Corp, Partnership, etc.
  sic_code TEXT, -- Standard Industrial Classification
  naics_code TEXT, -- North American Industry Classification

  -- Primary Business Address (Legal/Mailing)
  business_address_line_1 TEXT,
  business_address_line_2 TEXT,
  business_city TEXT,
  business_state TEXT,
  business_zip_code TEXT,
  business_country TEXT DEFAULT 'USA',

  -- Billing Address (where invoices are sent TO the company)
  billing_address_line_1 TEXT,
  billing_address_line_2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip_code TEXT,
  billing_country TEXT DEFAULT 'USA',
  billing_phone TEXT,
  billing_email TEXT,

  -- Shipping/Receiving Address (where goods are received)
  shipping_address_line_1 TEXT,
  shipping_address_line_2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip_code TEXT,
  shipping_country TEXT DEFAULT 'USA',
  shipping_phone TEXT,
  shipping_email TEXT,
  shipping_attention TEXT, -- Contact person for deliveries
  shipping_instructions TEXT, -- Special delivery instructions

  -- Contact Information
  primary_phone TEXT,
  secondary_phone TEXT,
  fax_number TEXT,
  primary_email TEXT,
  accounts_payable_email TEXT,
  accounts_receivable_email TEXT,
  sales_email TEXT,
  support_email TEXT,

  -- Financial Settings
  default_payment_terms TEXT DEFAULT 'Net 30',
  default_currency TEXT DEFAULT 'USD',
  fiscal_year_start INTEGER DEFAULT 1, -- Month (1=January)
  credit_limit DECIMAL(15,2),

  -- Banking Information (for ACH payments, etc.)
  primary_bank_name TEXT,
  primary_bank_routing_number TEXT,
  primary_bank_account_number TEXT,
  primary_bank_account_type TEXT, -- Checking, Savings

  -- Document Preferences
  default_document_template_estimate UUID, -- FK to estimate_templates
  default_document_template_invoice UUID,  -- FK to invoice_templates
  default_document_template_purchase_order UUID, -- FK to po_templates
  default_document_template_sales_order UUID, -- FK to so_templates

  -- Logo & Branding
  logo_position TEXT DEFAULT 'left', -- left, center, right
  logo_size TEXT DEFAULT 'medium', -- small, medium, large
  brand_color_primary TEXT DEFAULT '#1f2937',
  brand_color_secondary TEXT DEFAULT '#6b7280',
  brand_color_accent TEXT DEFAULT '#3b82f6',

  -- Terms & Conditions
  default_terms_and_conditions TEXT,
  default_warranty_terms TEXT,
  default_return_policy TEXT,

  -- Shipping & Handling
  default_shipping_method TEXT,
  default_shipping_terms TEXT, -- FOB Origin, FOB Destination, etc.
  handling_fee_percentage DECIMAL(5,2) DEFAULT 0.00,

  -- Insurance Information
  general_liability_carrier TEXT,
  general_liability_policy TEXT,
  workers_comp_carrier TEXT,
  workers_comp_policy TEXT,

  -- Certifications & Licenses
  certifications JSONB, -- Array of certifications with dates
  professional_licenses JSONB, -- Array of licenses with expiration dates

  -- Social Media & Marketing
  linkedin_url TEXT,
  facebook_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,

  -- System Settings
  time_zone TEXT DEFAULT 'America/New_York',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  number_format TEXT DEFAULT 'US', -- US, EU, etc.

  -- Custom Fields for industry-specific needs
  custom_field_1_label TEXT,
  custom_field_1_value TEXT,
  custom_field_2_label TEXT,
  custom_field_2_value TEXT,
  custom_field_3_label TEXT,
  custom_field_3_value TEXT,
  custom_field_4_label TEXT,
  custom_field_4_value TEXT,
  custom_field_5_label TEXT,
  custom_field_5_value TEXT,

  -- Notes and Internal Information
  internal_notes TEXT,

  -- Constraints
  CONSTRAINT enhanced_company_settings_pkey PRIMARY KEY (id),
  CONSTRAINT enhanced_company_settings_company_name_check CHECK (char_length(company_name) > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS enhanced_company_settings_active_idx ON enhanced_company_settings (is_active);
CREATE INDEX IF NOT EXISTS enhanced_company_settings_created_by_idx ON enhanced_company_settings (created_by);

-- Enable RLS (Row Level Security)
ALTER TABLE enhanced_company_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view company settings" ON enhanced_company_settings;
CREATE POLICY "Users can view company settings" ON enhanced_company_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage company settings" ON enhanced_company_settings;
CREATE POLICY "Authenticated users can manage company settings" ON enhanced_company_settings
FOR ALL USING (auth.uid() IS NOT NULL);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_enhanced_company_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at field
DROP TRIGGER IF EXISTS update_enhanced_company_settings_updated_at_trigger ON enhanced_company_settings;
CREATE TRIGGER update_enhanced_company_settings_updated_at_trigger
  BEFORE UPDATE ON enhanced_company_settings
  FOR EACH ROW EXECUTE FUNCTION update_enhanced_company_settings_updated_at();

-- Migration function to copy existing data from old table
CREATE OR REPLACE FUNCTION migrate_company_settings_data()
RETURNS void AS $$
DECLARE
  old_record RECORD;
BEGIN
  -- Copy existing data if old table exists
  FOR old_record IN SELECT * FROM company_settings WHERE is_active = true
  LOOP
    INSERT INTO enhanced_company_settings (
      id,
      created_at,
      updated_at,
      created_by,
      is_active,
      company_name,
      company_logo_url,
      business_registration_number,
      tax_id,
      billing_address_line_1,
      billing_address_line_2,
      billing_city,
      billing_state,
      billing_zip_code,
      billing_country,
      billing_phone,
      billing_email,
      shipping_address_line_1,
      shipping_address_line_2,
      shipping_city,
      shipping_state,
      shipping_zip_code,
      shipping_country,
      shipping_phone,
      shipping_email,
      shipping_attention,
      default_payment_terms
    ) VALUES (
      old_record.id,
      old_record.created_at,
      old_record.updated_at,
      old_record.created_by,
      old_record.is_active,
      old_record.company_name,
      old_record.company_logo_url,
      old_record.business_registration_number,
      old_record.tax_id,
      old_record.billing_address_line_1,
      old_record.billing_address_line_2,
      old_record.billing_city,
      old_record.billing_state,
      old_record.billing_zip_code,
      old_record.billing_country,
      old_record.billing_phone,
      old_record.billing_email,
      old_record.shipping_address_line_1,
      old_record.shipping_address_line_2,
      old_record.shipping_city,
      old_record.shipping_state,
      old_record.shipping_zip_code,
      old_record.shipping_country,
      old_record.shipping_phone,
      old_record.shipping_email,
      old_record.shipping_attention,
      old_record.default_payment_terms
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Example default company profile
INSERT INTO enhanced_company_settings (
  company_name,
  legal_business_name,
  primary_email,
  primary_phone,
  business_address_line_1,
  business_city,
  business_state,
  business_zip_code,
  billing_address_line_1,
  billing_city,
  billing_state,
  billing_zip_code,
  shipping_address_line_1,
  shipping_city,
  shipping_state,
  shipping_zip_code,
  default_payment_terms,
  default_terms_and_conditions
) VALUES (
  'Your Company Name',
  'Your Company Name, LLC',
  'info@yourcompany.com',
  '(555) 123-4567',
  '123 Business Ave',
  'Business City',
  'ST',
  '12345',
  '123 Business Ave',
  'Business City',
  'ST',
  '12345',
  '123 Warehouse Dr',
  'Business City',
  'ST',
  '12345',
  'Net 30',
  'Payment is due within 30 days of invoice date. Late payments may be subject to finance charges.'
) ON CONFLICT DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE enhanced_company_settings IS 'Comprehensive company profile for ERP system with all business information needed for document generation, financial operations, and business management';
COMMENT ON COLUMN enhanced_company_settings.legal_business_name IS 'Official registered business name for legal documents';
COMMENT ON COLUMN enhanced_company_settings.dba_name IS 'Doing Business As name if different from legal name';
COMMENT ON COLUMN enhanced_company_settings.certifications IS 'JSON array of business certifications with dates';
COMMENT ON COLUMN enhanced_company_settings.professional_licenses IS 'JSON array of professional licenses with expiration dates';