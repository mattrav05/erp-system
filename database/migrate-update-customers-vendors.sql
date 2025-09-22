-- Update existing vendors table to match the new interface
ALTER TABLE vendors RENAME COLUMN name TO company_name;
ALTER TABLE vendors RENAME COLUMN contact_email TO email;
ALTER TABLE vendors RENAME COLUMN contact_phone TO phone;

-- Add new columns to vendors table
ALTER TABLE vendors 
ADD COLUMN contact_name VARCHAR(255),
ADD COLUMN website VARCHAR(255),
ADD COLUMN address_line_1 VARCHAR(255),
ADD COLUMN address_line_2 VARCHAR(255),
ADD COLUMN city VARCHAR(100),
ADD COLUMN state VARCHAR(50),
ADD COLUMN zip_code VARCHAR(20),
ADD COLUMN country VARCHAR(100) DEFAULT 'USA',
ADD COLUMN vendor_type VARCHAR(50) CHECK (vendor_type IN ('SUPPLIER', 'SERVICE_PROVIDER', 'CONTRACTOR')),
ADD COLUMN preferred_currency VARCHAR(10) DEFAULT 'USD',
ADD COLUMN lead_time_days INTEGER,
ADD COLUMN minimum_order DECIMAL(15,2),
ADD COLUMN notes TEXT,
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Create customers table (doesn't exist yet)
CREATE TABLE customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    customer_type VARCHAR(50) CHECK (customer_type IN ('RETAIL', 'WHOLESALE', 'DISTRIBUTOR')),
    payment_terms VARCHAR(50) DEFAULT 'NET30',
    credit_limit DECIMAL(15,2),
    tax_exempt BOOLEAN DEFAULT false,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_customers_company_name ON customers(company_name);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_is_active ON customers(is_active);
CREATE INDEX idx_customers_customer_type ON customers(customer_type);

CREATE INDEX idx_vendors_company_name ON vendors(company_name);
CREATE INDEX idx_vendors_email ON vendors(email);
CREATE INDEX idx_vendors_is_active ON vendors(is_active);
CREATE INDEX idx_vendors_vendor_type ON vendors(vendor_type);

-- Create trigger for updating updated_at on customers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample customers data
INSERT INTO customers (company_name, contact_name, email, phone, address_line_1, address_line_2, city, state, zip_code, customer_type, payment_terms, credit_limit, tax_exempt, notes) VALUES
('ABC Corporation', 'John Smith', 'john.smith@abccorp.com', '(555) 123-4567', '123 Business Ave', 'Suite 100', 'Business City', 'BC', '12345', 'WHOLESALE', 'NET30', 50000, false, 'Long-term wholesale customer with excellent payment history'),
('XYZ Industries', 'Sarah Johnson', 'sarah.johnson@xyzind.com', '(555) 987-6543', '456 Industrial Blvd', null, 'Industrial Park', 'IP', '67890', 'DISTRIBUTOR', 'NET15', 100000, true, 'Major distributor - handles large volume orders'),
('Quick Retail Store', 'Mike Davis', 'mike@quickretail.com', '(555) 456-7890', '789 Retail Plaza', 'Unit 5', 'Retail Town', 'RT', '13579', 'RETAIL', 'COD', 5000, false, 'Small retail customer - cash on delivery preferred'),
('Inactive Customer LLC', 'Jane Wilson', 'jane@inactive.com', '(555) 000-1111', '000 Old Street', null, 'Old Town', 'OT', '00001', 'RETAIL', 'NET30', 1000, false, 'Customer no longer active');

-- Update the last customer to be inactive
UPDATE customers SET is_active = false WHERE company_name = 'Inactive Customer LLC';

-- Update existing vendors with sample data to match the new structure
UPDATE vendors SET 
    contact_name = 'Bob Johnson',
    website = 'www.acmesuppliers.com',
    address_line_1 = '456 Industrial Blvd',
    address_line_2 = 'Building C',
    city = 'Manufacturing City',
    state = 'MC',
    zip_code = '23456',
    vendor_type = 'SUPPLIER',
    payment_terms = 'NET30',
    tax_id = '12-3456789',
    lead_time_days = 14,
    minimum_order = 1000,
    notes = 'Primary supplier for raw materials. Excellent quality and reliability.',
    is_active = true
WHERE company_name = 'ACME Suppliers Inc.';

-- Insert additional sample vendors
INSERT INTO vendors (company_name, contact_name, email, phone, website, address_line_1, address_line_2, city, state, zip_code, vendor_type, payment_terms, tax_id, preferred_currency, lead_time_days, minimum_order, notes, is_active) VALUES
('Beta Manufacturing LLC', 'Lisa Chen', 'lisa.chen@betamfg.com', '(555) 345-6789', 'www.betamanufacturing.com', '789 Factory Row', null, 'Production Town', 'PT', '34567', 'SUPPLIER', 'NET45', '23-4567890', 'USD', 21, 2500, 'Secondary supplier - good for bulk orders with longer lead times.', true),
('Quick Fix Services', 'David Martinez', 'david@quickfixservices.com', '(555) 456-7890', null, '321 Service Lane', null, 'Service City', 'SC', '45678', 'SERVICE_PROVIDER', 'NET15', '34-5678901', 'USD', 3, 500, 'Maintenance and repair services for equipment.', true),
('Inactive Vendor Corp', 'Mark Wilson', 'mark@inactivevendor.com', '(555) 000-1111', null, '000 Discontinued St', null, 'Old Town', 'OT', '00001', 'SUPPLIER', 'NET30', '45-6789012', 'USD', 30, 1000, 'Vendor no longer in business.', false);