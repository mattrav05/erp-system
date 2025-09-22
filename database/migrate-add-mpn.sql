-- Migration: Add manufacturer_part_number column to products table
-- Date: 2025-01-08

-- Add the manufacturer_part_number column to the products table
ALTER TABLE products 
ADD COLUMN manufacturer_part_number TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN products.manufacturer_part_number IS 'Manufacturer part number used for vendor purchase orders';

-- Update sample data with manufacturer part numbers
UPDATE products SET manufacturer_part_number = 'ACME-WTA-001' WHERE sku = 'SKU-001';
UPDATE products SET manufacturer_part_number = 'ACME-WTB-002' WHERE sku = 'SKU-002';
UPDATE products SET manufacturer_part_number = 'CONN-CAB-6FT' WHERE sku = 'SKU-003';
UPDATE products SET manufacturer_part_number = 'ACME-PWK-KIT' WHERE sku = 'SKU-005';
-- SKU-004 (Installation Service) intentionally left NULL as services don't have MPN