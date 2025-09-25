'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/providers/auth-provider'
import { Ship, RefreshCw, Save, AlertCircle } from 'lucide-react'

interface ModuleSetting {
  id: string
  name: string
  description: string
  icon: React.ComponentType<any>
  enabled: boolean
  category: 'shipping' | 'integration' | 'advanced'
}

export default function ModuleSettings() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modules, setModules] = useState<ModuleSetting[]>([
    {
      id: 'shipping',
      name: 'Shipping Module',
      description: 'Automated inventory deduction from fulfillment provider shipments',
      icon: Ship,
      enabled: false,
      category: 'shipping'
    }
  ])

  useEffect(() => {
    loadModuleSettings()
  }, [])

  const loadModuleSettings = async () => {
    try {
      // Check if company_settings table exists and has enabled_modules column
      const { data, error } = await supabase
        .from('company_settings')
        .select('enabled_modules')
        .single()

      if (error) {
        console.log('Module settings not found, using defaults:', error)
        return
      }

      if (data?.enabled_modules) {
        const enabledModules = data.enabled_modules as string[]
        setModules(prev => prev.map(module => ({
          ...module,
          enabled: enabledModules.includes(module.id)
        })))
      }
    } catch (error) {
      console.log('Error loading module settings, using defaults:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleModuleToggle = (moduleId: string) => {
    setModules(prev => prev.map(module => 
      module.id === moduleId ? { ...module, enabled: !module.enabled } : module
    ))
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const enabledModules = modules.filter(m => m.enabled).map(m => m.id)
      
      // First try to update existing record
      const { data: existingSettings } = await supabase
        .from('company_settings')
        .select('id')
        .single()

      if (existingSettings) {
        // Update existing record
        const { error } = await supabase
          .from('company_settings')
          .update({ 
            enabled_modules: enabledModules,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSettings.id)

        if (error) throw error
      } else {
        // Insert new record
        const { error } = await supabase
          .from('company_settings')
          .insert({ 
            company_name: 'Default Company',
            enabled_modules: enabledModules,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (error) throw error
      }

      console.log('Module settings saved successfully')
      
      // Trigger a page refresh to update navigation immediately
      window.location.reload()
    } catch (error) {
      console.error('Error saving module settings:', error)
      // For now, just log the error - settings are stored in component state
    } finally {
      setSaving(false)
    }
  }

  const getCategoryModules = (category: string) => {
    return modules.filter(module => module.category === category)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading module settings...</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Module Settings</h2>
        <p className="text-gray-600">
          Enable or disable optional system modules. Changes will affect navigation and available features.
        </p>
      </div>

      {/* Shipping & Fulfillment Modules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-blue-600" />
            Shipping & Fulfillment
          </CardTitle>
          <CardDescription>
            Modules that integrate with shipping providers and manage fulfillment workflows
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {getCategoryModules('shipping').map((module) => {
            const Icon = module?.icon
            return (
              <div key={module.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    {Icon && <Icon className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{module.name}</h3>
                    <p className="text-sm text-gray-600">{module.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={module.enabled}
                    onCheckedChange={() => handleModuleToggle(module.id)}
                  />
                  <span className="text-sm text-gray-500">
                    {module.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <AlertCircle className="w-4 h-4" />
          <span>Changes will take effect after saving and refreshing the page</span>
        </div>
        <Button 
          onClick={saveSettings} 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}