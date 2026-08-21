'use client'

import { useState } from 'react'
import { UserAdmin } from './UserAdmin'
import { RoleAdmin } from './RoleAdmin'
import { EmailTester } from './EmailTester'

export function AdminPanel() {
  const [section, setSection] = useState<'users' | 'roles' | 'email'>('users')

  return (
    <div className="space-y-6">
      <div className="flex gap-2 sticky top-32 bg-zinc-50 py-2 z-10">
        <button
          onClick={() => setSection('users')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            section === 'users'
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Felhasználók
        </button>
        <button
          onClick={() => setSection('roles')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            section === 'roles'
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Szerepek
        </button>
        <button
          onClick={() => setSection('email')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            section === 'email'
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          E-mail teszt
        </button>
      </div>

      {section === 'users' && <UserAdmin />}
      {section === 'roles' && <RoleAdmin />}
      {section === 'email' && <EmailTester />}
    </div>
  )
}