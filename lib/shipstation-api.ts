/**
 * ShipStation API Integration Service
 * Handles all communication with ShipStation API for order and shipment data
 */

import { supabase } from './supabase'

// ShipStation API Response Types
export interface ShipStationShipment {
  shipmentId: number
  orderId: number
  orderNumber: string
  createDate: string
  shipDate: string
  trackingNumber?: string
  orderItems: ShipStationOrderItem[]
  weight?: {
    value: number
    units: string
  }
  dimensions?: {
    length: number
    width: number
    height: number
    units: string
  }
}

export interface ShipStationOrderItem {
  orderItemId: number
  lineItemKey?: string
  sku?: string
  name: string
  quantity: number
  unitPrice: number
  productId?: number
  fulfillmentSku?: string
}

export interface ShipStationResponse<T> {
  shipments?: T[]
  total: number
  page: number
  pages: number
}

export interface ShipStationConfig {
  apiKey: string
  apiSecret: string
  baseUrl: string
}

export class ShipStationApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message)
    this.name = 'ShipStationApiError'
  }
}

export class ShipStationAPI {
  private config: ShipStationConfig
  private readonly baseUrl = 'https://ssapi.shipstation.com'

  constructor(config: ShipStationConfig) {
    this.config = {
      ...config,
      baseUrl: this.baseUrl
    }
  }

  /**
   * Create Basic Auth header for ShipStation API
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64')
    return `Basic ${credentials}`
  }

  /**
   * Make authenticated request to ShipStation API
   */
  private async makeRequest<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl)

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    try {
      console.log(`ShipStation API Request: ${url.toString()}`)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
          'User-Agent': 'ERP-System/1.0'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`ShipStation API Error: ${response.status} - ${errorText}`)

        throw new ShipStationApiError(
          `ShipStation API error: ${response.status} ${response.statusText}`,
          response.status,
          errorText
        )
      }

      const data = await response.json()
      console.log(`ShipStation API Response: ${endpoint} returned ${data.total || 'unknown'} records`)

      return data as T
    } catch (error) {
      if (error instanceof ShipStationApiError) {
        throw error
      }

      console.error('ShipStation API request failed:', error)
      throw new ShipStationApiError(
        `Failed to connect to ShipStation API: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get shipments for a specific date range
   */
  async getShipments(
    shipDateStart: Date,
    shipDateEnd: Date,
    page: number = 1,
    pageSize: number = 500
  ): Promise<ShipStationResponse<ShipStationShipment>> {
    const params = {
      shipDateStart: shipDateStart.toISOString(),
      shipDateEnd: shipDateEnd.toISOString(),
      page,
      pageSize,
      sortBy: 'ShipDate',
      sortDir: 'ASC'
    }

    return this.makeRequest<ShipStationResponse<ShipStationShipment>>('/shipments', params)
  }

  /**
   * Get all shipments for a specific date (handles pagination)
   */
  async getAllShipmentsForDate(date: Date): Promise<ShipStationShipment[]> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    let allShipments: ShipStationShipment[] = []
    let page = 1
    let hasMorePages = true

    while (hasMorePages) {
      const response = await this.getShipments(startOfDay, endOfDay, page)

      if (response.shipments) {
        allShipments = allShipments.concat(response.shipments)
      }

      hasMorePages = page < response.pages
      page++

      // Safety check to prevent infinite loops
      if (page > 100) {
        console.warn('ShipStation pagination exceeded 100 pages, stopping')
        break
      }
    }

    console.log(`Retrieved ${allShipments.length} total shipments for ${date.toDateString()}`)
    return allShipments
  }

  /**
   * Test API connection and credentials
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to get first page of recent shipments
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      await this.getShipments(yesterday, yesterday, 1, 1)

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof ShipStationApiError
        ? error.message
        : 'Unknown connection error'

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Get order details (if needed for additional info)
   */
  async getOrder(orderId: number): Promise<any> {
    return this.makeRequest(`/orders/${orderId}`)
  }
}

/**
 * Service functions for managing ShipStation configuration
 */
export class ShipStationConfigService {
  /**
   * Save encrypted ShipStation configuration
   */
  static async saveConfig(config: {
    apiKey: string
    apiSecret: string
    autoSyncEnabled: boolean
    syncHour: number
  }): Promise<void> {
    try {
      // For now, we'll use simple encoding (in production, use proper encryption)
      const encodedKey = Buffer.from(config.apiKey).toString('base64')
      const encodedSecret = Buffer.from(config.apiSecret).toString('base64')

      const { error } = await supabase
        .from('shipstation_config')
        .upsert({
          api_key_encrypted: encodedKey,
          api_secret_encrypted: encodedSecret,
          auto_sync_enabled: config.autoSyncEnabled,
          sync_hour: config.syncHour,
          is_active: true,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      console.log('ShipStation configuration saved successfully')
    } catch (error) {
      console.error('Error saving ShipStation config:', error)
      throw new Error('Failed to save ShipStation configuration')
    }
  }

  /**
   * Load ShipStation configuration
   */
  static async loadConfig(): Promise<ShipStationConfig | null> {
    try {
      const { data, error } = await supabase
        .from('shipstation_config')
        .select('*')
        .eq('is_active', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No config found
          return null
        }
        throw error
      }

      if (!data) return null

      // Decode the credentials
      const apiKey = Buffer.from(data.api_key_encrypted, 'base64').toString('utf-8')
      const apiSecret = Buffer.from(data.api_secret_encrypted, 'base64').toString('utf-8')

      return {
        apiKey,
        apiSecret,
        baseUrl: 'https://ssapi.shipstation.com'
      }
    } catch (error) {
      console.error('Error loading ShipStation config:', error)
      return null
    }
  }

  /**
   * Update last sync status
   */
  static async updateSyncStatus(
    date: Date,
    status: 'success' | 'error' | 'in_progress',
    errorMessage?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('shipstation_config')
        .update({
          last_sync_date: date.toISOString().split('T')[0],
          last_sync_status: status,
          last_sync_error: errorMessage || null,
          updated_at: new Date().toISOString()
        })
        .eq('is_active', true)

      if (error) throw error
    } catch (error) {
      console.error('Error updating sync status:', error)
    }
  }
}

/**
 * Factory function to create ShipStation API instance
 */
export async function createShipStationAPI(): Promise<ShipStationAPI | null> {
  const config = await ShipStationConfigService.loadConfig()

  if (!config) {
    console.warn('No ShipStation configuration found')
    return null
  }

  return new ShipStationAPI(config)
}

/**
 * Utility functions
 */
export const ShipStationUtils = {
  /**
   * Extract all unique SKUs from shipments
   */
  extractSkusFromShipments(shipments: ShipStationShipment[]): string[] {
    const skus = new Set<string>()

    shipments.forEach(shipment => {
      shipment.orderItems.forEach(item => {
        if (item.sku) {
          skus.add(item.sku.trim().toUpperCase())
        }
        if (item.fulfillmentSku) {
          skus.add(item.fulfillmentSku.trim().toUpperCase())
        }
      })
    })

    return Array.from(skus)
  },

  /**
   * Aggregate shipment items by SKU
   */
  aggregateItemsBySku(shipments: ShipStationShipment[]): Map<string, {
    sku: string
    productName: string
    totalQuantity: number
    orderCount: number
    orders: string[]
  }> {
    const aggregation = new Map()

    shipments.forEach(shipment => {
      shipment.orderItems.forEach(item => {
        const sku = item.sku || item.fulfillmentSku
        if (!sku) return

        const normalizedSku = sku.trim().toUpperCase()

        if (!aggregation.has(normalizedSku)) {
          aggregation.set(normalizedSku, {
            sku: normalizedSku,
            productName: item.name,
            totalQuantity: 0,
            orderCount: 0,
            orders: new Set()
          })
        }

        const existing = aggregation.get(normalizedSku)
        existing.totalQuantity += item.quantity
        existing.orders.add(shipment.orderNumber)
        existing.orderCount = existing.orders.size
      })
    })

    // Convert Sets to Arrays for final result
    for (const [sku, data] of aggregation) {
      data.orders = Array.from(data.orders)
    }

    return aggregation
  }
}