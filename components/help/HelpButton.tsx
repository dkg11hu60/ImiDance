'use client'

import { useState, useEffect } from 'react'
import { initConsoleTracker } from '@/lib/consoleTracker'
import { HelpReportModal } from './HelpReportModal'

export function HelpButton() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Start tracking console logs as early as possible
    initConsoleTracker()

    function handleOpenEvent() {
      setIsOpen(true)
    }

    window.addEventListener('open-help-modal', handleOpenEvent)
    return () => window.removeEventListener('open-help-modal', handleOpenEvent)
  }, [])

  return (
    <>
      {/* Floating help button at bottom-left so it doesn't collide with bottom-right action buttons */}
      <aside aria-label="Segítségkérés és hibabejelentés" className="fixed bottom-4 left-4 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-600/95 hover:bg-indigo-700 text-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-200 border border-indigo-400/40 text-xs sm:text-sm font-bold tracking-wide active:scale-95 cursor-pointer backdrop-blur-md group"
          title="Segítség vagy hibabejelentés küldése képernyőfotóval és diagnosztikával"
        >
          <span className="text-base group-hover:scale-110 transition-transform">🆘</span>
          <span className="hidden xs:inline sm:inline">Segítség</span>
        </button>
      </aside>

      <HelpReportModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}

export function openHelpModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-help-modal'))
  }
}
