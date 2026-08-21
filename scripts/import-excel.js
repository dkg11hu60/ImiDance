const reader = require('xlsx')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Hiányzó Supabase környezeti változók!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function importExcelData(filePath) {
  // 1. Excel fájl beolvasása
  const file = reader.readFile(filePath)
  const sheetName = file.SheetNames[0]
  const sheet = file.Sheets[sheetName]
  const data = reader.utils.sheet_to_json(sheet, { header: 1 })

  if (data.length < 2) {
    console.log('Az Excel fájl üres vagy nem megfelelő formátumú.')
    return
  }

  // A fejléc tartalmazza az események dátumait/azonosítóit (pl. A1=Név, B1=2026-08-29, C1=2026-09-05...)
  const headerRow = data[0]
  const eventColumns = []

  // Meglévő események lekérése az adatbázisból
  const { data: dbEvents, error: eventsErr } = await supabase.from('events').select('id, event_date')
  if (eventsErr) {
    console.error('Események lekérési hiba:', eventsErr)
    return
  }

  // Oszlopok feltérképezése eseményekhez
  for (let colIdx = 1; colIdx < headerRow.length; colIdx++) {
    const colHeader = String(headerRow[colIdx] || '').trim()
    if (!colHeader) continue

    // Megkeressük a dátum alapján a hozzá tartozó eseményt az adatbázisban
    const matchingEvent = dbEvents.find(e => String(e.event_date).startsWith(colHeader))
    if (matchingEvent) {
      eventColumns.push({ colIndex: colIdx, eventId: matchingEvent.id, dateStr: colHeader })
    }
  }

  console.log(`Talált esemény oszlopok: ${eventColumns.length}`)

  // 2. Felhasználók és jelentkezések feldolgozása sorról sorra
  const { data: dbProfiles } = await supabase.from('profiles').select('id, full_name, email')

  for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx]
    const name = String(row[0] || '').trim()
    if (!name) continue

    // Profil megkeresése név alapján
    const profile = dbProfiles ? dbProfiles.find(p => p.full_name && p.full_name.trim().toLowerCase() === name.toLowerCase()) : null

    if (!profile) {
      console.warn(`Nem található profil a következő névhez: "${name}" (sor: ${rowIdx + 1})`)
      continue
    }

    // Végigmegyünk az esemény oszlopokon, és ahol 'X' van, beszúrjuk a jelentkezést
    for (const evCol of eventColumns) {
      const cellValue = String(row[evCol.colIndex] || '').trim().toUpperCase()

      if (cellValue === 'X') {
        const { error: attErr } = await supabase.from('attendances').upsert({
          event_id: evCol.eventId,
          profile_id: profile.id,
          attending: true
        }, { onConflict: 'event_id,profile_id' })

        if (attErr) {
          console.error(`Hiba a jelentkezés rögzítésekor (${name} - ${evCol.dateStr}):`, attErr.message)
        } else {
          console.log(`Sikeres jelentkezés: ${name} -> ${evCol.dateStr}`)
        }
      }
    }
  }

  console.log('Az Excel adatok importálása befejeződött!')
}

// Futtatás: node scripts/import-excel.js adatbazis.xlsx
const excelFilePath = process.argv[2] || 'adatbazis.xlsx'
importExcelData(excelFilePath)