-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'user');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role user_role DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    manufacturer_part_number TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit_of_measure TEXT NOT NULL DEFAULT 'EA',
    weight DECIMAL(10,3),
    dimensions TEXT,
    is_inventory_item BOOLEAN DEFAULT true,
    is_shippable BOOLEAN DEFAULT true,
    default_markup_percentage DECIMAL(5,2),
    reorder_point INTEGER,
    reorder_quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendors table
CREATE TABLE vendors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    payment_terms TEXT,
    tax_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    billing_address TEXT,
    shipping_address TEXT,
    payment_terms TEXT DEFAULT 'Net 30',
    credit_limit DECIMAL(12,2),
    tax_exempt BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory table
CREATE TABLE inventory (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    quantity_on_hand DECIMAL(10,3) DEFAULT 0,
    quantity_allocated DECIMAL(10,3) DEFAULT 0,
    quantity_available DECIMAL(10,3) GENERATED ALWAYS AS (quantity_on_hand - quantity_allocated) STORED,
    weighted_average_cost DECIMAL(12,4) DEFAULT 0,
    last_cost DECIMAL(12,4),
    location TEXT DEFAULT 'MAIN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, location)
);

-- Purchase Orders table
CREATE TABLE purchase_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    po_number TEXT UNIQUE NOT NULL,
    vendor_id UUID REFERENCES vendors(id) NOT NULL,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIAL', 'COMPLETE', 'CANCELLED')),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE,
    subtotal DECIMAL(12,2) DEFAULT 0,
    freight_cost DECIMAL(12,2) DEFAULT 0,
    other_costs DECIMAL(12,2) DEFAULT 0,
    total_cost DECIMAL(12,2) GENERATED ALWAYS AS (subtotal + freight_cost + other_costs) STORED,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Order Line Items table
CREATE TABLE purchase_order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(12,4) NOT NULL,
    line_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    quantity_received DECIMAL(10,3) DEFAULT 0,
    allocated_freight DECIMAL(12,4) DEFAULT 0,
    allocated_other_costs DECIMAL(12,4) DEFAULT 0,
    landed_cost DECIMAL(12,4) GENERATED ALWAYS AS (unit_cost + allocated_freight + allocated_other_costs) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Orders table
CREATE TABLE sales_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    so_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'QUOTE', 'CONFIRMED', 'SHIPPED', 'INVOICED', 'COMPLETE', 'CANCELLED')),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ship_date DATE,
    subtotal DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) GENERATED ALWAYS AS (subtotal + tax_amount + shipping_cost) STORED,
    shipstation_order_id TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Order Line Items table
CREATE TABLE sales_order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(12,4) NOT NULL,
    line_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    quantity_shipped DECIMAL(10,3) DEFAULT 0,
    cost_of_goods DECIMAL(12,4),
    margin DECIMAL(12,2) GENERATED ALWAYS AS ((quantity * unit_price) - (quantity * cost_of_goods)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory Transactions table (audit trail)
CREATE TABLE inventory_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER')),
    reference_id UUID, -- References PO, SO, or adjustment record
    reference_type TEXT, -- 'PURCHASE_ORDER', 'SALES_ORDER', 'ADJUSTMENT'
    quantity_change DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(12,4),
    total_value DECIMAL(12,2) GENERATED ALWAYS AS (quantity_change * unit_cost) STORED,
    balance_after DECIMAL(10,3) NOT NULL,
    location TEXT DEFAULT 'MAIN',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    sales_order_id UUID REFERENCES sales_orders(id),
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED')),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) GENERATED ALWAYS AS (subtotal + tax_amount) STORED,
    amount_paid DECIMAL(12,2) DEFAULT 0,
    balance_due DECIMAL(12,2) GENERATED ALWAYS AS ((subtotal + tax_amount) - amount_paid) STORED,
    quickbooks_invoice_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice Line Items table
CREATE TABLE invoice_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(12,4) NOT NULL,
    line_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_inventory_transactions_product ON inventory_transactions(product_id);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_order_items_updated_at BEFORE UPDATE ON purchase_order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_order_items_updated_at BEFORE UPDATE ON sales_order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (allow authenticated users full access for now)
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view products" ON products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert products" ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update products" ON products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete products" ON products FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view vendors" ON vendors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert vendors" ON vendors FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update vendors" ON vendors FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete vendors" ON vendors FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view customers" ON customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert customers" ON customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update customers" ON customers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete customers" ON customers FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view inventory" ON inventory FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert inventory" ON inventory FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update inventory" ON inventory FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete inventory" ON inventory FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view purchase orders" ON purchase_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert purchase orders" ON purchase_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update purchase orders" ON purchase_orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete purchase orders" ON purchase_orders FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view purchase order items" ON purchase_order_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert purchase order items" ON purchase_order_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update purchase order items" ON purchase_order_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete purchase order items" ON purchase_order_items FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view sales orders" ON sales_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert sales orders" ON sales_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update sales orders" ON sales_orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete sales orders" ON sales_orders FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view sales order items" ON sales_order_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert sales order items" ON sales_order_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update sales order items" ON sales_order_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete sales order items" ON sales_order_items FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view inventory transactions" ON inventory_transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can create inventory transactions" ON inventory_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view invoices" ON invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert invoices" ON invoices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update invoices" ON invoices FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete invoices" ON invoices FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view invoice items" ON invoice_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert invoice items" ON invoice_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update invoice items" ON invoice_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete invoice items" ON invoice_items FOR DELETE USING (auth.role() = 'authenticated');