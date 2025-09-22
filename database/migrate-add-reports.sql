-- Migration: Add Reports and Templates Tables
-- This adds tables for report templates and user saved reports

-- Create report_templates table (public templates available to all users)
CREATE TABLE report_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('inventory', 'financial', 'operations', 'analytics')),
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    icon_name TEXT NOT NULL,
    is_public BOOLEAN DEFAULT true,
    sql_template TEXT NOT NULL, -- SQL with parameter placeholders like {{date_from}}
    parameters JSONB DEFAULT '[]'::jsonb, -- Array of parameter definitions
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create saved_reports table (user-specific saved reports)
CREATE TABLE saved_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    parameter_values JSONB DEFAULT '{}'::jsonb, -- User's parameter values
    is_favorite BOOLEAN DEFAULT false,
    last_run_at TIMESTAMP WITH TIME ZONE,
    run_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create report_executions table (track report runs and cache results)
CREATE TABLE report_executions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    saved_report_id UUID REFERENCES saved_reports(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    executed_sql TEXT NOT NULL,
    parameter_values JSONB DEFAULT '{}'::jsonb,
    result_data JSONB, -- Store query results for caching
    row_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_report_templates_category ON report_templates(category);
CREATE INDEX idx_report_templates_difficulty ON report_templates(difficulty);
CREATE INDEX idx_report_templates_public ON report_templates(is_public);
CREATE INDEX idx_saved_reports_user ON saved_reports(user_id);
CREATE INDEX idx_saved_reports_template ON saved_reports(template_id);
CREATE INDEX idx_saved_reports_favorite ON saved_reports(user_id, is_favorite);
CREATE INDEX idx_report_executions_user ON report_executions(user_id);
CREATE INDEX idx_report_executions_date ON report_executions(executed_at DESC);

-- Add updated_at triggers
CREATE TRIGGER update_report_templates_updated_at 
    BEFORE UPDATE ON report_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_reports_updated_at 
    BEFORE UPDATE ON saved_reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report_templates
CREATE POLICY "Anyone can view public templates" ON report_templates 
    FOR SELECT USING (is_public = true OR auth.uid() = created_by);
CREATE POLICY "Users can create templates" ON report_templates 
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own templates" ON report_templates 
    FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own templates" ON report_templates 
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for saved_reports
CREATE POLICY "Users can view own saved reports" ON saved_reports 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create saved reports" ON saved_reports 
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved reports" ON saved_reports 
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved reports" ON saved_reports 
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for report_executions
CREATE POLICY "Users can view own executions" ON report_executions 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create executions" ON report_executions 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insert default report templates
INSERT INTO report_templates (name, description, category, difficulty, icon_name, sql_template, parameters) VALUES
(
    'Low Stock Alert',
    'Find items that need reordering - shows products below their reorder point',
    'inventory',
    'beginner',
    'AlertTriangle',
    'SELECT 
        p.sku,
        p.name,
        p.category,
        i.quantity_on_hand,
        COALESCE(p.reorder_point, 0) as reorder_point,
        (COALESCE(p.reorder_point, 0) - i.quantity_on_hand) as shortage,
        i.location
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    WHERE i.quantity_on_hand <= COALESCE(p.reorder_point, {{days_ahead}})
    ORDER BY shortage DESC
    LIMIT 100',
    '[
        {
            "id": "days_ahead",
            "name": "days_ahead", 
            "label": "Low stock threshold (days ahead)",
            "type": "number",
            "required": true,
            "defaultValue": 30
        }
    ]'::jsonb
),
(
    'Inventory Valuation',
    'See total value of your inventory by category or location',
    'financial',
    'beginner',
    'DollarSign',
    'SELECT 
        {{group_field}} as grouping,
        COUNT(*) as item_count,
        SUM(i.quantity_on_hand) as total_quantity,
        SUM(i.quantity_on_hand * i.weighted_average_cost) as total_value,
        AVG(i.weighted_average_cost) as avg_cost_per_unit
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    WHERE i.quantity_on_hand > 0
    GROUP BY {{group_field}}
    ORDER BY total_value DESC',
    '[
        {
            "id": "group_by",
            "name": "group_by",
            "label": "Group by",
            "type": "select",
            "required": true,
            "options": ["Category", "Location", "Supplier"],
            "defaultValue": "Category"
        }
    ]'::jsonb
),
(
    'Top Products',
    'Your best performing products by value or quantity',
    'analytics',
    'beginner',
    'TrendingUp',
    'SELECT 
        p.sku,
        p.name,
        p.category,
        i.quantity_on_hand,
        i.weighted_average_cost,
        (i.quantity_on_hand * i.weighted_average_cost) as total_value,
        i.location
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    WHERE i.quantity_on_hand > 0
    ORDER BY {{order_field}} DESC
    LIMIT {{limit}}',
    '[
        {
            "id": "metric",
            "name": "metric",
            "label": "Rank by",
            "type": "select",
            "required": true,
            "options": ["Total Value", "Quantity on Hand", "Unit Cost"],
            "defaultValue": "Total Value"
        },
        {
            "id": "limit",
            "name": "limit",
            "label": "Show top",
            "type": "number",
            "required": true,
            "defaultValue": 20
        }
    ]'::jsonb
),
(
    'Adjustment Summary',
    'Review inventory adjustments over time with reasons and totals',
    'operations',
    'beginner',
    'FileText',
    'SELECT 
        a.adjustment_number,
        a.adjustment_date::date as date,
        a.reason_category,
        a.status,
        COUNT(al.id) as line_count,
        SUM(ABS(al.adjustment_quantity)) as total_quantity_changed,
        SUM(ABS(al.adjustment_quantity * al.previous_quantity * 0.01)) as estimated_value_impact
    FROM inventory_adjustments a
    JOIN inventory_adjustment_lines al ON a.id = al.adjustment_id
    WHERE a.adjustment_date >= {{date_from}}::date
      AND a.adjustment_date <= {{date_to}}::date
    GROUP BY a.id, a.adjustment_number, a.adjustment_date, a.reason_category, a.status
    ORDER BY a.adjustment_date DESC',
    '[
        {
            "id": "date_from",
            "name": "date_from",
            "label": "From date",
            "type": "date",
            "required": true,
            "defaultValue": "30 days ago"
        },
        {
            "id": "date_to", 
            "name": "date_to",
            "label": "To date",
            "type": "date", 
            "required": true,
            "defaultValue": "today"
        }
    ]'::jsonb
);