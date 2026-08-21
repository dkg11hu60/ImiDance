import { supabase } from './supabase'

export function getSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  if (longer.length === 0) return 1.0
  return (longer.length - editDistance(longer, shorter)) / longer.length
}

export function editDistance(s1: string, s2: string): number {
  s1 = s1.toLowerCase()
  s2 = s2.toLowerCase()
  const costs = new Array()
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else {
        if (j > 0) {
          let newValue = costs[j - 1]
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
          }
          costs[j - 1] = lastValue
          lastValue = newValue
        }
      }
    }
    if (s1.length > 0) costs[s2.length] = lastValue
  }
  return costs[s2.length]
}

export async function logActivity(profileId: string, action: 'login' | 'logout' | 'attend' | 'cancel', eventId?: string) {
  try {
    await supabase.from('activity_logs').insert({
      profile_id: profileId,
      action: action,
      event_id: eventId || null
    })
  } catch (err) {
    console.error('Naplózási hiba:', err)
  }
}