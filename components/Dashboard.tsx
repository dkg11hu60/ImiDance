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
import { PrivacyGate } from '@/components/policy/PrivacyGate'
import { PolicyEditor } from '@/components/policy/PolicyEditor'
import { EventAttendanceManager } from '@/components/teacher/EventAttendanceManager'
import { openHelpModal } from '@/components/help/HelpButton'

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
  const [privacyOk, setPrivacyOk] = useState(false)

  // Real authenticated user state (never lost during impersonation)
  const [realUser, setRealUser] = useState<any>(null)
  const [realProfile, setRealProfile] = useState<any>(null)
  const [realCanManageUsers, setRealCanManageUsers] = useState(false)

  // Impersonation state
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null)
  const [impersonatedProfile, setImpersonatedProfile] = useState<any>(null)

  async function loadUserData(targetUserId?: string | null) {
    setLoading(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      setUser(null)
      setRealUser(null)
      setLoading(false)
      return
    }

    setRealUser(authUser)

    // Load real profile and real permissions to verify admin privileges
    const { data: realProf } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()
    setRealProfile(realProf)

    const realVisible = await loadVisibleObjects(authUser.id)
    const isAdmin = realVisible.has('admin.users')
    setRealCanManageUsers(isAdmin)

    // Determine if impersonation is active
    let activeImpersonateId: string | null = null
    if (isAdmin) {
      if (typeof targetUserId !== 'undefined') {
        activeImpersonateId = targetUserId
      } else {
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          if (urlParams.get('exit_impersonation') || urlParams.get('clear_impersonation')) {
            sessionStorage.removeItem('imidance_impersonated_user_id')
            activeImpersonateId = null
          } else {
            activeImpersonateId = sessionStorage.getItem('imidance_impersonated_user_id')
          }
        }
      }
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('imidance_impersonated_user_id')
      }
      activeImpersonateId = null
    }

    setImpersonatedUserId(activeImpersonateId)
    const effectiveId = activeImpersonateId || authUser.id

    if (activeImpersonateId) {
      const { data: impProf } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', activeImpersonateId)
        .single()
      setImpersonatedProfile(impProf)
    } else {
      setImpersonatedProfile(null)
    }

    // Load profile for effective user
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', effectiveId)
      .single()

    setProfile(profileData)

    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('role_key')
      .eq('user_id', effectiveId)

    let roleKeys = userRolesData?.map(r => r.role_key) || []

    if (roleKeys.length === 0 && profileData?.role) {
      roleKeys = [profileData.role]
      // Auto-heal: add missing user_role entry
      supabase.from('user_roles').insert([{ user_id: effectiveId, role_key: profileData.role }]).then()
    } else if (roleKeys.length === 0) {
      roleKeys = ['user']
      supabase.from('user_roles').insert([{ user_id: effectiveId, role_key: 'user' }]).then()
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
    } else {
      setRoleLabels([])
    }

    const visibleSet = await loadVisibleObjects(effectiveId)
    setVisible(visibleSet)

    // Reset policy and privacy gates so they re-evaluate for the effective user
    setPolicyOk(false)
    setPrivacyOk(false)

    setUser({ ...authUser, id: effectiveId })
    setLoading(false)
  }

  useEffect(() => {
    loadUserData()
  }, [])

  const handleStartImpersonation = (targetId: string) => {
    if (!realCanManageUsers) return
    sessionStorage.setItem('imidance_impersonated_user_id', targetId)
    setActiveTab('events')
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    loadUserData(targetId)
  }

  const handleStopImpersonation = () => {
    sessionStorage.removeItem('imidance_impersonated_user_id')
    setImpersonatedUserId(null)
    setImpersonatedProfile(null)
    setActiveTab('admin')
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    loadUserData(null)
  }

  // Keyboard shortcut listener for foolproof emergency exit: Escape or Ctrl+Alt+A
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (impersonatedUserId && (e.key === 'Escape' || (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a'))) {
        handleStopImpersonation()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [impersonatedUserId, realCanManageUsers])

  const handleLogout = async () => {
    sessionStorage.removeItem('imidance_impersonated_user_id')
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
    <div className={`min-h-screen bg-transparent text-zinc-900 ${impersonatedUserId ? 'pt-12 sm:pt-11' : ''}`}>
      {/* Impersonation Banner: Fixed at the very top with maximum z-index (z-[100000]) so modals never block it */}
      {impersonatedUserId && (
        <aside 
          aria-label="Megszemélyesítés figyelmeztetés"
          className="fixed top-0 left-0 right-0 z-[100000] bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-zinc-950 px-3 sm:px-4 py-2 sm:py-2.5 shadow-2xl border-b-2 border-amber-600 flex items-center justify-between gap-2 sm:gap-3 text-xs sm:text-sm animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
            </span>
            <span className="font-extrabold uppercase tracking-wide text-[11px] bg-black text-amber-400 px-2 py-0.5 rounded shadow-sm shrink-0">
              Megszemélyesítés aktív
            </span>
            <span className="truncate">
              Nézet:{' '}
              <strong className="text-black font-bold">
                {impersonatedProfile?.name || impersonatedProfile?.full_name || 'Kiválasztott tag'}
              </strong>{' '}
              <span className="text-zinc-800 hidden md:inline">
                ({impersonatedProfile?.email || impersonatedProfile?.dance_level || 'profil'})
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleStopImpersonation}
              className="bg-black hover:bg-zinc-900 active:scale-95 text-white font-bold px-3 sm:px-4 py-1.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer ring-2 ring-white/60 hover:ring-white"
              title="Kilépés és azonnali visszatérés a Rendszergazda felületre (billentyű: Escape)"
            >
              <span>✕</span>
              <span>Vissza az Adminba</span>
            </button>
          </div>
        </aside>
      )}

      {/* Floating emergency exit button in the bottom right corner (never hidden by modals or scroll) */}
      {impersonatedUserId && (
        <button
          type="button"
          onClick={handleStopImpersonation}
          className="fixed bottom-4 right-4 z-[100000] bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-2.5 px-3.5 rounded-2xl shadow-2xl text-xs flex items-center gap-2 cursor-pointer border-2 border-white ring-4 ring-red-600/30"
          title="Visszatérés Rendszergazda módba (vagy nyomj Escape gombot)"
        >
          <span className="text-base">🛡️</span>
          <span>Kilépés (Vissza Adminba)</span>
        </button>
      )}

      {user && !policyOk && (
        <PolicyGate userId={user.id} onAccepted={() => setPolicyOk(true)} />
      )}
      {user && policyOk && !privacyOk && (
        <PrivacyGate userId={user.id} onAccepted={() => setPrivacyOk(true)} />
      )}

      {/* Header */}
      <header className="bg-indigo-600/90 border-b border-indigo-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">ImreDance</h1>
              <span className="text-[10px] text-indigo-200 font-bold tracking-wider hidden sm:block bg-indigo-800/60 px-1.5 py-0.5 rounded-md">v26.9.21</span>
            </div>
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
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              type="button"
              onClick={openHelpModal}
              className="text-xs sm:text-sm font-semibold text-indigo-100 hover:text-white transition-colors px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 cursor-pointer"
              title="Segítség kérése vagy hiba bejelentése a fejlesztőnek"
            >
              <span>🆘</span>
              <span className="hidden xs:inline sm:inline">Segítség</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm font-medium text-indigo-100 hover:text-white transition-colors px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-indigo-700"
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

        {activeTab === 'admin' && canManageUsers && <AdminPanel onImpersonate={handleStartImpersonation} />}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-zinc-400 border-t border-zinc-200/40 mt-8">
        <p>ImiDance v26.9.21</p>
      </footer>
    </div>
  )
}