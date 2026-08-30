'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { loadVisibleObjects } from '@/lib/permissions'
import { EventList } from '@/components/events/EventList'
import { ProfileEdit } from '@/components/profile/ProfileEdit'
import { MyAttendance } from '@/components/profile/MyAttendance'
import StatisticDashboard from '@/components/profile/statistics/StatisticsDashboard'
import { EventCreator } from '@/components/teacher/EventCreator'
import { EventManageList } from '@/components/teacher/EventManageList'
import { LocationManagement } from '@/components/teacher/LocationManagement'
import { AdminPanel } from '@/components/admin/AdminPanel'
import { MemberStatus } from '@/components/admin/MemberStatus'
import { PolicyGate } from '@/components/policy/PolicyGate'
import { PolicyEditor } from '@/components/policy/PolicyEditor'
import { EventAttendanceManager } from '@/components/teacher/EventAttendanceManager'

type TopTab = 'events' | 'attendance' | 'myattendance' | 'statistics' | 'profile' | 'teacher' | 'admin'
type TeacherSubTab = 'manage' | 'create' | 'locations' | 'members' | 'policy'

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TopTab>('events')
  const [teacherSub, setTeacherSub] = useState<TeacherSubTab>('manage')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [roleLabels, setRoleLabels] = useState<string[]>([])
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

        const { data: userRolesData } = await supabase
          .from('user_roles')
          .select('role_key')
          .eq('user_id', user.id)

        let roleKeys = userRolesData?.map(r => r.role_key) || []

        if (roleKeys.length === 0 && profileData?.role) {
          roleKeys = [profileData.role]
        }

        if (roleKeys.length > 0) {
          const { data: rolesMeta } = await supabase
            .from('roles')
            .select('key, label, name')
            .in('key', roleKeys)

          if (rolesMeta && rolesMeta.length > 0) {
            setRoleLabels(rolesMeta.map(r => r.label || r.name || r.key))
          } else {
            setRoleLabels(roleKeys)
          }
        }

        const visibleSet = await loadVisibleObjects(user.id)
        setVisible(visibleSet)
      }
      setLoading(false)
    }

    loadUserData()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  const canManageEvents = visible.has('event.create')
  const canSeeMembers   = visible.has('members.status')
  const canAdminPolicy  = visible.has('policy.admin')
  const canManageUsers  = visible.has('admin.users')
  const canSeeAllStats  = visible.has('stats.all')

  const canSeeTeacher = canManageEvents || canSeeMembers || canAdminPolicy

  const teacherSubs: { key: TeacherSubTab; label: string; show: boolean }[] = [
    { key: 'manage',    label: 'Alkalmak kezelése', show: canManageEvents },
    { key: 'create',    label: 'Új alkalom',        show: canManageEvents },
    { key: 'locations', label: 'Helyszínek',        show: canManageEvents },
    { key: 'members',   label: 'Tagok aktivitása',  show: canSeeMembers },
    { key: 'policy',    label: 'Házirend',          show: canAdminPolicy },
  ]
  const visibleTeacherSubs = teacherSubs.filter(s => s.show)

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

  const getTabStyle = (key: TopTab, isActive: boolean) => {
    if (key === 'attendance') {
      if (isActive) {
        return 'bg-red-700 text-white shadow-lg ring-2 ring-red-600 ring-offset-2 font-bold border border-red-800'
      }
      return 'bg-red-600 text-white hover:bg-red-700 font-bold border border-red-700 shadow-sm'
    }

    if (isActive) {
      return 'bg-zinc-900 text-white shadow-md ring-2 ring-zinc-900 ring-offset-2 font-bold'
    }
    switch (key) {
      case 'events':
        return 'bg-blue-100 text-blue-900 hover:bg-blue-200 border border-blue-300 font-bold shadow-sm'
      case 'myattendance':
        return 'bg-teal-100 text-teal-900 hover:bg-teal-200 border border-teal-300 font-bold shadow-sm'
      case 'statistics':
        return 'bg-cyan-100 text-cyan-900 hover:bg-cyan-200 border border-cyan-300 font-bold shadow-sm'
      case 'profile':
        return 'bg-slate-200 text-slate-900 hover:bg-slate-300 border border-slate-300 font-bold shadow-sm'
      case 'teacher':
        return 'bg-purple-100 text-purple-900 hover:bg-purple-200 border border-purple-300 font-bold shadow-sm'
      case 'admin':
        return 'bg-amber-100 text-amber-950 hover:bg-amber-200 border border-amber-300 font-bold shadow-sm'
      default:
        return 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border border-zinc-300 font-bold shadow-sm'
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-900">
      {user && !policyOk && (
        <PolicyGate userId={user.id} onAccepted={() => setPolicyOk(true)} />
      )}

      {/* Header */}
      <header className="bg-indigo-600/90 border-b border-indigo-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">ImreDance</h1>
            {profile && (
              <div className="flex items-center bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl shadow-sm gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-tight">
                    {profile.full_name || profile.name || user?.email}
                  </span>
                  <span className="text-[10px] text-emerald-100 opacity-90">
                    {user?.email}
                  </span>
                </div>
                {roleLabels.length > 0 && (
                  <div className="flex gap-1 border-l border-emerald-600 pl-3">
                    {roleLabels.map((lbl, idx) => (
                      <span key={idx} className="bg-emerald-900 text-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase">
                        {lbl}
                      </span>
                    ))}
                  </div>
                )}
              </div>
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
              { key: 'events', label: 'Órarend', show: true },
              { key: 'statistics', label: 'Jelentkezés', show: canSeeAllStats },
              { key: 'myattendance', label: 'Részvétel', show: true },
              { key: 'profile', label: 'Profil', show: true },
              { key: 'attendance', label: 'Beléptetés', show: canSeeTeacher },
              { key: 'teacher', label: 'Oktató', show: canSeeTeacher },
              { key: 'admin', label: 'Adminisztráció', show: canManageUsers },
            ]
            const visibleTabs = tabs.filter(t => t.show)
            const activeLabel = visibleTabs.find(t => t.key === activeTab)?.label ?? ''

            return (
              <>
                {/* Desktop */}
                <div className="hidden sm:flex gap-3 py-3">
                  {visibleTabs.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={`py-2.5 px-4 rounded-xl text-sm transition-all whitespace-nowrap ${getTabStyle(
                        t.key,
                        activeTab === t.key
                      )}`}
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
                    <div className="pb-2 mb-2 flex flex-col gap-2 bg-zinc-50 rounded-xl p-2 border border-zinc-200">
                      {visibleTabs.map(t => (
                        <button
                          key={t.key}
                          onClick={() => { setActiveTab(t.key); setMenuOpen(false) }}
                          className={`text-left py-3 px-3 rounded-lg text-sm transition-colors ${getTabStyle(
                            t.key,
                            activeTab === t.key
                          )}`}
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
        {activeTab === 'events' && <EventList userId={user?.id} onNavigateProfile={() => setActiveTab('profile')} />}
        
        {activeTab === 'attendance' && canSeeTeacher && (
          <EventAttendanceManager />
        )}

        {activeTab === 'myattendance' && (
          canSeeAllStats || visible.has('stats.detailed') ? (
            <StatisticDashboard mode="reszvétel" userId={user?.id} />
          ) : (
            <MyAttendance userId={user?.id} />
          )
        )}

        {activeTab === 'statistics' && canSeeAllStats && <StatisticDashboard mode="jelentesek" />}

        {activeTab === 'profile' && <ProfileEdit userId={user?.id} />}

        {activeTab === 'teacher' && canSeeTeacher && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {visibleTeacherSubs.map((s) => (
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