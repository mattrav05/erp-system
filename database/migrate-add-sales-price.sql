-- Migration: Add sales_price column to inventory table
-- This adds sales pricing capability to inventory items

-- Add sales_price column to inventory table
ALTER TABLE inventory 
ADD COLUMN sales_price DECIMAL(12,4) DEFAULT 0;

-- Update the sales_price column with calculated values based on existing cost and default markup
-- First, let's set sales_price to cost * 1.5 for items that have cost > 0 and no existing sales_price
UPDATE inventory 
SET sales_price = weighted_average_cost * 1.5 
WHERE weighted_average_cost > 0 AND sales_price = 0;

-- For items with zero cost, set sales_price to 0
UPDATE inventory 
SET sales_price = 0 
WHERE weighted_average_cost = 0;

-- Add a comment to document the column
COMMENT ON COLUMN inventory.sales_price IS 'Sales price for this inventory item at this location';