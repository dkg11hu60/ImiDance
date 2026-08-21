'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function SchemaInspector() {
  const [schemaInfo, setSchemaInfo] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function inspectDatabase() {
      const tables = ['events', 'attendances', 'profiles', 'users']
      const results: Record<string, string[]> = {}

      for (const table of tables) {
        try {
          const { data, error } = await supabase.from(table).select('*').limit(1)
          if (!error && data && data.length > 0) {
            results[table] = Object.keys(data[0])
          } else if (!error && data) {
            results[table] = ['(Üres tábla, nincs sor, de elérhető)']
          } else {
            results[table] = [`Hiba: ${error?.message || 'Nem elérhető'}`]
          }
        } catch (e: any) {
          results[table] = [`Kivétel: ${e.message}`]
        }
      }

      setSchemaInfo(results)
      setLoading(false)
    }

    inspectDatabase()
  }, [])

  if (loading) return <div className="p-6 text-center text-zinc-500">Adatbázis sémák lekérdezése...</div>

  return (
    <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm space-y-4 max-w-2xl mx-auto mt-6">
      <h2 className="text-xl font-bold text-zinc-900">Adatbázis Séma Ellenőrző</h2>
      <p className="text-sm text-zinc-500">Az alábbi táblák és oszlopnevek lettek lekérdezve közvetlenül a Supabase-ből:</p>
      <div className="space-y-3">
        {Object.entries(schemaInfo).map(([table, columns]) => (
          <div key={table} className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
            <span className="font-semibold text-emerald-700">{table}:</span>{' '}
            <span className="text-zinc-700 font-mono text-sm">{columns.join(', ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}