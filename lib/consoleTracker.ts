// Client-side console and error tracker for diagnostic reports

export interface ConsoleEntry {
  time: string
  level: 'log' | 'info' | 'warn' | 'error'
  messages: string[]
}

const MAX_LOGS = 100
const logBuffer: ConsoleEntry[] = []
let isInitialized = false

export function initConsoleTracker() {
  if (typeof window === 'undefined' || isInitialized) return
  isInitialized = true

  const levels: ('log' | 'info' | 'warn' | 'error')[] = ['log', 'info', 'warn', 'error']

  levels.forEach((level) => {
    const original = console[level]
    console[level] = (...args: any[]) => {
      try {
        const time = new Date().toISOString()
        const serialized = args.map((arg) => {
          if (arg instanceof Error) {
            return `${arg.name}: ${arg.message}\n${arg.stack || ''}`
          }
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2)
            } catch {
              return String(arg)
            }
          }
          return String(arg)
        })

        logBuffer.push({ time, level, messages: serialized })
        if (logBuffer.length > MAX_LOGS) {
          logBuffer.shift()
        }
      } catch {
        // Prevent recursive errors
      }

      original.apply(console, args)
    }
  })

  // Global uncaught errors
  window.addEventListener('error', (event) => {
    const time = new Date().toISOString()
    const msg = event.error instanceof Error
      ? `${event.error.name}: ${event.error.message}\n${event.error.stack || ''}`
      : `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`

    logBuffer.push({ time, level: 'error', messages: [msg] })
    if (logBuffer.length > MAX_LOGS) {
      logBuffer.shift()
    }
  })

  // Global unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const time = new Date().toISOString()
    const reason = event.reason
    const msg = reason instanceof Error
      ? `Unhandled Promise Rejection: ${reason.name}: ${reason.message}\n${reason.stack || ''}`
      : `Unhandled Promise Rejection: ${String(reason)}`

    logBuffer.push({ time, level: 'error', messages: [msg] })
    if (logBuffer.length > MAX_LOGS) {
      logBuffer.shift()
    }
  })
}

export function getCapturedLogs(): ConsoleEntry[] {
  return [...logBuffer]
}

export function formatLogsForReport(): string {
  if (logBuffer.length === 0) {
    return 'Nincsenek rögzített konzol naplóbejegyzések.'
  }

  return logBuffer
    .map((entry) => `[${entry.time}] [${entry.level.toUpperCase()}] ${entry.messages.join(' ')}`)
    .join('\n')
}
