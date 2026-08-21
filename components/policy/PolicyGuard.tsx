'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { PolicyModal } from './PolicyModal'

type Section = { key: string; heading: string; body: string }

interface PolicyData {
  id: string
  version: number
  title: string
  sections: Section[]
}

export function PolicyGuard({ children }: { children: React.ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [policy, setPolicy] = useState<PolicyData | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    checkPolicyAcceptance()
  }, [])

  async function checkPolicyAcceptance() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Aktuális házirend lekérése
    const { data: currentPolicy } = await supabase
      .from('policies')
      .select('id, version, title, sections')
      .eq('is_current', true)
      .maybeSingle()

    if (!currentPolicy) return

    // 2. Ellenőrizzük, hogy a felhasználó elfogadta-e ezt a verziót
    const { data: acceptance } = await supabase
      .from('policy_acceptances')
      .select('id')
      .eq('user_id', user.id)
      .eq('policy_id', currentPolicy.id)
      .maybeSingle()

    if (!acceptance) {
      setPolicy(currentPolicy as PolicyData)
      setModalOpen(true)
    }
  }

  async function handleAccept() {
    if (!policy) return
    setAccepting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('policy_acceptances').insert({
        user_id: user.id,
        policy_id: policy.id,
        version: policy.version,
      })
    }

    setAccepting(false)
    setModalOpen(false)
  }

  return (
    <>
      {children}
      {policy && (
        <PolicyModal
          isOpen={modalOpen}
          title={policy.title}
          version={policy.version}
          sections={policy.sections}
          onAccept={handleAccept}
          accepting={accepting}
        />
      )}
    </>
  )
}