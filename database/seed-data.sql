-- Sample data for ERP system

-- Insert sample vendors
INSERT INTO vendors (name, contact_email, contact_phone, address, payment_terms) VALUES
('ABC Supplies Inc', 'orders@abcsupplies.com', '555-0101', '123 Industrial Way, City, ST 12345', 'Net 30'),
('Global Manufacturing Co', 'sales@globalmanuf.com', '555-0102', '456 Factory Blvd, City, ST 12346', 'Net 15'),
('Tech Components Ltd', 'info@techcomp.com', '555-0103', '789 Circuit Ave, City, ST 12347', '2/10 Net 30');

-- Insert sample customers
INSERT INTO customers (name, email, phone, billing_address, shipping_address, payment_terms, credit_limit) VALUES 
('Acme Corporation', 'accounting@acme.com', '555-1001', '100 Business St, City, ST 10001', '100 Business St, City, ST 10001', 'Net 30', 50000.00),
('Beta Industries', 'orders@betaind.com', '555-1002', '200 Commerce Dr, City, ST 10002', '200 Commerce Dr, City, ST 10002', 'Net 15', 25000.00),
('Gamma Enterprises', 'billing@gamma.com', '555-1003', '300 Trade Blvd, City, ST 10003', '300 Trade Blvd, City, ST 10003', 'Net 30', 75000.00);

-- Insert sample products
INSERT INTO products (sku, name, description, category, unit_of_measure, weight, is_inventory_item, is_shippable, default_markup_percentage, reorder_point, reorder_quantity) VALUES
('SKU-001', 'Widget Type A', 'Standard widget for general applications', 'Widgets', 'EA', 1.5, true, true, 40.00, 100, 500),
('SKU-002', 'Widget Type B', 'Heavy-duty widget for industrial use', 'Widgets', 'EA', 2.8, true, true, 45.00, 50, 250),
('SKU-003', 'Connector Cable 6ft', '6-foot connector cable with standard plugs', 'Cables', 'EA', 0.3, true, true, 60.00, 200, 1000),
('SKU-004', 'Installation Service', 'Professional installation service', 'Services', 'HR', 0.0, false, false, 100.00, null, null),
('SKU-005', 'Premium Widget Kit', 'Complete widget kit with accessories', 'Kits', 'KIT', 5.2, true, true, 35.00, 25, 100);

-- Insert initial inventory records
INSERT INTO inventory (product_id, quantity_on_hand, weighted_average_cost, last_cost) 
SELECT 
    p.id,
    CASE 
        WHEN p.sku = 'SKU-001' THEN 150.0
        WHEN p.sku = 'SKU-002' THEN 75.0
        WHEN p.sku = 'SKU-003' THEN 300.0
        WHEN p.sku = 'SKU-005' THEN 40.0
        ELSE 0.0
    END,
    CASE 
        WHEN p.sku = 'SKU-001' THEN 12.50
        WHEN p.sku = 'SKU-002' THEN 18.75
        WHEN p.sku = 'SKU-003' THEN 5.25
        WHEN p.sku = 'SKU-005' THEN 45.00
        ELSE 0.0
    END,
    CASE 
        WHEN p.sku = 'SKU-001' THEN 12.50
        WHEN p.sku = 'SKU-002' THEN 18.75
        WHEN p.sku = 'SKU-003' THEN 5.25
        WHEN p.sku = 'SKU-005' THEN 45.00
        ELSE 0.0
    END
FROM products p
WHERE p.is_inventory_item = true;

-- Insert sample purchase order
INSERT INTO purchase_orders (po_number, vendor_id, status, order_date, expected_date, subtotal, freight_cost, other_costs, notes)
SELECT 
    'PO-2024-001',
    v.id,
    'SENT',
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE + INTERVAL '10 days',
    2500.00,
    125.00,
    50.00,
    'Rush order for inventory replenishment'
FROM vendors v 
WHERE v.name = 'ABC Supplies Inc'
LIMIT 1;

-- Insert purchase order line items
INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost, allocated_freight, allocated_other_costs)
SELECT 
    po.id,
    p.id,
    CASE 
        WHEN p.sku = 'SKU-001' THEN 100.0
        WHEN p.sku = 'SKU-002' THEN 50.0
        WHEN p.sku = 'SKU-003' THEN 200.0
    END,
    CASE 
        WHEN p.sku = 'SKU-001' THEN 12.00
        WHEN p.sku = 'SKU-002' THEN 18.00
        WHEN p.sku = 'SKU-003' THEN 5.00
    END,
    CASE 
        WHEN p.sku = 'SKU-001' THEN 0.50
        WHEN p.sku = 'SKU-002' THEN 0.75
        WHEN p.sku = 'SKU-003' THEN 0.25
    END,
    CASE 
        WHEN p.sku = 'SKU-001' THEN 0.20
        WHEN p.sku = 'SKU-002' THEN 0.30
        WHEN p.sku = 'SKU-003' THEN 0.10
    END
FROM purchase_orders po
CROSS JOIN products p
WHERE po.po_number = 'PO-2024-001'
AND p.sku IN ('SKU-001', 'SKU-002', 'SKU-003');

-- Insert sample sales order
INSERT INTO sales_orders (so_number, customer_id, status, order_date, ship_date, subtotal, tax_amount, shipping_cost, notes)
SELECT 
    'SO-2024-001',
    c.id,
    'CONFIRMED',
    CURRENT_DATE - INTERVAL '2 days',
    CURRENT_DATE + INTERVAL '3 days',
    1875.00,
    150.00,
    25.00,
    'Standard order with expedited shipping'
FROM customers c 
WHERE c.name = 'Acme Corporation'
LIMIT 1;

-- Insert sales order line items
INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, cost_of_goods)
SELECT 
    so.id,
    p.id,
    CASE 
        WHEN p.sku = 'SKU-001' THEN 25.0
        WHEN p.sku = 'SKU-002' THEN 15.0
        WHEN p.sku = 'SKU-003' THEN 50.0
        WHEN p.sku = 'SKU-004' THEN 5.0
    END,
    CASE 
        WHEN p.sku = 'SKU-001' THEN 17.50
        WHEN p.sku = 'SKU-002' THEN 27.13
        WHEN p.sku = 'SKU-003' THEN 8.40
        WHEN p.sku = 'SKU-004' THEN 75.00
    END,
    CASE 
        WHEN p.sku = 'SKU-001' THEN 12.50
        WHEN p.sku = 'SKU-002' THEN 18.75
        WHEN p.sku = 'SKU-003' THEN 5.25
        WHEN p.sku = 'SKU-004' THEN 0.00
    END
FROM sales_orders so
CROSS JOIN products p
WHERE so.so_number = 'SO-2024-001'
AND p.sku IN ('SKU-001', 'SKU-002', 'SKU-003', 'SKU-004');

-- Update inventory allocations for the sales order
UPDATE inventory 
SET quantity_allocated = 
    CASE 
        WHEN p.sku = 'SKU-001' THEN 25.0
        WHEN p.sku = 'SKU-002' THEN 15.0
        WHEN p.sku = 'SKU-003' THEN 50.0
        ELSE 0.0
    END
FROM products p
WHERE inventory.product_id = p.id
AND p.sku IN ('SKU-001', 'SKU-002', 'SKU-003');

-- Insert initial inventory transactions for audit trail
INSERT INTO inventory_transactions (product_id, transaction_type, reference_type, quantity_change, unit_cost, balance_after, notes)
SELECT 
    p.id,
    'ADJUSTMENT',
    'INITIAL_STOCK',
    i.quantity_on_hand,
    i.weighted_average_cost,
    i.quantity_on_hand,
    'Initial inventory setup'
FROM products p
JOIN inventory i ON p.id = i.product_id
WHERE p.is_inventory_item = true;