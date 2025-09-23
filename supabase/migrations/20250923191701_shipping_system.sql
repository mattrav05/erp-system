-- Shipping System Database Schema
-- This migration creates the complete shipping deduction system for inventory management

-- Shipping deductions table (daily aggregated data from ShipStation)
CREATE TABLE shipping_deductions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sync_date DATE NOT NULL UNIQUE, -- Prevent duplicate syncs for same date
    total_orders_processed INTEGER NOT NULL DEFAULT 0,
    orders_with_our_skus INTEGER NOT NULL DEFAULT 0,
    total_deducted DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'error', 'ignored')),
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES auth.users(id),
    shipstation_batch_info JSONB, -- Store raw ShipStation response metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual SKU line items for each shipping deduction
CREATE TABLE shipping_deduction_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    shipping_deduction_id UUID REFERENCES shipping_deductions(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    sku TEXT NOT NULL,
    product_name TEXT,
    total_quantity_shipped DECIMAL(10,3) NOT NULL,
    orders_containing_sku INTEGER NOT NULL DEFAULT 1,
    unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
    total_cost DECIMAL(12,2) GENERATED ALWAYS AS (total_quantity_shipped * unit_cost) STORED,
    inventory_found BOOLEAN NOT NULL DEFAULT false,
    ignored_reason TEXT, -- "not in inventory", "drop ship", "manual override", etc.
    shipstation_item_data JSONB, -- Store raw ShipStation item data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track processed ShipStation orders to prevent duplicates
CREATE TABLE processed_shipstation_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    shipstation_order_id TEXT UNIQUE NOT NULL,
    shipstation_shipment_id TEXT UNIQUE NOT NULL,
    ship_date DATE NOT NULL,
    order_number TEXT,
    tracking_number TEXT,
    shipping_deduction_id UUID REFERENCES shipping_deductions(id),
    raw_order_data JSONB, -- Store complete ShipStation order/shipment data
    processed_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ShipStation configuration and sync status
CREATE TABLE shipstation_config (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID, -- Future: multi-company support
    api_key_encrypted TEXT NOT NULL,
    api_secret_encrypted TEXT NOT NULL,
    last_sync_date DATE,
    last_sync_status TEXT CHECK (last_sync_status IN ('success', 'error', 'in_progress')),
    last_sync_error TEXT,
    auto_sync_enabled BOOLEAN DEFAULT false,
    sync_hour INTEGER DEFAULT 8 CHECK (sync_hour >= 0 AND sync_hour <= 23), -- Hour to run auto-sync
    webhook_url TEXT,
    webhook_secret TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory deduction audit trail (extends existing inventory_transactions)
-- Add shipping-specific fields to track deductions
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS shipping_deduction_id UUID REFERENCES shipping_deductions(id);
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS shipstation_order_id TEXT;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS shipstation_tracking_number TEXT;

-- Create indexes for performance
CREATE INDEX idx_shipping_deductions_sync_date ON shipping_deductions(sync_date);
CREATE INDEX idx_shipping_deductions_status ON shipping_deductions(status);
CREATE INDEX idx_shipping_deduction_items_deduction_id ON shipping_deduction_items(shipping_deduction_id);
CREATE INDEX idx_shipping_deduction_items_product_id ON shipping_deduction_items(product_id);
CREATE INDEX idx_shipping_deduction_items_sku ON shipping_deduction_items(sku);
CREATE INDEX idx_processed_shipstation_orders_order_id ON processed_shipstation_orders(shipstation_order_id);
CREATE INDEX idx_processed_shipstation_orders_ship_date ON processed_shipstation_orders(ship_date);
CREATE INDEX idx_inventory_transactions_shipping ON inventory_transactions(shipping_deduction_id) WHERE shipping_deduction_id IS NOT NULL;

-- Create updated_at triggers
CREATE TRIGGER update_shipping_deductions_updated_at
    BEFORE UPDATE ON shipping_deductions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipstation_config_updated_at
    BEFORE UPDATE ON shipstation_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies for shipping tables
ALTER TABLE shipping_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_deduction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_shipstation_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipstation_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to access shipping data
CREATE POLICY "Authenticated users can view shipping deductions" ON shipping_deductions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert shipping deductions" ON shipping_deductions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update shipping deductions" ON shipping_deductions FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view shipping deduction items" ON shipping_deduction_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert shipping deduction items" ON shipping_deduction_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update shipping deduction items" ON shipping_deduction_items FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view processed orders" ON processed_shipstation_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert processed orders" ON processed_shipstation_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view shipstation config" ON shipstation_config FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage shipstation config" ON shipstation_config FOR ALL USING (auth.role() = 'authenticated');

-- Function to process shipping deduction and update inventory
CREATE OR REPLACE FUNCTION process_shipping_deduction(deduction_id UUID)
RETURNS JSON AS $$
DECLARE
    deduction_record shipping_deductions%ROWTYPE;
    item_record shipping_deduction_items%ROWTYPE;
    result JSON;
    processed_items INTEGER := 0;
    total_cost DECIMAL(12,2) := 0;
    error_msg TEXT;
BEGIN
    -- Get the deduction record
    SELECT * INTO deduction_record FROM shipping_deductions WHERE id = deduction_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Deduction record not found');
    END IF;

    IF deduction_record.status != 'pending' THEN
        RETURN json_build_object('success', false, 'error', 'Deduction already processed or not in pending status');
    END IF;

    -- Mark as processing
    UPDATE shipping_deductions
    SET status = 'processing', updated_at = NOW()
    WHERE id = deduction_id;

    -- Process each item
    FOR item_record IN
        SELECT * FROM shipping_deduction_items
        WHERE shipping_deduction_id = deduction_id
        AND inventory_found = true
    LOOP
        BEGIN
            -- Update inventory quantity
            UPDATE inventory
            SET
                quantity_on_hand = quantity_on_hand - item_record.total_quantity_shipped,
                updated_at = NOW()
            WHERE product_id = item_record.product_id;

            -- Create inventory transaction record
            INSERT INTO inventory_transactions (
                product_id,
                transaction_type,
                reference_type,
                quantity_change,
                unit_cost,
                total_cost,
                shipping_deduction_id,
                notes,
                created_at
            ) VALUES (
                item_record.product_id,
                'SALE',
                'SHIPPING_DEDUCTION',
                -item_record.total_quantity_shipped, -- Negative for outbound
                item_record.unit_cost,
                -item_record.total_cost, -- Negative for cost reduction
                deduction_id,
                'Inventory deduction from ShipStation shipment sync for ' || deduction_record.sync_date,
                NOW()
            );

            processed_items := processed_items + 1;
            total_cost := total_cost + item_record.total_cost;

        EXCEPTION WHEN OTHERS THEN
            error_msg := SQLERRM;
            -- Log error but continue with other items
            UPDATE shipping_deduction_items
            SET ignored_reason = 'Processing error: ' || error_msg
            WHERE id = item_record.id;
        END;
    END LOOP;

    -- Update deduction status
    UPDATE shipping_deductions
    SET
        status = CASE
            WHEN processed_items > 0 THEN 'processed'
            ELSE 'error'
        END,
        processed_at = NOW(),
        processed_by = auth.uid(),
        error_message = CASE
            WHEN processed_items = 0 THEN 'No items could be processed'
            ELSE NULL
        END,
        updated_at = NOW()
    WHERE id = deduction_id;

    result := json_build_object(
        'success', processed_items > 0,
        'processed_items', processed_items,
        'total_cost_deducted', total_cost,
        'error', error_msg
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get inventory cost for a product (weighted average)
CREATE OR REPLACE FUNCTION get_product_inventory_cost(product_sku TEXT)
RETURNS DECIMAL(12,4) AS $$
DECLARE
    cost DECIMAL(12,4);
BEGIN
    SELECT i.weighted_average_cost INTO cost
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    WHERE p.sku = product_sku
    AND i.quantity_on_hand > 0
    ORDER BY i.weighted_average_cost DESC -- Use highest cost location if multiple
    LIMIT 1;

    RETURN COALESCE(cost, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to check if SKU exists in inventory
CREATE OR REPLACE FUNCTION sku_exists_in_inventory(product_sku TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    exists_flag BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM inventory i
        JOIN products p ON p.id = i.product_id
        WHERE p.sku = product_sku
    ) INTO exists_flag;

    RETURN exists_flag;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE shipping_deductions IS 'Daily aggregated shipping data from ShipStation for inventory deduction';
COMMENT ON TABLE shipping_deduction_items IS 'Individual SKU line items for each shipping deduction batch';
COMMENT ON TABLE processed_shipstation_orders IS 'Tracking table to prevent duplicate processing of ShipStation orders';
COMMENT ON TABLE shipstation_config IS 'ShipStation API configuration and sync settings';
COMMENT ON FUNCTION process_shipping_deduction IS 'Processes a pending shipping deduction and updates inventory levels';