'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface SimpleSalesOrdersListProps {
  onCreateSalesOrder: () => void
  onEditSalesOrder: (salesOrder: any) => void
  salesOrders: any[]
  setSalesOrders: (salesOrders: any[]) => void
}

export default function SimpleSalesOrdersList({ 
  onCreateSalesOrder, 
  onEditSalesOrder, 
  salesOrders, 
  setSalesOrders 
}: SimpleSalesOrdersListProps) {
  const [isLoading, setIsLoading] = useState(true)

  console.log('SimpleSalesOrdersList component mounted')

  useEffect(() => {
    console.log('SimpleSalesOrdersList useEffect called')
    fetchSalesOrders()
  }, [])

  const fetchSalesOrders = async () => {
    try {
      console.log('Fetching sales orders...')
      
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*')
        .limit(10)

      if (error) {
        console.error('Error fetching sales orders:', error)
        setSalesOrders([])
      } else {
        console.log('Sales orders fetched successfully:', data)
        setSalesOrders(data || [])
      }
    } catch (error) {
      console.error('Catch block - Error fetching sales orders:', error)
      setSalesOrders([])
    } finally {
      console.log('Setting loading to false')
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        <p>Loading sales orders...</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Sales Orders ({salesOrders.length})</h2>
        <button 
          onClick={onCreateSalesOrder}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          New Sales Order
        </button>
      </div>
      
      {salesOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No sales orders found</p>
          <button 
            onClick={onCreateSalesOrder}
            className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Create First Sales Order
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {salesOrders.map((so, index) => (
            <div key={so.id || index} className="border border-gray-200 rounded p-3">
              <div className="flex justify-between items-center">
                <div>
                  <strong>{so.so_number}</strong>
                  <p className="text-sm text-gray-600">Status: {so.status}</p>
                  <p className="text-sm text-gray-600">Total: ${so.total_amount}</p>
                </div>
                <button 
                  onClick={() => onEditSalesOrder(so)}
                  className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}