# ImiDance Alkalmazás – Projekt Dokumentáció

## 1. A projekt áttekintése

Az **ImiDance** egy modern, webes alapú tánciskola-kezelő és adminisztrációs rendszer, amely támogatja a táncórák szervezését, az előzetes online regisztrációkat, az oktatói beléptetést, a valós idejű jelenléti ívek vezetését, valamint a befizetések és statisztikák követését.

## 2. Technológiai stack

- **Frontend & Keretrendszer:** Next.js (App Router), React, TypeScript
- **Stílusok & UI:** Tailwind CSS
- **Adatbázis & Backend / Auth:** Supabase (PostgreSQL, Row Level Security, Auth)
- **Hosztolás & Deploy:** Vercel

## 3. Adatbázis struktúra (Supabase / PostgreSQL)

A rendszer az alábbi főbb táblákra épül:

### 3.1. profiles (Felhasználói / Táncos profilok)

Kiegészíti a Supabase Auth beépített felhasználói adatait.

- `id` (uuid, PK, hivatkozik az auth.users táblára)
- `full_name` (text) – A táncos teljes neve
- `email` (text) – Elérhetőség
- `dance_level` (text) – Táncos szint / csoport (pl. Kezdő, Haladó)
- `is_admin` (boolean) – Rendszergazda / oktató jogosultság jelzője
- `is_checker` (boolean) – Beléptető jogosultság
- `created_at` (timestamp)

### 3.2. events (Táncórák és események)

- `id` (uuid, PK)
- `title` (text) – Esemény címe / típusa
- `event_date` (date) – Az esemény napja
- `start_time` (time) – Kezdési időpont
- `location_id` (uuid, FK) – Helyszín azonosítója
- `is_active` (boolean) – Az esemény aktív-e
- `created_at` (timestamp)

### 3.3. attendances (Regisztrációk, jelenlét és fizetés)

- `id` (uuid, PK)
- `profile_id` (uuid, FK -> profiles.id)
- `event_id` (uuid, FK -> events.id)
- `registered` (boolean) – Előzetesen regisztrált-e
- `attended` (boolean) – Részt vett-e (jelenlét)
- `paid` (boolean) – Befizette-e a díjat
- `created_at` (timestamp)

### 3.4. locations (Helyszínek)

- `id` (uuid, PK)
- `name` (text)
- `address` (text)

## 4. Fájlstruktúra (Projekt Főkönyvtár)

```text
├── app/                              # Next.js App Router útvonalak
│   ├── adminisztracio/               # Adminisztrációs felületek
│   ├── auth/                         # Bejelentkezés / regisztráció
│   ├── beleptetes/                   # Dedikált beléptető nézet (EventAttendanceManager)
│   ├── oktatoi-felulet/              # Oktatói kezelő nézetek
│   ├── profil/                       # Felhasználói profil és előzmények
│   ├── tancorak/                     # Órarend és események böngészése
│   ├── layout.tsx                    # Globális layout (itt hívódik meg a Navbar)
│   └── page.tsx                      # Kezdőoldal
├── components/                       # Újrahasznosítható React komponensek
│   ├── layout/
│   │   └── Navbar.tsx                # Dinamikus menürendszer (szerepkör alapú)
│   ├── teacher/                      
│   │   └── EventAttendanceManager.tsx# Beléptető, jelenlét & fizetés rögzítő
│   └── profile/                      
│       └── DancerAttendanceSummary.tsx 
├── lib/                              
│   └── supabase.js                   # Supabase kliens inicializálás
├── middleware.ts                     # Útvonalvédelem és jogosultság-ellenőrzés
├── package.json                      
└── tailwind.config.js                
```

## 5. Backend Architektúra & Biztonság

A Supabase Backend-as-a-Service infrastruktúrát használja a rendszer adatbázis triggerekkel és Row Level Security (RLS) házirendekkel az adatszintű védelemért.

## 6. Jogosultságkezelés és Útvonalvédelem

Három fő szint létezik: **Diák/Táncos**, **Beléptető**, valamint **Oktató/Adminisztrátor**. A Next.js Middleware automatikusan ellenőrzi a jogosultságokat minden kérésnél.

---

## 7. Teljes Adatbázis Séma & Trigger (SQL)

```sql
-- =====================================================================
-- ImiDance Alkalmazás - Adatbázis Szerkezet Lekérdező (Metadata)
-- =====================================================================

SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default
FROM 
    information_schema.tables t
JOIN 
    information_schema.columns c ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
WHERE 
    t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY 
    t.table_name, 
    c.ordinal_position;
```

---

## 8. Projekt Generáló Szkript (PowerShell)

```powershell
# =====================================================================
# ImiDance - Projekt Mappastruktúra és Fájlok Létrehozó Script (PowerShell)
# =====================================================================

Write-Host "ImiDance projekt struktúra generálása indul..." -ForegroundColor Cyan

# Mappák létrehozása
$directories = @(
    "app/adminisztracio",
    "app/auth",
    "app/beleptetes",
    "app/oktatoi-felulet",
    "app/profil",
    "app/tancorak",
    "components/layout",
    "components/teacher",
    "components/profile",
    "lib"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-Host "Létrehozva mappa: $dir" -ForegroundColor Green
    }
}

# Üres vagy alapértelmezett fájlok létrehozása, ha még nem léteznek
$files = @(
    "app/layout.tsx",
    "app/page.tsx",
    "components/layout/Navbar.tsx",
    "components/teacher/EventAttendanceManager.tsx",
    "components/profile/DancerAttendanceSummary.tsx",
    "lib/supabase.js",
    "middleware.ts",
    "tailwind.config.js"
)

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        New-Item -ItemType File -Path $file | Out-Null
        Write-Host ("File " + $file + " has been generated successfully!") -ForegroundColor Green
    }
}

Write-Host "Minden mappa és fájl sikeresen létrejött!" -ForegroundColor Cyan
```
