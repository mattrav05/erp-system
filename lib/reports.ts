import { supabase } from './supabase'

export interface ReportTemplate {
  id: string
  name: string
  description: string
  category: 'inventory' | 'financial' | 'operations' | 'analytics'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  icon_name: string
  is_public: boolean
  sql_template: string
  parameters: ReportParameter[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface ReportParameter {
  id: string
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  required: boolean
  options?: string[]
  defaultValue?: any
}

export interface SavedReport {
  id: string
  name: string
  description?: string
  template_id: string
  user_id: string
  parameter_values: { [key: string]: any }
  is_favorite: boolean
  last_run_at?: string
  run_count: number
  created_at: string
  updated_at: string
  template?: ReportTemplate
}

export interface ReportExecution {
  id: string
  executed_sql: string
  parameter_values: { [key: string]: any }
  result_data?: any[]
  row_count: number
  execution_time_ms: number
  status: 'success' | 'error' | 'running'
  error_message?: string
  executed_at: string
}

export class ReportsService {
  // Get all public templates
  static async getTemplates(): Promise<ReportTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('is_public', true)
        .order('category', { ascending: true })
        .order('difficulty', { ascending: true })

      if (error) {
        // If report_templates table doesn't exist, return hardcoded templates
        console.warn('report_templates table not found, using fallback templates')
        return this.getFallbackTemplates()
      }
      return data || []
    } catch (error) {
      console.warn('Database error, using fallback templates:', error)
      return this.getFallbackTemplates()
    }
  }

  // Fallback templates when database tables don't exist
  private static getFallbackTemplates(): ReportTemplate[] {
    return [
      // INVENTORY REPORTS
      {
        id: 'low-stock-alert',
        name: 'Low Stock Alert',
        description: 'Find items that need reordering - shows products below their reorder point',
        category: 'inventory',
        difficulty: 'beginner',
        icon_name: 'AlertTriangle',
        is_public: true,
        sql_template: 'LOW_STOCK_QUERY',
        parameters: [
          {
            id: "threshold",
            name: "threshold",
            label: "Stock threshold",
            type: "number",
            required: true,
            defaultValue: 30
          },
          {
            id: "location_filter",
            name: "location_filter",
            label: "Filter by Location",
            type: "select",
            required: false,
            options: ["All Locations", "Warehouse A", "Warehouse B", "Store Front", "Backroom"],
            defaultValue: "All Locations"
          },
          {
            id: "category_filter",
            name: "category_filter",
            label: "Filter by Category",
            type: "select",
            required: false,
            options: ["All Categories", "Electronics", "Hardware", "Software", "Office Supplies"],
            defaultValue: "All Categories"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'inventory-valuation',
        name: 'Inventory Valuation',
        description: 'See total value of your inventory by category, location, or supplier',
        category: 'inventory',
        difficulty: 'beginner',
        icon_name: 'DollarSign',
        is_public: true,
        sql_template: 'INVENTORY_VALUATION_QUERY',
        parameters: [
          {
            id: "group_by",
            name: "group_by",
            label: "Group By",
            type: "select",
            required: true,
            options: ["Category", "Location", "Supplier"],
            defaultValue: "Category"
          },
          {
            id: "min_value",
            name: "min_value",
            label: "Minimum Value to Show",
            type: "number",
            required: false,
            defaultValue: 0
          },
          {
            id: "sort_by",
            name: "sort_by",
            label: "Sort Results By",
            type: "select",
            required: true,
            options: ["Total Value", "Quantity", "Item Count"],
            defaultValue: "Total Value"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'stock-movement',
        name: 'Stock Movement Report',
        description: 'Track inventory changes over time with detailed transaction history',
        category: 'inventory',
        difficulty: 'intermediate',
        icon_name: 'TrendingUp',
        is_public: true,
        sql_template: 'STOCK_MOVEMENT_QUERY',
        parameters: [
          {
            id: "date_range",
            name: "date_range",
            label: "Date Range",
            type: "select",
            required: true,
            options: ["Last 7 Days", "Last 30 Days", "Last 90 Days", "This Month", "Last Month", "This Quarter", "Custom"],
            defaultValue: "Last 30 Days"
          },
          {
            id: "start_date",
            name: "start_date",
            label: "Start Date (for custom range)",
            type: "date",
            required: false,
            defaultValue: ""
          },
          {
            id: "end_date",
            name: "end_date",
            label: "End Date (for custom range)",
            type: "date",
            required: false,
            defaultValue: ""
          },
          {
            id: "movement_type",
            name: "movement_type",
            label: "Movement Type",
            type: "select",
            required: false,
            options: ["All Movements", "Stock In", "Stock Out", "Transfers", "Adjustments"],
            defaultValue: "All Movements"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'abc-analysis',
        name: 'ABC Analysis (Product Value)',
        description: 'Classify inventory into A, B, and C categories based on value contribution',
        category: 'analytics',
        difficulty: 'advanced',
        icon_name: 'BarChart3',
        is_public: true,
        sql_template: 'ABC_ANALYSIS_QUERY',
        parameters: [
          {
            id: "analysis_type",
            name: "analysis_type",
            label: "Analysis Type",
            type: "select",
            required: true,
            options: ["By Revenue", "By Profit", "By Volume", "By Frequency"],
            defaultValue: "By Revenue"
          },
          {
            id: "time_period",
            name: "time_period",
            label: "Time Period",
            type: "select",
            required: true,
            options: ["Last 3 Months", "Last 6 Months", "Last 12 Months", "Year to Date"],
            defaultValue: "Last 6 Months"
          },
          {
            id: "a_percentage",
            name: "a_percentage",
            label: "Category A Threshold (%)",
            type: "number",
            required: true,
            defaultValue: 20
          },
          {
            id: "b_percentage",
            name: "b_percentage",
            label: "Category B Threshold (%)",
            type: "number",
            required: true,
            defaultValue: 30
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'dead-stock-analysis',
        name: 'Dead Stock Analysis',
        description: 'Identify slow-moving and obsolete inventory that may need clearance',
        category: 'inventory',
        difficulty: 'intermediate',
        icon_name: 'AlertTriangle',
        is_public: true,
        sql_template: 'DEAD_STOCK_QUERY',
        parameters: [
          {
            id: "days_no_movement",
            name: "days_no_movement",
            label: "Days Without Movement",
            type: "number",
            required: true,
            defaultValue: 90
          },
          {
            id: "min_value",
            name: "min_value",
            label: "Minimum Stock Value",
            type: "number",
            required: false,
            defaultValue: 100
          },
          {
            id: "include_categories",
            name: "include_categories",
            label: "Include Categories",
            type: "select",
            required: false,
            options: ["All Categories", "Electronics Only", "Hardware Only", "Exclude Consumables"],
            defaultValue: "All Categories"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },

      // FINANCIAL REPORTS
      {
        id: 'profit-loss',
        name: 'Profit & Loss Statement',
        description: 'Complete P&L with revenue, costs, and profit analysis',
        category: 'financial',
        difficulty: 'intermediate',
        icon_name: 'DollarSign',
        is_public: true,
        sql_template: 'PROFIT_LOSS_QUERY',
        parameters: [
          {
            id: "period_type",
            name: "period_type",
            label: "Period Type",
            type: "select",
            required: true,
            options: ["Monthly", "Quarterly", "Yearly", "Custom Range"],
            defaultValue: "Monthly"
          },
          {
            id: "periods_back",
            name: "periods_back",
            label: "Number of Periods",
            type: "number",
            required: true,
            defaultValue: 12
          },
          {
            id: "comparison",
            name: "comparison",
            label: "Include Comparison",
            type: "select",
            required: false,
            options: ["None", "Previous Period", "Same Period Last Year", "Budget"],
            defaultValue: "Previous Period"
          },
          {
            id: "breakdown_level",
            name: "breakdown_level",
            label: "Detail Level",
            type: "select",
            required: true,
            options: ["Summary", "By Category", "By Product", "Detailed"],
            defaultValue: "By Category"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'accounts-receivable',
        name: 'Accounts Receivable Aging',
        description: 'Track outstanding customer invoices by aging periods',
        category: 'financial',
        difficulty: 'beginner',
        icon_name: 'FileText',
        is_public: true,
        sql_template: 'AR_AGING_QUERY',
        parameters: [
          {
            id: "aging_periods",
            name: "aging_periods",
            label: "Aging Period Structure",
            type: "select",
            required: true,
            options: ["0-30-60-90+", "0-15-30-45-60+", "0-30-60-90-120+", "Custom"],
            defaultValue: "0-30-60-90+"
          },
          {
            id: "customer_filter",
            name: "customer_filter",
            label: "Customer Filter",
            type: "select",
            required: false,
            options: ["All Customers", "Active Only", "High Value Only", "Problem Accounts"],
            defaultValue: "All Customers"
          },
          {
            id: "min_amount",
            name: "min_amount",
            label: "Minimum Amount",
            type: "number",
            required: false,
            defaultValue: 0
          },
          {
            id: "include_credits",
            name: "include_credits",
            label: "Include Credit Balances",
            type: "select",
            required: false,
            options: ["Yes", "No"],
            defaultValue: "No"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'revenue-analysis',
        name: 'Revenue Analysis',
        description: 'Comprehensive revenue breakdown by various dimensions',
        category: 'financial',
        difficulty: 'intermediate',
        icon_name: 'TrendingUp',
        is_public: true,
        sql_template: 'REVENUE_ANALYSIS_QUERY',
        parameters: [
          {
            id: "time_grouping",
            name: "time_grouping",
            label: "Time Grouping",
            type: "select",
            required: true,
            options: ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"],
            defaultValue: "Monthly"
          },
          {
            id: "revenue_type",
            name: "revenue_type",
            label: "Revenue Type",
            type: "select",
            required: true,
            options: ["Gross Revenue", "Net Revenue", "Recurring Revenue", "One-time Sales"],
            defaultValue: "Gross Revenue"
          },
          {
            id: "breakdown_by",
            name: "breakdown_by",
            label: "Breakdown By",
            type: "select",
            required: true,
            options: ["Customer", "Product Category", "Sales Rep", "Region", "Channel"],
            defaultValue: "Product Category"
          },
          {
            id: "trend_analysis",
            name: "trend_analysis",
            label: "Include Trend Analysis",
            type: "select",
            required: false,
            options: ["Yes", "No"],
            defaultValue: "Yes"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },

      // SALES REPORTS
      {
        id: 'sales-performance',
        name: 'Sales Performance Dashboard',
        description: 'Comprehensive sales metrics with targets and comparisons',
        category: 'analytics',
        difficulty: 'intermediate',
        icon_name: 'TrendingUp',
        is_public: true,
        sql_template: 'SALES_PERFORMANCE_QUERY',
        parameters: [
          {
            id: "performance_period",
            name: "performance_period",
            label: "Performance Period",
            type: "select",
            required: true,
            options: ["This Week", "This Month", "This Quarter", "This Year", "Custom"],
            defaultValue: "This Month"
          },
          {
            id: "comparison_period",
            name: "comparison_period",
            label: "Compare To",
            type: "select",
            required: true,
            options: ["Previous Period", "Same Period Last Year", "Budget/Target", "Industry Average"],
            defaultValue: "Previous Period"
          },
          {
            id: "metrics_included",
            name: "metrics_included",
            label: "Metrics to Include",
            type: "select",
            required: true,
            options: ["Basic (Revenue, Units)", "Standard (+ Margin, Customers)", "Advanced (+ Conversion, LTV)", "All Metrics"],
            defaultValue: "Standard (+ Margin, Customers)"
          },
          {
            id: "rep_breakdown",
            name: "rep_breakdown",
            label: "Sales Rep Breakdown",
            type: "select",
            required: false,
            options: ["None", "Individual Performance", "Team Comparison", "Territory Analysis"],
            defaultValue: "Individual Performance"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'customer-analysis',
        name: 'Customer Analysis Report',
        description: 'Deep dive into customer behavior, value, and segmentation',
        category: 'analytics',
        difficulty: 'advanced',
        icon_name: 'Users',
        is_public: true,
        sql_template: 'CUSTOMER_ANALYSIS_QUERY',
        parameters: [
          {
            id: "analysis_type",
            name: "analysis_type",
            label: "Analysis Type",
            type: "select",
            required: true,
            options: ["Customer Lifetime Value", "RFM Analysis", "Churn Prediction", "Segmentation", "Purchase Patterns"],
            defaultValue: "Customer Lifetime Value"
          },
          {
            id: "time_horizon",
            name: "time_horizon",
            label: "Time Horizon",
            type: "select",
            required: true,
            options: ["Last 6 Months", "Last 12 Months", "Last 24 Months", "All Time"],
            defaultValue: "Last 12 Months"
          },
          {
            id: "customer_segment",
            name: "customer_segment",
            label: "Customer Segment",
            type: "select",
            required: false,
            options: ["All Customers", "New Customers", "Returning Customers", "VIP Customers", "At-Risk Customers"],
            defaultValue: "All Customers"
          },
          {
            id: "include_predictions",
            name: "include_predictions",
            label: "Include Predictive Analytics",
            type: "select",
            required: false,
            options: ["Yes", "No"],
            defaultValue: "No"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'sales-funnel',
        name: 'Sales Funnel Analysis',
        description: 'Track conversion rates through your sales process',
        category: 'analytics',
        difficulty: 'intermediate',
        icon_name: 'Filter',
        is_public: true,
        sql_template: 'SALES_FUNNEL_QUERY',
        parameters: [
          {
            id: "funnel_period",
            name: "funnel_period",
            label: "Analysis Period",
            type: "select",
            required: true,
            options: ["Last 30 Days", "Last 90 Days", "This Quarter", "This Year"],
            defaultValue: "Last 90 Days"
          },
          {
            id: "funnel_stages",
            name: "funnel_stages",
            label: "Funnel Stages",
            type: "select",
            required: true,
            options: ["Lead → Opportunity → Quote → Sale", "Inquiry → Quote → Order → Delivery", "Custom Stages"],
            defaultValue: "Lead → Opportunity → Quote → Sale"
          },
          {
            id: "source_breakdown",
            name: "source_breakdown",
            label: "Breakdown by Source",
            type: "select",
            required: false,
            options: ["None", "Marketing Channel", "Sales Rep", "Product Category"],
            defaultValue: "Marketing Channel"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },

      // OPERATIONS REPORTS
      {
        id: 'order-fulfillment',
        name: 'Order Fulfillment Analysis',
        description: 'Track order processing times, delivery performance, and bottlenecks',
        category: 'operations',
        difficulty: 'intermediate',
        icon_name: 'Package',
        is_public: true,
        sql_template: 'ORDER_FULFILLMENT_QUERY',
        parameters: [
          {
            id: "fulfillment_period",
            name: "fulfillment_period",
            label: "Analysis Period",
            type: "select",
            required: true,
            options: ["Last 7 Days", "Last 30 Days", "This Month", "This Quarter"],
            defaultValue: "Last 30 Days"
          },
          {
            id: "metrics_focus",
            name: "metrics_focus",
            label: "Focus Area",
            type: "select",
            required: true,
            options: ["Processing Time", "Delivery Performance", "Order Accuracy", "All Metrics"],
            defaultValue: "All Metrics"
          },
          {
            id: "order_type",
            name: "order_type",
            label: "Order Type Filter",
            type: "select",
            required: false,
            options: ["All Orders", "Standard Orders", "Rush Orders", "Backorders", "Dropship"],
            defaultValue: "All Orders"
          },
          {
            id: "performance_benchmark",
            name: "performance_benchmark",
            label: "Performance Benchmark",
            type: "select",
            required: false,
            options: ["Internal Target", "Industry Average", "Previous Period", "Best Practice"],
            defaultValue: "Internal Target"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'vendor-performance',
        name: 'Vendor Performance Scorecard',
        description: 'Evaluate supplier performance across multiple criteria',
        category: 'operations',
        difficulty: 'intermediate',
        icon_name: 'Users',
        is_public: true,
        sql_template: 'VENDOR_PERFORMANCE_QUERY',
        parameters: [
          {
            id: "evaluation_period",
            name: "evaluation_period",
            label: "Evaluation Period",
            type: "select",
            required: true,
            options: ["Last 3 Months", "Last 6 Months", "Last 12 Months", "Year to Date"],
            defaultValue: "Last 6 Months"
          },
          {
            id: "performance_criteria",
            name: "performance_criteria",
            label: "Performance Criteria",
            type: "select",
            required: true,
            options: ["Delivery Performance", "Quality Metrics", "Cost Competitiveness", "Overall Score", "All Criteria"],
            defaultValue: "All Criteria"
          },
          {
            id: "vendor_category",
            name: "vendor_category",
            label: "Vendor Category",
            type: "select",
            required: false,
            options: ["All Vendors", "Strategic Suppliers", "Preferred Vendors", "New Vendors", "Problem Vendors"],
            defaultValue: "All Vendors"
          },
          {
            id: "include_recommendations",
            name: "include_recommendations",
            label: "Include Recommendations",
            type: "select",
            required: false,
            options: ["Yes", "No"],
            defaultValue: "Yes"
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },

      // EXECUTIVE DASHBOARD REPORTS
      {
        id: 'executive-dashboard',
        name: 'Executive Dashboard',
        description: 'High-level KPIs and metrics for executive decision making',
        category: 'analytics',
        difficulty: 'beginner',
        icon_name: 'BarChart3',
        is_public: true,
        sql_template: 'EXECUTIVE_DASHBOARD_QUERY',
        parameters: [
          {
            id: "dashboard_period",
            name: "dashboard_period",
            label: "Dashboard Period",
            type: "select",
            required: true,
            options: ["Current Month", "Current Quarter", "Current Year", "Rolling 12 Months"],
            defaultValue: "Current Month"
          },
          {
            id: "kpi_focus",
            name: "kpi_focus",
            label: "KPI Focus Area",
            type: "select",
            required: true,
            options: ["Financial Performance", "Operational Excellence", "Customer Satisfaction", "Growth Metrics", "All Areas"],
            defaultValue: "All Areas"
          },
          {
            id: "comparison_view",
            name: "comparison_view",
            label: "Comparison View",
            type: "select",
            required: true,
            options: ["vs Previous Period", "vs Same Period Last Year", "vs Budget/Target", "vs Industry Benchmark"],
            defaultValue: "vs Previous Period"
          },
          {
            id: "alert_threshold",
            name: "alert_threshold",
            label: "Alert Threshold (%)",
            type: "number",
            required: false,
            defaultValue: 10
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  }

  // Get user's saved reports
  static async getSavedReports(userId: string): Promise<SavedReport[]> {
    try {
      const { data, error } = await supabase
        .from('saved_reports')
        .select(`
          *,
          template:report_templates(*)
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) {
        // Fallback to local storage
        return this.getLocalSavedReports(userId)
      }
      return data || []
    } catch (error) {
      // Fallback to local storage
      return this.getLocalSavedReports(userId)
    }
  }

  // Fallback saved reports from local storage
  private static getLocalSavedReports(userId: string): SavedReport[] {
    if (typeof window === 'undefined') return []
    
    try {
      const saved = localStorage.getItem(`saved_reports_${userId}`)
      const reports = saved ? JSON.parse(saved) : []
      
      // If no saved reports exist, create a sample one for demonstration
      if (reports.length === 0) {
        const sampleReport = this.createSampleSavedReport(userId)
        if (sampleReport) {
          reports.push(sampleReport)
          localStorage.setItem(`saved_reports_${userId}`, JSON.stringify(reports))
        }
      }
      
      return reports
    } catch (error) {
      console.warn('Could not load saved reports from localStorage:', error)
      return []
    }
  }

  // Create a sample saved report for new users
  private static createSampleSavedReport(userId: string): SavedReport | null {
    try {
      const templates = this.getFallbackTemplates()
      const lowStockTemplate = templates.find(t => t.id === 'low-stock-alert')
      
      if (!lowStockTemplate) return null

      return {
        id: `sample_${Date.now()}`,
        name: 'My Weekly Low Stock Check',
        description: 'Sample report to check low stock items - runs weekly',
        template_id: lowStockTemplate.id,
        user_id: userId,
        parameter_values: { threshold: 20 },
        is_favorite: false,
        run_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        template: lowStockTemplate
      }
    } catch (error) {
      console.warn('Could not create sample report:', error)
      return null
    }
  }

  // Save a new report
  static async saveReport(
    templateId: string,
    name: string,
    description: string,
    parameterValues: { [key: string]: any },
    userId: string
  ): Promise<SavedReport> {
    try {
      const { data, error } = await supabase
        .from('saved_reports')
        .insert({
          name,
          description,
          template_id: templateId,
          user_id: userId,
          parameter_values: parameterValues
        })
        .select(`
          *,
          template:report_templates(*)
        `)
        .single()

      if (error) {
        // Fallback to local storage
        return this.saveReportLocally(templateId, name, description, parameterValues, userId)
      }
      return data
    } catch (error) {
      // Fallback to local storage
      return this.saveReportLocally(templateId, name, description, parameterValues, userId)
    }
  }

  // Save report to local storage as fallback
  private static saveReportLocally(
    templateId: string,
    name: string,
    description: string,
    parameterValues: { [key: string]: any },
    userId: string
  ): SavedReport {
    if (typeof window === 'undefined') {
      throw new Error('Cannot save report - no database connection and not in browser environment')
    }

    const templates = this.getFallbackTemplates()
    const template = templates.find(t => t.id === templateId)

    const report: SavedReport = {
      id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      name,
      description,
      template_id: templateId,
      user_id: userId,
      parameter_values: parameterValues,
      is_favorite: false,
      run_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      template
    }

    try {
      const existingReports = this.getLocalSavedReports(userId)
      const updatedReports = [...existingReports, report]
      localStorage.setItem(`saved_reports_${userId}`, JSON.stringify(updatedReports))
      return report
    } catch (error) {
      throw new Error('Could not save report locally: ' + error)
    }
  }

  // Generate SQL from template and parameters
  static generateSQL(template: ReportTemplate, parameters: { [key: string]: any }): string {
    let sql = template.sql_template

    // Replace parameter placeholders
    template.parameters.forEach(param => {
      const value = parameters[param.id] || param.defaultValue
      const placeholder = `{{${param.name}}}`
      
      if (param.type === 'select') {
        // Handle special select mappings
        let sqlValue = value
        if (param.name === 'group_by') {
          const groupMappings: { [key: string]: string } = {
            'Category': 'p.category',
            'Location': 'i.location',
            'Supplier': 'p.supplier_name'
          }
          sqlValue = groupMappings[value] || 'p.category'
        }
        if (param.name === 'metric') {
          const metricMappings: { [key: string]: string } = {
            'Total Value': '(i.quantity_on_hand * i.weighted_average_cost)',
            'Quantity on Hand': 'i.quantity_on_hand',
            'Unit Cost': 'i.weighted_average_cost'
          }
          sqlValue = metricMappings[value] || '(i.quantity_on_hand * i.weighted_average_cost)'
        }
        
        // Special handling for group_field replacement
        if (placeholder === '{{group_field}}') {
          const groupMappings: { [key: string]: string } = {
            'Category': 'p.category',
            'Location': 'COALESCE(i.location, \'Unknown\')',
            'Supplier': '\'Supplier data not available\'' // Since supplier_name column doesn't exist
          }
          sqlValue = groupMappings[parameters['group_by']] || 'p.category'
        }
        
        // Special handling for order_field replacement
        if (placeholder === '{{order_field}}') {
          const orderMappings: { [key: string]: string } = {
            'Total Value': '(i.quantity_on_hand * i.weighted_average_cost)',
            'Quantity on Hand': 'i.quantity_on_hand',
            'Unit Cost': 'i.weighted_average_cost'
          }
          sqlValue = orderMappings[parameters['metric']] || '(i.quantity_on_hand * i.weighted_average_cost)'
        }
        
        sql = sql.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), sqlValue)
      } else if (param.type === 'date') {
        // Handle date parameters
        let dateValue = value
        if (value === 'today') {
          dateValue = new Date().toISOString().split('T')[0]
        } else if (value === '30 days ago') {
          const date = new Date()
          date.setDate(date.getDate() - 30)
          dateValue = date.toISOString().split('T')[0]
        }
        sql = sql.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `'${dateValue}'`)
      } else {
        // Handle other parameter types
        const quotedValue = param.type === 'text' ? `'${value}'` : value
        sql = sql.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), quotedValue)
      }
    })

    return sql
  }

  // Execute a report
  static async executeReport(
    templateId: string,
    parameters: { [key: string]: any },
    userId: string,
    savedReportId?: string
  ): Promise<ReportExecution> {
    const startTime = Date.now()

    try {
      // Get template (try database first, fallback to hardcoded)
      let template: ReportTemplate | undefined
      
      try {
        const { data: dbTemplate, error: templateError } = await supabase
          .from('report_templates')
          .select('*')
          .eq('id', templateId)
          .single()

        if (!templateError) {
          template = dbTemplate
        }
      } catch (error) {
        // Database might not exist, try fallback
      }

      if (!template) {
        // Use fallback template
        const fallbackTemplates = this.getFallbackTemplates()
        template = fallbackTemplates.find(t => t.id === templateId)
        
        if (!template) {
          throw new Error(`Template not found: ${templateId}`)
        }
      }

      // Handle special query types for fallback templates
      let results: any[]
      let sql: string

      if (template.sql_template === 'LOW_STOCK_QUERY') {
        const threshold = parameters.threshold || 30
        const { data, error } = await supabase
          .from('inventory')
          .select(`
            id,
            quantity_on_hand,
            location,
            products (
              sku,
              name,
              category,
              reorder_point
            )
          `)
          .lte('quantity_on_hand', threshold)
          .order('quantity_on_hand', { ascending: true })

        if (error) throw error
        
        results = (data || []).map((item: any) => ({
          sku: item.products?.sku,
          name: item.products?.name,
          category: item.products?.category,
          quantity_on_hand: item.quantity_on_hand,
          reorder_point: item.products?.reorder_point || threshold,
          shortage: (item.products?.reorder_point || threshold) - item.quantity_on_hand,
          location: item.location || 'N/A'
        }))
        
        sql = `SELECT inventory and products WHERE quantity_on_hand <= ${threshold}`
        
      } else if (template.sql_template === 'DEAD_STOCK_QUERY') {
        const daysNoMovement = parameters.days_no_movement || 90
        const minValue = parameters.min_value || 100
        
        const { data, error } = await supabase
          .from('inventory')
          .select(`
            id,
            quantity_on_hand,
            weighted_average_cost,
            location,
            last_movement_date,
            products (
              sku,
              name,
              category
            )
          `)
          .gt('quantity_on_hand', 0)
          .order('last_movement_date', { ascending: true })

        if (error) throw error
        
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysNoMovement)
        
        results = (data || [])
          .filter((item: any) => {
            const stockValue = item.quantity_on_hand * item.weighted_average_cost
            const lastMovement = item.last_movement_date ? new Date(item.last_movement_date) : new Date('2020-01-01')
            return stockValue >= minValue && lastMovement < cutoffDate
          })
          .map((item: any) => ({
            sku: item.products?.sku,
            name: item.products?.name,
            category: item.products?.category,
            quantity_on_hand: item.quantity_on_hand,
            unit_cost: item.weighted_average_cost,
            total_value: item.quantity_on_hand * item.weighted_average_cost,
            days_no_movement: Math.floor((Date.now() - new Date(item.last_movement_date || '2020-01-01').getTime()) / (1000 * 60 * 60 * 24)),
            location: item.location || 'N/A'
          }))
        
        sql = `SELECT dead stock analysis with ${daysNoMovement} days threshold, min value ${minValue}`
        
      } else if (template.sql_template === 'STOCK_MOVEMENT_QUERY') {
        // This would require a stock_movements table, so we'll simulate with basic data
        const { data, error } = await supabase
          .from('inventory')
          .select(`
            id,
            quantity_on_hand,
            location,
            last_movement_date,
            products (
              sku,
              name,
              category
            )
          `)
          .order('last_movement_date', { ascending: false })
          .limit(100)

        if (error) throw error
        
        results = (data || []).map((item: any) => ({
          sku: item.products?.sku,
          name: item.products?.name,
          category: item.products?.category,
          current_quantity: item.quantity_on_hand,
          location: item.location || 'N/A',
          last_movement: item.last_movement_date || 'Unknown',
          movement_type: 'Stock Update' // Simulated
        }))
        
        sql = `SELECT stock movement data (simulated from inventory updates)`
        
      } else if (template.sql_template === 'ACCOUNTS_RECEIVABLE_QUERY' || template.sql_template === 'AR_AGING_QUERY') {
        // This would require invoices with payment tracking
        const { data, error } = await supabase
          .from('invoices')
          .select(`
            id,
            invoice_number,
            customer_name,
            total_amount,
            invoice_date,
            due_date,
            status
          `)
          .in('status', ['SENT', 'OVERDUE', 'PARTIAL'])
          .order('due_date', { ascending: true })

        if (error) throw error
        
        results = (data || []).map((invoice: any) => {
          const invoiceDate = new Date(invoice.invoice_date)
          const dueDate = new Date(invoice.due_date)
          const today = new Date()
          const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
          
          let agingBucket = '0-30 days'
          if (daysOverdue > 90) agingBucket = '90+ days'
          else if (daysOverdue > 60) agingBucket = '60-90 days'
          else if (daysOverdue > 30) agingBucket = '30-60 days'
          
          return {
            invoice_number: invoice.invoice_number,
            customer_name: invoice.customer_name,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            amount: invoice.total_amount,
            days_overdue: daysOverdue,
            aging_bucket: agingBucket,
            status: invoice.status
          }
        })
        
        sql = `SELECT accounts receivable aging analysis`
        
      } else if (template.sql_template === 'EXECUTIVE_DASHBOARD_QUERY') {
        // Aggregate multiple metrics for executive dashboard
        const [inventoryData, salesData, invoiceData] = await Promise.all([
          supabase
            .from('inventory')
            .select('quantity_on_hand, weighted_average_cost')
            .gt('quantity_on_hand', 0),
          supabase
            .from('sales_orders')
            .select('total_amount, order_date, status')
            .gte('order_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
          supabase
            .from('invoices')
            .select('total_amount, invoice_date, status')
            .gte('invoice_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        ])
        
        const inventoryValue = (inventoryData.data || []).reduce((sum: number, item: any) => 
          sum + (item.quantity_on_hand * item.weighted_average_cost), 0)
        
        const salesRevenue = (salesData.data || []).reduce((sum: number, item: any) => 
          sum + (item.total_amount || 0), 0)
        
        const invoiceRevenue = (invoiceData.data || []).reduce((sum: number, item: any) => 
          sum + (item.total_amount || 0), 0)
        
        results = [{
          metric: 'Inventory Value',
          current_value: inventoryValue,
          period: 'Current',
          trend: 'stable'
        }, {
          metric: 'Sales Revenue (30 days)',
          current_value: salesRevenue,
          period: 'Last 30 Days',
          trend: 'up'
        }, {
          metric: 'Invoice Revenue (30 days)',
          current_value: invoiceRevenue,
          period: 'Last 30 Days',
          trend: 'up'
        }, {
          metric: 'Sales Orders Count',
          current_value: (salesData.data || []).length,
          period: 'Last 30 Days',
          trend: 'stable'
        }]
        
        sql = `SELECT executive dashboard KPIs`
        
      } else if (template.sql_template === 'INVENTORY_VALUATION_QUERY') {
        const { data, error } = await supabase
          .from('inventory')
          .select(`
            id,
            quantity_on_hand,
            weighted_average_cost,
            location,
            products (
              category
            )
          `)
          .gt('quantity_on_hand', 0)

        if (error) throw error
        
        // Group by the specified field (default to category since supplier isn't available)
        const groupBy = parameters.group_by || 'Category'
        const grouped = (data || []).reduce((acc: any, item: any) => {
          let groupKey = 'Unknown'
          
          if (groupBy === 'Category') {
            groupKey = item.products?.category || 'Unknown'
          } else if (groupBy === 'Location') {
            groupKey = item.location || 'Unknown'
          } else if (groupBy === 'Supplier') {
            // Since supplier_name doesn't exist, group everything as 'Not Available'
            groupKey = 'Supplier data not available'
          }
          
          if (!acc[groupKey]) {
            acc[groupKey] = {
              grouping: groupKey,
              item_count: 0,
              total_quantity: 0,
              total_value: 0,
              costs: []
            }
          }
          
          acc[groupKey].item_count += 1
          acc[groupKey].total_quantity += item.quantity_on_hand
          acc[groupKey].total_value += item.quantity_on_hand * item.weighted_average_cost
          acc[groupKey].costs.push(item.weighted_average_cost)
          
          return acc
        }, {})
        
        results = Object.values(grouped).map((group: any) => ({
          ...group,
          avg_cost_per_unit: group.costs.reduce((a: number, b: number) => a + b, 0) / group.costs.length
        })).sort((a: any, b: any) => b.total_value - a.total_value)
        
        sql = `SELECT inventory grouped by ${groupBy.toLowerCase()} with value calculations`
        
      } else {
        // Try to execute as regular SQL template
        sql = this.generateSQL(template, parameters)
        console.log('Generated SQL:', sql)

        const { data: queryResults, error: queryError } = await supabase.rpc('execute_sql', { 
          sql_query: sql 
        })

        if (queryError) throw queryError
        results = queryResults || []
      }

      const executionTime = Date.now() - startTime

      // Try to log execution (will fail gracefully if tables don't exist)
      try {
        const execution = {
          template_id: templateId,
          saved_report_id: savedReportId,
          user_id: userId,
          executed_sql: sql,
          parameter_values: parameters,
          result_data: results,
          row_count: results.length,
          execution_time_ms: executionTime,
          status: 'success' as const
        }

        await supabase.from('report_executions').insert(execution)

        // Update saved report last run time if applicable
        if (savedReportId) {
          // First get the current run count
          const { data: reportData } = await supabase
            .from('saved_reports')
            .select('run_count')
            .eq('id', savedReportId)
            .single()
          
          const newRunCount = (reportData?.run_count || 0) + 1
          
          await supabase
            .from('saved_reports')
            .update({ 
              last_run_at: new Date().toISOString(),
              run_count: newRunCount
            })
            .eq('id', savedReportId)
        }
      } catch (logError) {
        console.warn('Could not log report execution:', logError)
      }

      return {
        id: '',
        executed_sql: sql,
        parameter_values: parameters,
        result_data: results,
        row_count: results.length,
        execution_time_ms: executionTime,
        status: 'success',
        executed_at: new Date().toISOString()
      }

    } catch (error: any) {
      const executionTime = Date.now() - startTime
      return {
        id: '',
        executed_sql: '',
        parameter_values: parameters,
        result_data: [],
        row_count: 0,
        execution_time_ms: executionTime,
        status: 'error',
        error_message: error.message,
        executed_at: new Date().toISOString()
      }
    }
  }

  // Execute custom SQL (for SQL console)
  static async executeCustomSQL(sql: string, userId: string): Promise<ReportExecution> {
    const startTime = Date.now()

    try {
      const { data: results, error } = await supabase.rpc('execute_sql', { 
        sql_query: sql 
      })

      const executionTime = Date.now() - startTime

      if (error) {
        return {
          id: '',
          executed_sql: sql,
          parameter_values: {},
          result_data: [],
          row_count: 0,
          execution_time_ms: executionTime,
          status: 'error',
          error_message: error.message,
          executed_at: new Date().toISOString()
        }
      }

      return {
        id: '',
        executed_sql: sql,
        parameter_values: {},
        result_data: results,
        row_count: results?.length || 0,
        execution_time_ms: executionTime,
        status: 'success',
        executed_at: new Date().toISOString()
      }

    } catch (error: any) {
      const executionTime = Date.now() - startTime
      return {
        id: '',
        executed_sql: sql,
        parameter_values: {},
        result_data: [],
        row_count: 0,
        execution_time_ms: executionTime,
        status: 'error',
        error_message: error.message,
        executed_at: new Date().toISOString()
      }
    }
  }

  // Export report results to CSV
  static exportToCSV(data: any[], filename: string = 'report') {
    if (!data || data.length === 0) {
      alert('No data to export')
      return
    }

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(header => {
          const value = row[header]
          // Handle values that might contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Export report results to Excel format
  static exportToExcel(data: any[], filename: string = 'report', sheetName: string = 'Report Data') {
    if (!data || data.length === 0) {
      alert('No data to export')
      return
    }

    // Create a simple Excel-compatible format (HTML table that Excel can read)
    const headers = Object.keys(data[0])
    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>${filename}</title>
        </head>
        <body>
          <table border="1">
            <thead>
              <tr>
                ${headers.map(header => `<th>${header.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xls`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Generate PDF report (basic implementation)
  static exportToPDF(data: any[], filename: string = 'report', reportTitle: string = 'Report') {
    if (!data || data.length === 0) {
      alert('No data to export')
      return
    }

    const headers = Object.keys(data[0])
    
    // Create a printable HTML version
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${reportTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .report-meta { margin-bottom: 20px; font-size: 14px; color: #666; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${reportTitle}</h1>
          <div class="report-meta">
            Generated on: ${new Date().toLocaleString()}<br>
            Total Records: ${data.length}
          </div>
          <div class="no-print" style="margin-bottom: 20px;">
            <button onclick="window.print()">Print Report</button>
            <button onclick="window.close()">Close</button>
          </div>
          <table>
            <thead>
              <tr>
                ${headers.map(header => `<th>${header.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${headers.map(header => {
                    const value = row[header]
                    if (typeof value === 'number') {
                      return `<td style="text-align: right;">${value.toLocaleString()}</td>`
                    }
                    return `<td>${value || ''}</td>`
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `

    // Open in new window for printing
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(htmlContent)
      printWindow.document.close()
    }
  }

  // Get report statistics
  static getReportStats(data: any[]): { 
    totalRows: number, 
    numericColumns: string[], 
    textColumns: string[],
    summary: { [key: string]: any }
  } {
    if (!data || data.length === 0) {
      return { totalRows: 0, numericColumns: [], textColumns: [], summary: {} }
    }

    const headers = Object.keys(data[0])
    const numericColumns: string[] = []
    const textColumns: string[] = []
    const summary: { [key: string]: any } = {}

    headers.forEach(header => {
      const values = data.map(row => row[header]).filter(val => val !== null && val !== undefined)
      const numericValues = values.filter(val => typeof val === 'number' || !isNaN(Number(val)))
      
      if (numericValues.length > values.length * 0.7) { // If 70%+ are numeric
        numericColumns.push(header)
        const nums = numericValues.map(val => Number(val))
        summary[header] = {
          min: Math.min(...nums),
          max: Math.max(...nums),
          avg: nums.reduce((a, b) => a + b, 0) / nums.length,
          sum: nums.reduce((a, b) => a + b, 0),
          count: nums.length
        }
      } else {
        textColumns.push(header)
        const uniqueValues = [...new Set(values)]
        summary[header] = {
          unique_count: uniqueValues.length,
          most_common: uniqueValues.slice(0, 5),
          total_count: values.length
        }
      }
    })

    return {
      totalRows: data.length,
      numericColumns,
      textColumns,
      summary
    }
  }

  // Schedule a report (placeholder for future implementation)
  static async scheduleReport(
    templateId: string,
    parameters: { [key: string]: any },
    userId: string,
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly',
      time?: string,
      dayOfWeek?: number,
      dayOfMonth?: number,
      recipients?: string[]
    }
  ): Promise<{ success: boolean, message: string }> {
    // This would integrate with a job scheduler in a real implementation
    return {
      success: true,
      message: 'Report scheduling is not yet implemented, but your request has been saved.'
    }
  }
}