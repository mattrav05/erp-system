'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Ship, Search, Download, RefreshCw, Eye, Trash2, Calendar, Package, AlertCircle, Settings, Key, X, CheckCircle, PlayCircle, AlertTriangle } from 'lucide-react'
import { shippingService, ShippingDeduction, SyncResult, ProcessingResult } from '@/lib/shipping-service'
import { ShipStationConfigService } from '@/lib/shipstation-api'

// Remove duplicate interface - using the one from shipping-service

interface ShipStationConfig {
  apiKey: string
  apiSecret: string
  lastSync: string | null
  autoSyncEnabled: boolean
  syncHour: number
}

export default function ShippingList() {
  const [deductions, setDeductions] = useState<ShippingDeduction[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'processed' | 'error' | 'ignored'>('all')
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState<ShipStationConfig>({
    apiKey: '',
    apiSecret: '',
    lastSync: null,
    autoSyncEnabled: false,
    syncHour: 8
  })
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [processing, setProcessing] = useState<string | null>(null) // ID of deduction being processed

  useEffect(() => {
    loadDeductions()
    loadConfig()
    
    // Auto-sync check - run on page load if configured
    checkAutoSync()
  }, [])

  const checkAutoSync = async () => {
    try {
      const savedConfig = localStorage.getItem('shipstation_config')
      if (!savedConfig) return

      const config = JSON.parse(savedConfig)
      if (!config.auto_sync_enabled || !config.api_key || !config.api_secret) return

      // Check if we need to sync (hasn't synced today)
      const today = new Date().toDateString()
      const lastSyncDate = config.last_sync ? new Date(config.last_sync).toDateString() : null
      
      if (lastSyncDate !== today) {
        console.log('Auto-sync triggered - no sync today yet')
        await syncWithShipStation()
      } else {
        console.log('Auto-sync skipped - already synced today')
      }
    } catch (error) {
      console.error('Error checking auto-sync:', error)
    }
  }

  const loadConfig = async () => {
    try {
      // Try to load from database first
      const { data } = await supabase
        .from('shipstation_config')
        .select('*')
        .eq('is_active', true)
        .single()

      if (data) {
        // Decode the stored configuration
        const apiKey = Buffer.from(data.api_key_encrypted, 'base64').toString('utf-8')
        const apiSecret = Buffer.from(data.api_secret_encrypted, 'base64').toString('utf-8')

        setConfig({
          apiKey,
          apiSecret,
          lastSync: data.last_sync_date,
          autoSyncEnabled: data.auto_sync_enabled || false,
          syncHour: data.sync_hour || 8
        })
      } else {
        // Fallback to localStorage for backwards compatibility
        const savedConfig = localStorage.getItem('shipstation_config')
        if (savedConfig) {
          const parsed = JSON.parse(savedConfig)
          setConfig({
            apiKey: parsed.api_key || '',
            apiSecret: parsed.api_secret || '',
            lastSync: parsed.last_sync || null,
            autoSyncEnabled: parsed.auto_sync_enabled || false,
            syncHour: parsed.sync_hour || 8
          })
        }
      }
    } catch (error) {
      console.error('Error loading ShipStation config:', error)
      // Try localStorage fallback
      try {
        const savedConfig = localStorage.getItem('shipstation_config')
        if (savedConfig) {
          const parsed = JSON.parse(savedConfig)
          setConfig({
            apiKey: parsed.api_key || '',
            apiSecret: parsed.api_secret || '',
            lastSync: parsed.last_sync || null,
            autoSyncEnabled: parsed.auto_sync_enabled || false,
            syncHour: parsed.sync_hour || 8
          })
        }
      } catch (localError) {
        console.error('Error loading from localStorage:', localError)
      }
    }
  }

  const loadDeductions = async () => {
    try {
      console.log('Loading shipping deductions from database...')
      const deductions = await shippingService.loadDeductions()
      setDeductions(deductions)
    } catch (error) {
      console.error('Error loading shipping deductions:', error)
      // Fallback to empty array if database tables don't exist yet
      setDeductions([])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadDeductions()
    setIsRefreshing(false)
  }

  const syncWithShipStation = async () => {
    if (!config.apiKey || !config.apiSecret) {
      alert('Please configure ShipStation API keys first')
      setShowConfig(true)
      return
    }

    setIsRefreshing(true)
    setSyncResult(null)

    try {
      console.log('Starting ShipStation sync...')

      // Initialize the shipping service if needed
      await shippingService.initialize()

      // Test connection first
      const connectionTest = await shippingService.testConnection()
      if (!connectionTest.success) {
        throw new Error(`Connection failed: ${connectionTest.error}`)
      }

      // Sync yesterday's shipments
      const result = await shippingService.syncYesterday()
      setSyncResult(result)

      if (result.success) {
        console.log('Sync completed successfully:', result)

        // Show success message
        const message = result.uniqueSkus > 0
          ? `Sync completed! Found ${result.uniqueSkus} SKUs across ${result.ordersWithSkus} orders. Total value: ${formatCurrency(result.totalValue)}`
          : `Sync completed! No inventory items found in ${result.processedOrders} shipments.`

        alert(message)

        // Reload deductions to show new data
        await loadDeductions()
      } else {
        throw new Error(result.error || 'Sync failed')
      }

    } catch (error) {
      console.error('Error syncing with ShipStation:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
      alert(`Sync failed: ${errorMessage}`)

      setSyncResult({
        success: false,
        error: errorMessage,
        processedOrders: 0,
        ordersWithSkus: 0,
        uniqueSkus: 0,
        totalValue: 0,
        duplicatesSkipped: 0
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const saveConfig = async () => {
    try {
      await ShipStationConfigService.saveConfig({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        autoSyncEnabled: config.autoSyncEnabled,
        syncHour: config.syncHour
      })

      setShowConfig(false)
      console.log('ShipStation configuration saved to database')
      alert('Configuration saved successfully!')

      // Test the connection with new config
      const testResult = await shippingService.testConnection()
      if (!testResult.success) {
        alert(`Warning: Connection test failed: ${testResult.error}`)
      }

    } catch (error) {
      console.error('Error saving config:', error)
      alert('Failed to save configuration: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  // Add function to process a pending deduction
  const processDeduction = async (deductionId: string) => {
    if (!confirm('This will deduct inventory quantities and cannot be undone. Continue?')) {
      return
    }

    setProcessing(deductionId)
    try {
      const result = await shippingService.processDeduction(deductionId)

      if (result.success) {
        alert(`Successfully processed! ${result.processed_items} items updated. Total cost deducted: ${formatCurrency(result.total_cost_deducted)}`)
        await loadDeductions() // Refresh the list
      } else {
        alert(`Processing failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Error processing deduction:', error)
      alert('Processing failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setProcessing(null)
    }
  }

  // Add function to ignore a deduction
  const ignoreDeduction = async (deductionId: string) => {
    if (!confirm('Mark this deduction as ignored? This will not affect inventory.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('shipping_deductions')
        .update({
          status: 'ignored',
          error_message: 'Manually ignored by user'
        })
        .eq('id', deductionId)

      if (error) throw error

      await loadDeductions() // Refresh the list
    } catch (error) {
      console.error('Error ignoring deduction:', error)
      alert('Failed to ignore deduction')
    }
  }

  const filteredDeductions = deductions.filter(deduction => {
    const matchesSearch = 
      deduction.sync_date.includes(searchTerm) ||
      deduction.items.some(item => 
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )

    const matchesFilter = filter === 'all' || deduction.status === filter

    return matchesSearch && matchesFilter
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50'
      case 'processed': return 'text-green-600 bg-green-50'
      case 'error': return 'text-red-600 bg-red-50'
      case 'ignored': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Shipping</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipping</h1>
          <p className="text-gray-600">Automated inventory deduction from fulfillment provider shipments</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowConfig(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={syncWithShipStation}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Sync Yesterday's Shipments
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Last Sync Info */}
      {config.lastSync && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <Calendar className="w-4 h-4" />
            <span>Last synced: {new Date(config.lastSync).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Sync Result Info */}
      {syncResult && (
        <div className={`border rounded-lg p-4 ${
          syncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2 text-sm">
            {syncResult.success ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
            <span className={syncResult.success ? 'text-green-800' : 'text-red-800'}>
              {syncResult.success ? (
                `Sync completed: ${syncResult.uniqueSkus} SKUs found, ${syncResult.ordersWithSkus} orders processed`
              ) : (
                `Sync failed: ${syncResult.error}`
              )}
            </span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
            <Ship className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deductions.length}</div>
            <p className="text-xs text-gray-600">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {deductions.filter(d => d.status === 'pending').length}
            </div>
            <p className="text-xs text-gray-600">Need review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {deductions.filter(d => d.status === 'processed').length}
            </div>
            <p className="text-xs text-gray-600">Inventory updated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ignored</CardTitle>
            <Package className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {deductions.filter(d => d.status === 'ignored').length}
            </div>
            <p className="text-xs text-gray-600">Drop ships/Unknown SKUs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(deductions.reduce((sum, d) => sum + d.total_deducted, 0))}
            </div>
            <p className="text-xs text-gray-600">Cost deducted</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by date, SKU, or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button 
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pending
          </Button>
          <Button 
            variant={filter === 'processed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('processed')}
          >
            Processed
          </Button>
          <Button 
            variant={filter === 'ignored' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('ignored')}
          >
            Ignored
          </Button>
        </div>
      </div>

      {/* Deductions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDeductions.map((deduction) => (
          <Card key={deduction.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="overflow-x-auto">
                <div className="flex justify-between items-start min-w-[500px]">
                  <div className="flex-1">
                  <CardTitle className="text-lg">Shipments for {new Date(deduction.sync_date).toLocaleDateString()}</CardTitle>
                  <CardDescription>
                    {deduction.total_orders_processed} total orders • {deduction.orders_with_our_skus} contained our SKUs
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(deduction.status)}`}>
                    {deduction.status.toUpperCase()}
                  </span>
                </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Sync Date:</span>
                  <span className="ml-2 font-medium">{new Date(deduction.sync_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">SKU Types:</span>
                  <span className="ml-2 font-medium">{deduction.items.length} different SKUs</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="ml-2 font-medium">{formatCurrency(deduction.total_deducted)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Orders with SKUs:</span>
                  <span className="ml-2 font-medium">{deduction.orders_with_our_skus} of {deduction.total_orders_processed}</span>
                </div>
              </div>
              
              <div className="border-t pt-3">
                <h4 className="font-medium text-sm mb-2">SKU Tabulation ({deduction.items.length} SKUs)</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {deduction.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.inventory_found ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="font-medium">{item.sku}</span>
                        <span className="text-gray-500">- {item.product_name}</span>
                      </span>
                      <span className="text-right">
                        <div><strong>{item.total_quantity_shipped} total</strong></div>
                        <div className="text-xs text-gray-500">in {item.orders_containing_sku} orders</div>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Action buttons for pending deductions */}
                {deduction.status === 'pending' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button
                      size="sm"
                      onClick={() => processDeduction(deduction.id)}
                      disabled={processing === deduction.id}
                      className="bg-green-600 hover:bg-green-700 flex-1"
                    >
                      {processing === deduction.id ? (
                        <>
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3 h-3 mr-1" />
                          Process Deduction
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => ignoreDeduction(deduction.id)}
                      disabled={processing === deduction.id}
                      className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Ignore
                    </Button>
                  </div>
                )}

                {/* Status info for processed/ignored */}
                {deduction.status === 'processed' && deduction.processed_at && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-xs text-green-700">
                      <CheckCircle className="w-3 h-3" />
                      Processed on {new Date(deduction.processed_at).toLocaleString()}
                    </div>
                  </div>
                )}

                {deduction.status === 'error' && deduction.error_message && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-xs text-red-700">
                      <AlertTriangle className="w-3 h-3" />
                      Error: {deduction.error_message}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDeductions.length === 0 && (
        <div className="text-center py-12">
          <Ship className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No shipping deductions found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'Sync with ShipStation to see recent shipments.'}
          </p>
        </div>
      )}

      {/* ShipStation Configuration Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">ShipStation Configuration</h2>
              <Button variant="ghost" onClick={() => setShowConfig(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <Input
                  type="text"
                  value={config.apiKey}
                  onChange={(e) => setConfig(prev => ({...prev, apiKey: e.target.value}))}
                  placeholder="Enter ShipStation API Key"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Secret
                </label>
                <Input
                  type="password"
                  value={config.apiSecret}
                  onChange={(e) => setConfig(prev => ({...prev, apiSecret: e.target.value}))}
                  placeholder="Enter ShipStation API Secret"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_sync"
                  checked={config.autoSyncEnabled}
                  onChange={(e) => setConfig(prev => ({...prev, autoSyncEnabled: e.target.checked}))}
                />
                <label htmlFor="auto_sync" className="text-sm text-gray-700">
                  Enable automatic daily sync
                </label>
              </div>

              {config.autoSyncEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sync Hour (24-hour format)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={config.syncHour}
                    onChange={(e) => setConfig(prev => ({...prev, syncHour: parseInt(e.target.value) || 8}))}
                    placeholder="8"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Hour of the day to run automatic sync (0-23)
                  </p>
                </div>
              )}
              
              <div className="bg-gray-50 p-3 rounded text-xs text-gray-600">
                <p className="font-medium mb-1">Auto-Sync Protection:</p>
                <ul className="space-y-1">
                  <li>• <strong>Once daily sync</strong> - Won't sync same day twice</li>
                  <li>• <strong>Duplicate prevention</strong> - Checks existing ShipStation order IDs</li>
                  <li>• <strong>SKU filtering</strong> - Only processes inventory you track</li>
                  <li>• <strong>Review before deduct</strong> - Creates pending records first</li>
                  <li>• <strong>Auto-triggers on page load</strong> when enabled</li>
                </ul>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowConfig(false)}>
                Cancel
              </Button>
              <Button onClick={saveConfig} className="bg-blue-600 hover:bg-blue-700">
                <Key className="w-4 h-4 mr-2" />
                Save Configuration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}