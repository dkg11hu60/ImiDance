'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { loadVisibleObjects } from '@/lib/permissions'
import { EventList } from '@/components/events/EventList'
import { ProfileEdit } from '@/components/profile/ProfileEdit'
import { StatisticsDashboard } from '@/components/profile/statistics/StatisticsDashboard'
import { EventCreator } from '@/components/teacher/EventCreator'
import { EventManageList } from '@/components/teacher/EventManageList'
import { LocationManagement } from '@/components/teacher/LocationManagement'
import { AdminPanel } from '@/components/admin/AdminPanel'
import { MemberStatus } from '@/components/admin/MemberStatus'
import { PolicyGate } from '@/components/policy/PolicyGate'
import { PolicyEditor } from '@/components/policy/PolicyEditor'

type TopTab = 'events' | 'statistics' | 'profile' | 'teacher' | 'admin'
type TeacherSubTab = 'manage' | 'create' | 'locations' | 'members' | 'policy'

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TopTab>('events')
  const [teacherSub, setTeacherSub] = useState<TeacherSubTab>('manage')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [visible, setVisible] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [policyOk, setPolicyOk] = useState(false)

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(profileData)
        setVisible(await loadVisibleObjects(profileData?.role))
      }
      setLoading(false)
    }

    loadUserData()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  // Jogosultságok az objektum × szerep mátrixból (object_roles)
  const canManageEvents = visible.has('event.create')   // Alkalmak kezelése + Új alkalom
  const canSeeMembers   = visible.has('members.status')  // Tagok aktivitása
  const canAdminPolicy  = visible.has('policy.admin')    // Házirend adminisztrálása
  const canManageUsers  = visible.has('admin.users')     // Adminisztráció (külön top-level)

  // Az Oktatói felület gyűjtő akkor látszik, ha bármelyik alfül elérhető
  const canSeeTeacher = canManageEvents || canSeeMembers || canAdminPolicy

  // Az Oktatói felület alfülei — mind a saját kulcsára
  const teacherSubs: { key: TeacherSubTab; label: string; show: boolean }[] = [
    { key: 'manage',    label: 'Alkalmak kezelése', show: canManageEvents },
    { key: 'create',    label: 'Új alkalom',        show: canManageEvents },
    { key: 'locations', label: 'Helyszínek',        show: canManageEvents },
    { key: 'members',   label: 'Tagok aktivitása',  show: canSeeMembers },
    { key: 'policy',    label: 'Házirend',          show: canAdminPolicy },
  ]
  const visibleTeacherSubs = teacherSubs.filter(s => s.show)

  // Ha az aktuálisan kiválasztott alfül nem elérhető, az első elérhetőre állunk
  useEffect(() => {
    if (activeTab === 'teacher' && !visibleTeacherSubs.some(s => s.key === teacherSub)) {
      if (visibleTeacherSubs.length > 0) setTeacherSub(visibleTeacherSubs[0].key)
    }
  }, [activeTab, visible])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="text-zinc-600 font-medium">Betöltés...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-900">
      {/* Házirend-kapu: belépéskor kötelező elfogadni, ha az aktuális verzió nincs elfogadva. */}
      {user && !policyOk && (
        <PolicyGate userId={user.id} onAccepted={() => setPolicyOk(true)} />
      )}

      {/* Header */}
      <header className="bg-indigo-600/90 border-b border-indigo-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold tracking-tight text-white">ImiDance</h1>
            {profile && (
              <span className="text-xs px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-full">
                {profile.full_name || profile.name || user?.email}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-indigo-100 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-indigo-700"
            >
              Kijelentkezés
            </button>
          </div>
        </div>
      </header>

      {/* Navigation — top-level */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-zinc-200 shadow-sm sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {(() => {
            const tabs: { key: TopTab; label: string; show: boolean }[] = [
              { key: 'events', label: 'Táncórák / Események', show: true },
              { key: 'statistics', label: 'Statisztikák', show: true },
              { key: 'profile', label: 'Profil', show: true },
              { key: 'teacher', label: 'Oktatói felület', show: canSeeTeacher },
              { key: 'admin', label: 'Adminisztráció', show: canManageUsers },
            ]
            const visibleTabs = tabs.filter(t => t.show)
            const activeLabel = visibleTabs.find(t => t.key === activeTab)?.label ?? ''

            return (
              <>
                {/* Desktop */}
                <div className="hidden sm:flex gap-2 py-2">
                  {visibleTabs.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={`py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                        activeTab === t.key
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Mobil: hamburger */}
                <div className="sm:hidden">
                  <button
                    onClick={() => setMenuOpen(o => !o)}
                    className={`w-full flex items-center justify-between py-4 px-3 my-2 rounded-xl text-sm font-semibold transition-colors ${
                      menuOpen ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}
                    aria-expanded={menuOpen}
                  >
                    <span>{activeLabel}</span>
                    <span className="text-xl leading-none">{menuOpen ? '✕' : '☰'}</span>
                  </button>

                  {menuOpen && (
                    <div className="pb-2 mb-2 flex flex-col gap-1 bg-indigo-50 rounded-xl p-2 border border-indigo-100">
                      {visibleTabs.map(t => (
                        <button
                          key={t.key}
                          onClick={() => { setActiveTab(t.key); setMenuOpen(false) }}
                          className={`text-left py-3 px-3 rounded-lg text-sm font-semibold transition-colors ${
                            activeTab === t.key ? 'bg-indigo-600 text-white' : 'text-indigo-700 hover:bg-indigo-100'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'events' && <EventList userId={user?.id} />}
        {activeTab === 'statistics' && <StatisticsDashboard />}
        {activeTab === 'profile' && <ProfileEdit userId={user?.id} />}

        {activeTab === 'teacher' && canSeeTeacher && (
          <div className="space-y-6">
            {/* Oktatói felület — belső alfülek */}
            <div className="flex flex-wrap gap-2">
              {visibleTeacherSubs.map(s => (
                <button
                  key={s.key}
                  onClick={() => setTeacherSub(s.key)}
                  className={`py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
                    teacherSub === s.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/70 text-indigo-700 hover:bg-indigo-50 border border-indigo-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div>
              {teacherSub === 'manage'    && canManageEvents && <EventManageList />}
              {teacherSub === 'create'    && canManageEvents && <EventCreator />}
              {teacherSub === 'locations' && canManageEvents && <LocationManagement />}
              {teacherSub === 'members'   && canSeeMembers   && <MemberStatus />}
              {teacherSub === 'policy'    && canAdminPolicy  && <PolicyEditor />}
            </div>
          </div>
        )}

        {activeTab === 'admin' && canManageUsers && <AdminPanel />}
      </main>
    </div>
  )
}