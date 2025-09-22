-- Migration: Add Inventory Adjustments Tables
-- This adds dedicated tables for inventory adjustments with proper audit trail

-- Create inventory_adjustments table (header/parent record)
CREATE TABLE inventory_adjustments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    adjustment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    adjustment_number TEXT UNIQUE, -- Optional: Sequential adjustment numbers like ADJ-001
    reason_category TEXT DEFAULT 'other' CHECK (reason_category IN ('physical_count', 'damaged', 'expired', 'theft', 'return_vendor', 'sample', 'manufacturing', 'other')),
    notes TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory_adjustment_lines table (line items/children records)
CREATE TABLE inventory_adjustment_lines (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    adjustment_id UUID REFERENCES inventory_adjustments(id) ON DELETE CASCADE NOT NULL,
    inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE NOT NULL,
    previous_quantity DECIMAL(10,3) NOT NULL,
    adjustment_quantity DECIMAL(10,3) NOT NULL, -- Can be positive or negative
    new_quantity DECIMAL(10,3) NOT NULL,
    reason_code TEXT DEFAULT 'other' CHECK (reason_code IN ('physical_count', 'damaged', 'expired', 'theft', 'return_vendor', 'sample', 'manufacturing', 'other')),
    line_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_quantity_calculation CHECK (new_quantity = previous_quantity + adjustment_quantity)
);

-- Create indexes for performance
CREATE INDEX idx_inventory_adjustments_date ON inventory_adjustments(adjustment_date DESC);
CREATE INDEX idx_inventory_adjustments_user ON inventory_adjustments(user_id);
CREATE INDEX idx_inventory_adjustments_status ON inventory_adjustments(status);
CREATE INDEX idx_adjustment_lines_adjustment ON inventory_adjustment_lines(adjustment_id);
CREATE INDEX idx_adjustment_lines_inventory ON inventory_adjustment_lines(inventory_id);

-- Add updated_at triggers
CREATE TRIGGER update_inventory_adjustments_updated_at 
    BEFORE UPDATE ON inventory_adjustments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_adjustment_lines_updated_at 
    BEFORE UPDATE ON inventory_adjustment_lines 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustment_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_adjustments
CREATE POLICY "Authenticated users can view adjustments" ON inventory_adjustments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert adjustments" ON inventory_adjustments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update adjustments" ON inventory_adjustments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete adjustments" ON inventory_adjustments FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for inventory_adjustment_lines
CREATE POLICY "Authenticated users can view adjustment lines" ON inventory_adjustment_lines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert adjustment lines" ON inventory_adjustment_lines FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update adjustment lines" ON inventory_adjustment_lines FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete adjustment lines" ON inventory_adjustment_lines FOR DELETE USING (auth.role() = 'authenticated');

-- Create function to auto-generate adjustment numbers
CREATE OR REPLACE FUNCTION generate_adjustment_number()
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    year_suffix TEXT;
BEGIN
    year_suffix := TO_CHAR(NOW(), 'YY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(adjustment_number FROM 'ADJ-(\d+)-' || year_suffix) AS INTEGER)), 0) + 1
    INTO next_number
    FROM inventory_adjustments 
    WHERE adjustment_number LIKE 'ADJ-%-' || year_suffix;
    
    RETURN 'ADJ-' || LPAD(next_number::TEXT, 4, '0') || '-' || year_suffix;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate adjustment number if not provided
CREATE OR REPLACE FUNCTION set_adjustment_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.adjustment_number IS NULL OR NEW.adjustment_number = '' THEN
        NEW.adjustment_number := generate_adjustment_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_adjustment_number_trigger
    BEFORE INSERT ON inventory_adjustments
    FOR EACH ROW EXECUTE FUNCTION set_adjustment_number();

-- Create function to update inventory and create transaction records when adjustment is completed
CREATE OR REPLACE FUNCTION process_inventory_adjustment()
RETURNS TRIGGER AS $$
DECLARE
    line_record inventory_adjustment_lines%ROWTYPE;
BEGIN
    -- Only process when status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Process each adjustment line
        FOR line_record IN
            SELECT * FROM inventory_adjustment_lines WHERE adjustment_id = NEW.id
        LOOP
            -- Update inventory quantity
            UPDATE inventory 
            SET quantity_on_hand = line_record.new_quantity,
                updated_at = NOW()
            WHERE id = line_record.inventory_id;
            
            -- Create inventory transaction record for audit trail
            INSERT INTO inventory_transactions (
                product_id,
                transaction_type,
                reference_id,
                reference_type,
                quantity_change,
                balance_after,
                location,
                notes
            )
            SELECT 
                i.product_id,
                'ADJUSTMENT',
                NEW.id,
                'INVENTORY_ADJUSTMENT',
                line_record.adjustment_quantity,
                line_record.new_quantity,
                COALESCE(i.location, 'MAIN'),
                COALESCE(line_record.line_notes, NEW.notes)
            FROM inventory i
            WHERE i.id = line_record.inventory_id;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_inventory_adjustment_trigger
    AFTER UPDATE ON inventory_adjustments
    FOR EACH ROW EXECUTE FUNCTION process_inventory_adjustment();