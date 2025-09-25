'use client'

import { ReactNode } from 'react'

interface ResponsiveTableProps {
  children: ReactNode
  className?: string
  minWidth?: string
}

export function ResponsiveTable({ children, className = '', minWidth = '800px' }: ResponsiveTableProps) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <div className={`min-w-full md:min-w-[${minWidth}] ${className}`}>
        {children}
      </div>
    </div>
  )
}

interface ResponsiveTableWrapperProps {
  children: ReactNode
  className?: string
}

export function ResponsiveTableWrapper({ children, className = '' }: ResponsiveTableWrapperProps) {
  return (
    <div className={`overflow-x-auto -mx-2 sm:mx-0 ${className}`}>
      <div className="inline-block min-w-full align-middle px-2 sm:px-0">
        {children}
      </div>
    </div>
  )
}

interface MobileCardTableProps {
  headers: string[]
  data: Array<Record<string, any>>
  renderRow: (item: any, index: number) => ReactNode
  renderCard?: (item: any, index: number) => ReactNode
  keyExtractor: (item: any, index: number) => string | number
}

export function MobileCardTable({
  headers,
  data,
  renderRow,
  renderCard,
  keyExtractor
}: MobileCardTableProps) {
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <ResponsiveTableWrapper>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                {headers.map((header, index) => (
                  <th key={index} className="text-left py-3 px-4 font-medium text-gray-700">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => renderRow(item, index))}
            </tbody>
          </table>
        </ResponsiveTableWrapper>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {data.map((item, index) => (
          <div key={keyExtractor(item, index)}>
            {renderCard ? renderCard(item, index) : (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                {/* Default card rendering */}
                <div className="space-y-2 text-sm">
                  {Object.entries(item).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-500 capitalize">{key.replace('_', ' ')}</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}