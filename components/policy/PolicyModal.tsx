'type client'

type Section = { key: string; heading: string; body: string }

interface PolicyModalProps {
  isOpen: boolean
  title: string
  version: number
  sections: Section[]
  onAccept: () => void
  accepting?: boolean
  onLogout?: () => void // Új prop a kilépéshez
}

export function PolicyModal({
  isOpen,
  title,
  version,
  sections,
  onAccept,
  accepting = false,
  onLogout,
}: PolicyModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden border border-zinc-200">
        <div className="p-5 border-b border-zinc-200 bg-zinc-50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
            v{version} verzió
          </span>
          <h3
            className="text-lg font-bold text-zinc-900 mt-1 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic"
            dangerouslySetInnerHTML={{ __html: title }}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {sections.map((s, idx) => (
            <div key={s.key || idx} className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div
                className="px-4 py-2 bg-zinc-50 font-bold text-sm text-zinc-900 border-b border-zinc-100 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic"
                dangerouslySetInnerHTML={{ __html: s.heading }}
              />
              <div
                className="px-4 py-3 text-sm text-zinc-700 leading-relaxed whitespace-pre-line [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:my-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:mb-1 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_a]:text-indigo-600 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: s.body }}
              />
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex flex-col sm:flex-row justify-between items-center gap-3">
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="text-sm text-zinc-500 hover:text-zinc-800 underline transition-colors"
            >
              Kilépés a fiókból
            </button>
          ) : <div />}

          <button
            onClick={onAccept}
            disabled={accepting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {accepting ? 'Elfogadás…' : 'Megértettem és elfogadom'}
          </button>
        </div>
      </div>
    </div>
  )
}