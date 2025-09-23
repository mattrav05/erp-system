/**
 * Shipping Service - Business Logic for Inventory Deductions
 * Handles the sync process between ShipStation and ERP inventory
 */

import { supabase } from './supabase'
import {
  createShipStationAPI,
  ShipStationAPI,
  ShipStationConfigService,
  ShipStationShipment,
  ShipStationUtils,
  ShipStationApiError
} from './shipstation-api'

// Types for the shipping service
export interface ShippingDeduction {
  id: string
  sync_date: string
  total_orders_processed: number
  orders_with_our_skus: number
  total_deducted: number
  status: 'pending' | 'processed' | 'error' | 'ignored'
  error_message?: string
  processed_at?: string
  created_at: string
  items: ShippingDeductionItem[]
}

export interface ShippingDeductionItem {
  id: string
  sku: string
  product_name: string
  total_quantity_shipped: number
  orders_containing_sku: number
  unit_cost: number
  total_cost: number
  inventory_found: boolean
  ignored_reason?: string
  product_id?: string
}

export interface SyncResult {
  success: boolean
  deductionId?: string
  processedOrders: number
  ordersWithSkus: number
  uniqueSkus: number
  totalValue: number
  error?: string
  duplicatesSkipped: number
}

export interface ProcessingResult {
  success: boolean
  processed_items: number
  total_cost_deducted: number
  error?: string
}

export class ShippingService {
  private api: ShipStationAPI | null = null

  constructor(api?: ShipStationAPI) {
    this.api = api || null
  }

  /**
   * Initialize the service with ShipStation API
   */
  async initialize(): Promise<boolean> {
    try {
      this.api = await createShipStationAPI()
      return this.api !== null
    } catch (error) {
      console.error('Failed to initialize ShipStation API:', error)
      return false
    }
  }

  /**
   * Sync shipments for a specific date
   */
  async syncShipmentsForDate(date: Date): Promise<SyncResult> {
    if (!this.api) {
      await this.initialize()
      if (!this.api) {
        return {
          success: false,
          error: 'ShipStation API not configured',
          processedOrders: 0,
          ordersWithSkus: 0,
          uniqueSkus: 0,
          totalValue: 0,
          duplicatesSkipped: 0
        }
      }
    }

    try {
      // Update sync status to in_progress
      await ShipStationConfigService.updateSyncStatus(date, 'in_progress')

      // Check if we already synced this date
      const existingSync = await this.getDeductionForDate(date)
      if (existingSync) {
        return {
          success: false,
          error: `Date ${date.toDateString()} already synced`,
          processedOrders: 0,
          ordersWithSkus: 0,
          uniqueSkus: 0,
          totalValue: 0,
          duplicatesSkipped: 0
        }
      }

      console.log(`Starting ShipStation sync for ${date.toDateString()}`)

      // Fetch all shipments for the date
      const shipments = await this.api.getAllShipmentsForDate(date)

      if (shipments.length === 0) {
        // Create ignored record for no shipments
        const deductionId = await this.createIgnoredDeduction(date, 'No shipments found for this date')
        await ShipStationConfigService.updateSyncStatus(date, 'success')

        return {
          success: true,
          deductionId,
          processedOrders: 0,
          ordersWithSkus: 0,
          uniqueSkus: 0,
          totalValue: 0,
          duplicatesSkipped: 0
        }
      }

      // Filter out already processed orders
      const { newShipments, duplicatesSkipped } = await this.filterProcessedShipments(shipments)

      if (newShipments.length === 0) {
        const deductionId = await this.createIgnoredDeduction(
          date,
          `All ${shipments.length} shipments were already processed`
        )

        return {
          success: true,
          deductionId,
          processedOrders: shipments.length,
          ordersWithSkus: 0,
          uniqueSkus: 0,
          totalValue: 0,
          duplicatesSkipped
        }
      }

      // Aggregate items by SKU
      const skuAggregation = ShipStationUtils.aggregateItemsBySku(newShipments)

      // Match SKUs to our inventory
      const matchedItems = await this.matchSkusToInventory(skuAggregation)

      // Count orders that contain our SKUs
      const ordersWithOurSkus = this.countOrdersWithOurSkus(newShipments, matchedItems)

      // Create deduction record
      const deductionId = await this.createShippingDeduction({
        date,
        totalOrders: newShipments.length,
        ordersWithSkus: ordersWithOurSkus,
        items: matchedItems,
        shipments: newShipments
      })

      // Mark processed orders
      await this.markOrdersAsProcessed(newShipments, deductionId)

      // Update sync status
      await ShipStationConfigService.updateSyncStatus(date, 'success')

      const totalValue = matchedItems.reduce((sum, item) => sum + item.total_cost, 0)

      console.log(`Sync completed for ${date.toDateString()}: ${matchedItems.length} SKUs matched`)

      return {
        success: true,
        deductionId,
        processedOrders: newShipments.length,
        ordersWithSkus: ordersWithOurSkus,
        uniqueSkus: matchedItems.length,
        totalValue,
        duplicatesSkipped
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
      console.error('Sync failed:', error)

      await ShipStationConfigService.updateSyncStatus(date, 'error', errorMessage)

      return {
        success: false,
        error: errorMessage,
        processedOrders: 0,
        ordersWithSkus: 0,
        uniqueSkus: 0,
        totalValue: 0,
        duplicatesSkipped: 0
      }
    }
  }

  /**
   * Filter out shipments that were already processed
   */
  private async filterProcessedShipments(shipments: ShipStationShipment[]): Promise<{
    newShipments: ShipStationShipment[]
    duplicatesSkipped: number
  }> {
    const orderIds = shipments.map(s => s.orderId.toString())

    const { data: processedOrders } = await supabase
      .from('processed_shipstation_orders')
      .select('shipstation_order_id')
      .in('shipstation_order_id', orderIds)

    const processedIds = new Set(processedOrders?.map(p => p.shipstation_order_id) || [])

    const newShipments = shipments.filter(s => !processedIds.has(s.orderId.toString()))

    return {
      newShipments,
      duplicatesSkipped: shipments.length - newShipments.length
    }
  }

  /**
   * Match ShipStation SKUs to our inventory
   */
  private async matchSkusToInventory(
    skuAggregation: Map<string, any>
  ): Promise<ShippingDeductionItem[]> {
    const skus = Array.from(skuAggregation.keys())

    // Get our products that match these SKUs
    const { data: products } = await supabase
      .from('products')
      .select(`
        id,
        sku,
        name,
        inventory (
          id,
          weighted_average_cost,
          quantity_on_hand
        )
      `)
      .in('sku', skus)

    const productMap = new Map(products?.map(p => [p.sku.toUpperCase(), p]) || [])

    const matchedItems: ShippingDeductionItem[] = []

    for (const [sku, aggregatedData] of skuAggregation) {
      const product = productMap.get(sku)

      if (product && product.inventory && product.inventory.length > 0) {
        // Product found in our inventory
        const inventory = product.inventory[0] // Assuming single location for now
        const unitCost = inventory.weighted_average_cost || 0

        matchedItems.push({
          id: '', // Will be set when saved to database
          sku: product.sku, // Use original case from our database
          product_name: product.name,
          total_quantity_shipped: aggregatedData.totalQuantity,
          orders_containing_sku: aggregatedData.orderCount,
          unit_cost: unitCost,
          total_cost: aggregatedData.totalQuantity * unitCost,
          inventory_found: true,
          product_id: product.id
        })
      } else {
        // SKU not found in our inventory
        matchedItems.push({
          id: '',
          sku: sku,
          product_name: aggregatedData.productName,
          total_quantity_shipped: aggregatedData.totalQuantity,
          orders_containing_sku: aggregatedData.orderCount,
          unit_cost: 0,
          total_cost: 0,
          inventory_found: false,
          ignored_reason: 'SKU not found in inventory - likely drop ship or third-party item'
        })
      }
    }

    return matchedItems
  }

  /**
   * Count how many orders contain our SKUs
   */
  private countOrdersWithOurSkus(
    shipments: ShipStationShipment[],
    matchedItems: ShippingDeductionItem[]
  ): number {
    const ourSkus = new Set(
      matchedItems
        .filter(item => item.inventory_found)
        .map(item => item.sku.toUpperCase())
    )

    const ordersWithOurSkus = new Set<string>()

    shipments.forEach(shipment => {
      shipment.orderItems.forEach(item => {
        const sku = (item.sku || item.fulfillmentSku)?.toUpperCase()
        if (sku && ourSkus.has(sku)) {
          ordersWithOurSkus.add(shipment.orderNumber)
        }
      })
    })

    return ordersWithOurSkus.size
  }

  /**
   * Create shipping deduction record
   */
  private async createShippingDeduction(params: {
    date: Date
    totalOrders: number
    ordersWithSkus: number
    items: ShippingDeductionItem[]
    shipments: ShipStationShipment[]
  }): Promise<string> {
    const { date, totalOrders, ordersWithSkus, items, shipments } = params

    const totalDeducted = items
      .filter(item => item.inventory_found)
      .reduce((sum, item) => sum + item.total_cost, 0)

    // Create main deduction record
    const { data: deduction, error } = await supabase
      .from('shipping_deductions')
      .insert({
        sync_date: date.toISOString().split('T')[0],
        total_orders_processed: totalOrders,
        orders_with_our_skus: ordersWithSkus,
        total_deducted: totalDeducted,
        status: items.some(item => item.inventory_found) ? 'pending' : 'ignored',
        shipstation_batch_info: {
          shipment_count: shipments.length,
          date_range: {
            start: date.toISOString(),
            end: date.toISOString()
          },
          api_response_metadata: {
            total_shipments: shipments.length,
            sync_timestamp: new Date().toISOString()
          }
        }
      })
      .select()
      .single()

    if (error) throw error

    // Create item records
    const itemsToInsert = items.map(item => ({
      shipping_deduction_id: deduction.id,
      product_id: item.product_id || null,
      sku: item.sku,
      product_name: item.product_name,
      total_quantity_shipped: item.total_quantity_shipped,
      orders_containing_sku: item.orders_containing_sku,
      unit_cost: item.unit_cost,
      inventory_found: item.inventory_found,
      ignored_reason: item.ignored_reason
    }))

    const { error: itemsError } = await supabase
      .from('shipping_deduction_items')
      .insert(itemsToInsert)

    if (itemsError) throw itemsError

    return deduction.id
  }

  /**
   * Create ignored deduction record
   */
  private async createIgnoredDeduction(date: Date, reason: string): Promise<string> {
    const { data, error } = await supabase
      .from('shipping_deductions')
      .insert({
        sync_date: date.toISOString().split('T')[0],
        total_orders_processed: 0,
        orders_with_our_skus: 0,
        total_deducted: 0,
        status: 'ignored',
        error_message: reason
      })
      .select()
      .single()

    if (error) throw error

    return data.id
  }

  /**
   * Mark orders as processed to prevent duplicates
   */
  private async markOrdersAsProcessed(
    shipments: ShipStationShipment[],
    deductionId: string
  ): Promise<void> {
    const processedOrders = shipments.map(shipment => ({
      shipstation_order_id: shipment.orderId.toString(),
      shipstation_shipment_id: shipment.shipmentId.toString(),
      ship_date: shipment.shipDate.split('T')[0],
      order_number: shipment.orderNumber,
      tracking_number: shipment.trackingNumber || null,
      shipping_deduction_id: deductionId,
      raw_order_data: {
        orderId: shipment.orderId,
        shipmentId: shipment.shipmentId,
        orderNumber: shipment.orderNumber,
        shipDate: shipment.shipDate,
        trackingNumber: shipment.trackingNumber,
        itemCount: shipment.orderItems.length
      }
    }))

    const { error } = await supabase
      .from('processed_shipstation_orders')
      .insert(processedOrders)

    if (error) throw error
  }

  /**
   * Get existing deduction for a date
   */
  private async getDeductionForDate(date: Date): Promise<ShippingDeduction | null> {
    const { data, error } = await supabase
      .from('shipping_deductions')
      .select('*')
      .eq('sync_date', date.toISOString().split('T')[0])
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // No record found
      }
      throw error
    }

    return data
  }

  /**
   * Load all shipping deductions with items
   */
  async loadDeductions(): Promise<ShippingDeduction[]> {
    const { data, error } = await supabase
      .from('shipping_deductions')
      .select(`
        *,
        items:shipping_deduction_items (*)
      `)
      .order('sync_date', { ascending: false })

    if (error) throw error

    return data || []
  }

  /**
   * Process a pending deduction (update inventory)
   */
  async processDeduction(deductionId: string): Promise<ProcessingResult> {
    try {
      const { data, error } = await supabase.rpc('process_shipping_deduction', {
        deduction_id: deductionId
      })

      if (error) throw error

      return data as ProcessingResult
    } catch (error) {
      console.error('Error processing deduction:', error)
      return {
        success: false,
        processed_items: 0,
        total_cost_deducted: 0,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      }
    }
  }

  /**
   * Sync yesterday's shipments (common operation)
   */
  async syncYesterday(): Promise<SyncResult> {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return this.syncShipmentsForDate(yesterday)
  }

  /**
   * Test ShipStation connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.api) {
      await this.initialize()
      if (!this.api) {
        return { success: false, error: 'ShipStation API not configured' }
      }
    }

    return this.api.testConnection()
  }
}

// Export singleton instance
export const shippingService = new ShippingService()