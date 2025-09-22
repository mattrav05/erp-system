'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestConnection() {
  const [status, setStatus] = useState('Testing connection...')

  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log('Testing Supabase connection...')
        console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
        console.log('Key (first 20 chars):', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20))
        
        // Test direct fetch to Supabase REST API
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?select=count&limit=1`, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('Direct fetch successful:', data)
          setStatus('✅ Direct connection successful!')
        } else {
          console.error('Response not ok:', response.status, response.statusText)
          setStatus(`HTTP Error: ${response.status} ${response.statusText}`)
        }
      } catch (err) {
        console.error('Network error:', err)
        setStatus(`Network Error: ${err}`)
      }
    }

    testConnection()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Connection Test</h1>
      <p>{status}</p>
    </div>
  )
}