'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { LoginForm } from '../components/auth/LoginForm'
import { Dashboard } from '../components/Dashboard'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      setUser(session?.user || null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        Betöltés...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-transparent flex flex-col">
      {!user ? (
        <div className="flex-1 flex items-center justify-center p-4 md:p-6">
          <div className="w-full max-w-md space-y-4">
            <LoginForm onLoginSuccess={() => {}} />
            <div className="text-center text-sm bg-transparent">
              Még nincs fiókod?{' '}
              <Link
                href="/register"
                className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
              >
                Regisztrálj itt
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <Dashboard />
      )}
    </main>
  )
}