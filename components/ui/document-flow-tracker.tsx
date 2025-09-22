'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Package, 
  Receipt, 
  ShoppingCart, 
  ArrowRight, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Workflow
} from 'lucide-react'

export interface DocumentRelationship {
  estimate?: {
    id: string
    number: string
    status: string
    date: string
    amount: number
  }
  salesOrder?: {
    id: string
    number: string
    status: string
    date: string
    amount: number
    fulfillmentPercentage?: number // Percentage of SO that has been invoiced
  }
  invoice?: {
    id: string
    number: string
    status: string
    date: string
    amount: number
    sequence?: number // Invoice 1 of 3, etc.
    isPartial?: boolean
    isFinal?: boolean
  }
  // Support multiple invoices for a single SO
  invoices?: Array<{
    id: string
    number: string
    status: string
    date: string
    amount: number
    sequence?: number
    isPartial?: boolean
    isFinal?: boolean
  }>
  purchaseOrder?: {
    id: string
    number: string
    status: string
    date: string
    amount: number
  }
  // Support multiple POs for a single SO
  purchaseOrders?: Array<{
    id: string
    number: string
    status: string
    date: string
    amount: number
  }>
}

interface DocumentFlowTrackerProps {
  relationships: DocumentRelationship
  currentDocument: 'estimate' | 'salesOrder' | 'invoice' | 'purchaseOrder'
  currentDocumentId?: string // Add ID to identify specific document when multiple exist
  onNavigate?: (type: string, id: string) => void
  className?: string
}

export default function DocumentFlowTracker({ 
  relationships, 
  currentDocument,
  currentDocumentId,
  onNavigate,
  className = '' 
}: DocumentFlowTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getStatusColor = (status: string) => {
    const statusColors = {
      'DRAFT': 'bg-gray-100 text-gray-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'APPROVED': 'bg-green-100 text-green-800',
      'CONFIRMED': 'bg-blue-100 text-blue-800',
      'IN_PROGRESS': 'bg-purple-100 text-purple-800',
      'SHIPPED': 'bg-indigo-100 text-indigo-800',
      'DELIVERED': 'bg-green-100 text-green-800',
      'INVOICED': 'bg-gray-100 text-gray-800',
      'PAID': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    }
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
  }

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'estimate': return <FileText className="w-4 h-4" />
      case 'salesOrder': return <Package className="w-4 h-4" />
      case 'invoice': return <Receipt className="w-4 h-4" />
      case 'purchaseOrder': return <ShoppingCart className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const handleNavigate = (type: string, id: string) => {
    if (onNavigate) {
      onNavigate(type, id)
    } else {
      // Default navigation
      const routes = {
        estimate: '/estimates',
        salesOrder: '/sales-orders',
        invoice: '/invoices',
        purchaseOrder: '/purchase-orders'
      }
      window.open(`${routes[type as keyof typeof routes]}?id=${id}`, '_blank')
    }
  }

  const DocumentCard = ({ 
    type, 
    doc, 
    isCurrent 
  }: { 
    type: string
    doc: any
    isCurrent: boolean 
  }) => (
    <div className={`
      relative p-3 rounded-lg border-2 transition-all duration-200 min-w-[160px]
      ${isCurrent 
        ? 'border-blue-500 bg-blue-50 shadow-md' 
        : doc 
          ? 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm cursor-pointer' 
          : 'border-dashed border-gray-300 bg-gray-50'
      }
    `}>
      {doc ? (
        <div 
          className="space-y-2"
          onClick={() => !isCurrent && handleNavigate(type, doc.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getDocumentIcon(type)}
              <span className="font-medium text-sm capitalize">
                {type === 'salesOrder' ? 'Sales Order' : 
                 type === 'purchaseOrder' ? 'Purchase Order' : type}
              </span>
              {!isCurrent && <ExternalLink className="w-3 h-3 text-gray-400" />}
            </div>
            {isCurrent && <Badge variant="outline" className="text-xs">Current</Badge>}
          </div>
          
          <div className="space-y-1">
            <div className="font-mono text-sm font-semibold text-blue-600">
              {doc.number}
            </div>
            <Badge className={`text-xs ${getStatusColor(doc.status || 'UNKNOWN')}`}>
              {(doc.status || 'UNKNOWN').replace('_', ' ')}
            </Badge>
            {/* Show fulfillment percentage for Sales Orders */}
            {type === 'salesOrder' && doc.fulfillmentPercentage !== undefined && (
              <div className="text-xs font-medium text-blue-600">
                {doc.fulfillmentPercentage}% Invoiced
              </div>
            )}
            {/* Show partial/final badge for Invoices */}
            {type === 'invoice' && doc.isPartial && (
              <Badge className="text-xs bg-orange-100 text-orange-800">Partial</Badge>
            )}
            {type === 'invoice' && doc.isFinal && (
              <Badge className="text-xs bg-green-100 text-green-800">Final</Badge>
            )}
            <div className="text-xs text-gray-500">
              {new Date(doc.date).toLocaleDateString()}
            </div>
            <div className="text-sm font-medium">
              ${doc.amount.toFixed(2)}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-2 text-gray-400">
          <div className="flex items-center justify-center gap-2 mb-1">
            {getDocumentIcon(type)}
            <span className="text-sm capitalize">
              {type === 'salesOrder' ? 'Sales Order' : 
               type === 'purchaseOrder' ? 'Purchase Order' : type}
            </span>
          </div>
          <div className="text-xs">Not Created</div>
        </div>
      )}
    </div>
  )

  const Arrow = () => (
    <div className="flex items-center justify-center px-2">
      <ArrowRight className="w-4 h-4 text-gray-400" />
    </div>
  )

  if (!isExpanded) {
    return (
      <div className={`bg-white border rounded-lg p-3 ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between text-gray-600 hover:text-gray-900"
        >
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4" />
            <span className="text-sm font-medium">Document Flow</span>
            <Badge variant="outline" className="text-xs">
              {(() => {
                let count = 0

                // Estimate: exclude if current document
                if (relationships.estimate && currentDocument !== 'estimate') count++

                // Sales Order: exclude if current document
                if (relationships.salesOrder && currentDocument !== 'salesOrder') count++

                // Invoices: always exclude current document (by ID if available, by type if not)
                if (relationships.invoices && relationships.invoices.length > 0) {
                  if (currentDocument === 'invoice' && currentDocumentId) {
                    // Exclude current invoice by ID
                    count += relationships.invoices.filter(inv => inv.id !== currentDocumentId).length
                  } else if (currentDocument === 'invoice') {
                    // Fallback: exclude one invoice if no ID available
                    count += Math.max(0, relationships.invoices.length - 1)
                  } else {
                    // Not viewing an invoice, count all
                    count += relationships.invoices.length
                  }
                } else if (relationships.invoice && currentDocument !== 'invoice') {
                  count++
                }

                // Purchase Orders: always exclude current document (by ID if available, by type if not)
                if (relationships.purchaseOrders && relationships.purchaseOrders.length > 0) {
                  if (currentDocument === 'purchaseOrder' && currentDocumentId) {
                    // Exclude current PO by ID
                    count += relationships.purchaseOrders.filter(po => po.id !== currentDocumentId).length
                  } else if (currentDocument === 'purchaseOrder') {
                    // Fallback: exclude one PO if no ID available
                    count += Math.max(0, relationships.purchaseOrders.length - 1)
                  } else {
                    // Not viewing a PO, count all
                    count += relationships.purchaseOrders.length
                  }
                } else if (relationships.purchaseOrder && currentDocument !== 'purchaseOrder') {
                  count++
                }

                return count
              })()} linked
            </Badge>
          </div>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`bg-white border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Workflow className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Document Flow</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-center overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            <DocumentCard 
              type="estimate" 
              doc={relationships.estimate} 
              isCurrent={currentDocument === 'estimate'}
            />
            
            <Arrow />
            
            <DocumentCard 
              type="salesOrder" 
              doc={relationships.salesOrder} 
              isCurrent={currentDocument === 'salesOrder'}
            />
            
            {/* Handle multiple Invoices */}
            {(relationships.invoices && relationships.invoices.length > 0) ? (
              <>
                <Arrow />
                
                <div className="flex flex-col gap-2">
                  {relationships.invoices.map((inv, index) => (
                    <DocumentCard 
                      key={inv.id}
                      type="invoice" 
                      doc={{
                        ...inv,
                        number: inv.sequence ? `${inv.number} (${inv.sequence} of ${relationships.invoices!.length})` : inv.number
                      }}
                      isCurrent={currentDocument === 'invoice' && (!currentDocumentId || currentDocumentId === inv.id)}
                    />
                  ))}
                </div>
              </>
            ) : relationships.invoice ? (
              <>
                <Arrow />
                
                <DocumentCard 
                  type="invoice" 
                  doc={relationships.invoice} 
                  isCurrent={currentDocument === 'invoice' && (!currentDocumentId || currentDocumentId === relationships.invoice.id)}
                />
              </>
            ) : (
              <>
                <Arrow />
                
                <DocumentCard 
                  type="invoice" 
                  doc={null} 
                  isCurrent={false}
                />
              </>
            )}
            
            {/* Handle multiple Purchase Orders */}
            {(relationships.purchaseOrders && relationships.purchaseOrders.length > 0) ? (
              <>
                <div className="flex flex-col items-center gap-2 px-2">
                  <ArrowRight className="w-4 h-4 text-gray-400 rotate-90" />
                  {(() => {
                    // Calculate the correct count for display
                    const totalPOs = relationships.purchaseOrders!.length
                    const displayCount = currentDocument === 'purchaseOrder' ? totalPOs : totalPOs
                    return displayCount > 1 && (
                      <div className="text-xs text-gray-500 font-medium">
                        {displayCount} POs
                      </div>
                    )
                  })()}
                  <div className="h-4 w-px bg-gray-300" />
                  <ArrowRight className="w-4 h-4 text-gray-400 -rotate-90" />
                </div>
                
                <div className="flex flex-col gap-2">
                  {relationships.purchaseOrders.map((po, index) => (
                    <DocumentCard 
                      key={po.id}
                      type="purchaseOrder" 
                      doc={po} 
                      isCurrent={currentDocument === 'purchaseOrder' && (!currentDocumentId || currentDocumentId === po.id)}
                    />
                  ))}
                </div>
              </>
            ) : relationships.purchaseOrder ? (
              <>
                <div className="flex flex-col items-center gap-2 px-2">
                  <ArrowRight className="w-4 h-4 text-gray-400 rotate-90" />
                  <div className="h-4 w-px bg-gray-300" />
                  <ArrowRight className="w-4 h-4 text-gray-400 -rotate-90" />
                </div>
                
                <DocumentCard 
                  type="purchaseOrder" 
                  doc={relationships.purchaseOrder} 
                  isCurrent={currentDocument === 'purchaseOrder' && (!currentDocumentId || currentDocumentId === relationships.purchaseOrder.id)}
                />
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2 px-2">
                  <ArrowRight className="w-4 h-4 text-gray-400 rotate-90" />
                  <div className="h-4 w-px bg-gray-300" />
                  <ArrowRight className="w-4 h-4 text-gray-400 -rotate-90" />
                </div>
                
                <DocumentCard 
                  type="purchaseOrder" 
                  doc={null} 
                  isCurrent={false}
                />
              </>
            )}
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Click on any document to navigate. Current document is highlighted in blue.
          </p>
        </div>
      </div>
    </div>
  )
}