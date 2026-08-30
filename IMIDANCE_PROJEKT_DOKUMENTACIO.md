# ImiDance Alkalmazás – Projekt Dokumentáció

> **Verzió: v003 (2026-08-30).** A §3 séma az élő adatbázishoz igazítva; új fejezetek: §9 pár- és jelentkezés-automatizmus, §10 statisztika-szemantika, §11 egyszeri migrációk, §12 nyitott pontok, §13 változásnapló. Részletek: §13. (v003 frissítések: időformátum, múlt/jövő szűrési bontás statisztikákban, szerepkör-szűrés, 0/0 division javítás és esemény modal bővítés).

## 1. A projekt áttekintése

Az **ImiDance** egy modern, webes alapú tánciskola-kezelő és adminisztrációs rendszer, amely támogatja a táncórák szervezését, az előzetes online regisztrációkat, az oktatói beléptetést, a valós idejű jelenléti ívek vezetését, valamint a befizetések és statisztikák követését.

## 2. Technológiai stack

- **Frontend & Keretrendszer:** Next.js (App Router), React, TypeScript
- **Stílusok & UI:** Tailwind CSS
- **Adatbázis & Backend / Auth:** Supabase (PostgreSQL, Row Level Security, Auth)
- **Hosztolás & Deploy:** Vercel

## 3. Adatbázis struktúra (Supabase / PostgreSQL)

> A §3 az élő sémát tükrözi. A `[verified]` jelölésű mezők/megszorítások `information_schema` introspekcióból vagy az RPC-k/triggerek tényleges használatából igazoltak; a `[doc]` jelölésűek a korábbi dokumentációból származnak, külön nem ellenőrizve.

### 3.1. profiles (Felhasználói / Táncos profilok)

Kiegészíti a Supabase Auth beépített felhasználói adatait.

- `id` (uuid, PK, hivatkozik az auth.users táblára) `[verified]`
- `full_name` (text) – A táncos teljes neve `[verified]`
- `name` (text) – Alternatív névmező (fallback a `full_name`-hez) `[verified]`
- `email` (text) – Elérhetőség `[verified]`
- `gender` (text) – Nem (a statisztika Fiú/Lány bontásához; tényleges értékek pl. `Fiú`, `Lány`) `[verified]`
- `dance_level` (text) – Táncos szint. **Tényleges értékkészlet:** `Hobbi`, `Haladó`, `SzuperH`, `ExtraH` `[verified]`
- `partner_id` (uuid, FK -> profiles.id) – Pár azonosítója, **kölcsönös** (lásd §9) `[verified]`
- `updated_at` (timestamptz) – Utolsó módosítás (a partner-trigger írja) `[verified]`
- `created_at` (timestamp) `[verified]`
- `is_admin` (boolean) – Rendszergazda / oktató jogosultság jelzője `[doc]`
- `is_checker` (boolean) – Beléptető jogosultság `[doc]`

**Megjegyzés:** ajánlott egy `CHECK (partner_id <> id)` megszorítás az önlink kizárására (még nincs — §12).

### 3.2. events (Táncórák és események)

- `id` (uuid, PK) `[verified]`
- `title` (text) – Esemény címe / típusa `[verified]`
- `event_date` (**timestamptz** a jelenlegi adatban) – Az esemény napja. A dokumentáció korábban `date`-et írt; az introspekció-minta `2026-08-29 16:00:00+00` alakú, ezért a lekérdezések `::DATE`-re vágnak. `[verified]`
- `start_time` (time) – Kezdési időpont (pl. `16:00:00`) `[verified]`
- `location_id` (uuid, FK) – Helyszín azonosítója `[doc]`
- `is_active` (boolean) – Az esemény aktív-e `[doc]`
- `created_at` (timestamp) `[doc]`

### 3.3. attendances (Regisztrációk, jelenlét és fizetés)

> **Korrigálva.** A korábbi dokumentáció `registered` boolean oszlopot írt le — ez **nem létezik** az élő táblában. A jelentkezés tényét a sor **létezése** + a `status` érték kódolja. Az alábbi lista `information_schema`-ból igazolt.

- `id` (uuid, PK, default `gen_random_uuid()`) `[verified]`
- `profile_id` (uuid, nullable, FK -> profiles.id, `ON DELETE CASCADE`) `[verified]`
- `event_id` (uuid, nullable, FK -> events.id) `[verified]`
- `event_name` (text, **NOT NULL**, nincs default) – Denormalizált esemény-név `[verified]`
- `status` (text, nullable) – **Jelentkezési** állapot: `registered` / `cancelled`. Korábban legacy `X` (§11). NEM a megjelenést jelöli. `[verified]`
- `attended` (boolean, default `false`) – Részt vett-e (jelenlét), egyéni `[verified]`
- `paid` (boolean, default `false`) – Befizette-e a díjat, egyéni `[verified]`
- `created_at` (timestamptz, default `now()`) `[verified]`

**Megszorítások** `[verified]`:

- `attendances_pkey` PRIMARY KEY (`id`)
- `attendances_profile_event_unique` UNIQUE (`profile_id`, `event_id`) — egy ember egy eseményre egy sor
- `attendances_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES events(id)
- `attendances_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES profiles(id) ON DELETE CASCADE

### 3.4. locations (Helyszínek)

- `id` (uuid, PK) `[doc]`
- `name` (text) `[doc]`
- `address` (text) `[doc]`

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

A Supabase Backend-as-a-Service infrastruktúrát használja a rendszer adatbázis triggerekkel és Row Level Security (RLS) házirendekkel az adatszintű védelemért. A statisztikai nézet a felhasználói RLS-szűrést az `get_global_statistics_data` `SECURITY DEFINER` RPC-vel kerüli meg; a résztvevő-lista az `get_event_attendees` RPC-n keresztül jön (§9.4).

## 6. Jogosultságkezelés és Útvonalvédelem

Három fő szint létezik: **Diák/Táncos**, **Beléptető**, valamint **Oktató/Adminisztrátor**. A Next.js Middleware automatikusan ellenőrzi a jogosultságokat minden kérésnél. A statisztikai fülek láthatóságát az `app_objects` kulcsok vezérlik (`stats.all`, `stats.detailed`), a `get_my_allowed_objects` RPC-n keresztül.

---

## 7. Adatbázis-séma introspekció (Metadata lekérdezés)

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

> A tényleges triggerek nem itt, hanem a §9-ben vannak dokumentálva.

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

---

## 9. Pár- (partner-) kezelés és jelentkezés-automatizmus

### 9.1. Modell

A pár két **önálló** profil, amelyeket a `profiles.partner_id` köt össze **kölcsönösen** (A→B és B→A). Szabályok:

- **Jelentkezés és lemondás közös:** a pár együtt mozog — az egyik tag jelentkezése/lemondása a másikra is átterjed, a szétválásig, az állapot „as is” (`registered` → `registered`, `cancelled` → `cancelled`).
- **Megjelenés és fizetés egyéni:** az `attended` és a `paid` személyenként dől el, a párosság ezekre **nem** hat. (Valaki jelentkezik és nem jön el, vagy eljön és nem fizet — ez nem páros dolog.)
- **Szétválás kölcsönös és azonnali:** bármelyik fél elég hozzá, a másik egyetértése nem kell, és a `partner_id` mindkét oldalon azonnal megszűnik.
- **A meglévő jelentkezések szétváláskor „as is” maradnak** — utólag nem tudjuk (és nem is akarjuk) rekonstruálni, hogy közös döntés volt-e. Onnantól ki-ki önálló jelentkező.
- **A jelentkezés felülírható állapot, nincs történet/audit** — ingyenes, nincs jogi kötőereje, csak tervezésre kell. (A **fizetés** viszont audit trailt igényel majd — §12.)
- Törlés operációsan tilos; a lemondás státuszváltás (`cancelled`), nem sortörlés. Szemetet csak dedikált admin-funkció takaríthat.

### 9.2. Trigger: `sync_partner_relationship` (profiles) — a kölcsönösség karbantartása

`AFTER UPDATE ON profiles`. A `partner_id` kölcsönösségét tartja: párbeállításkor a másik oldalt is beállítja, szétváláskor a másik oldalt is nullázza.

**Állapot: v002 JAVASOLT, élesítés függőben.** A v001 három hibája: (1) rekurzió-lánc (a trigger `profiles`-t ír, ami újra triggerel); (2) ütközés — ha az új partnernek volt korábbi, eltérő párja, az elárvult féllinkként bennragad; (3) nincs önlink-védelem. A v002 mindezt kezeli (lánctörő „csak ha tényleg változik” feltételekkel):

```sql
-- v002 — kölcsönösség: rekurzió-lánctörő, teljes ütközés-feloldás.
CREATE OR REPLACE FUNCTION public.sync_partner_relationship()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- SZÉTVÁLÁS: A elengedte a párját
    IF NEW.partner_id IS NULL AND OLD.partner_id IS NOT NULL THEN
        UPDATE profiles
        SET partner_id = NULL, updated_at = NOW()
        WHERE id = OLD.partner_id
          AND partner_id = NEW.id
          AND partner_id IS DISTINCT FROM NULL;

    -- ÚJ vagy MEGVÁLTOZOTT partner
    ELSIF NEW.partner_id IS NOT NULL AND (OLD.partner_id IS DISTINCT FROM NEW.partner_id) THEN
        -- (a) a korábbi partnerünket elengedjük, ha ránk mutatott
        IF OLD.partner_id IS NOT NULL THEN
            UPDATE profiles
            SET partner_id = NULL, updated_at = NOW()
            WHERE id = OLD.partner_id
              AND partner_id = NEW.id
              AND partner_id IS DISTINCT FROM NULL;
        END IF;

        -- (b) az ÚJ partner esetleges korábbi kapcsolatát feloldjuk (ütközés-feloldás)
        UPDATE profiles
        SET partner_id = NULL, updated_at = NOW()
        WHERE id = NEW.partner_id
          AND partner_id IS NOT NULL
          AND partner_id IS DISTINCT FROM NEW.id;

        -- (c) kölcsönösség beállítása — csak ha még nem az van (lánctörő)
        UPDATE profiles
        SET partner_id = NEW.id, updated_at = NOW()
        WHERE id = NEW.partner_id
          AND partner_id IS DISTINCT FROM NEW.id;
    END IF;

    RETURN NEW;
END;
$function$;
```

Önlink-védelem külön, megszorítással (ajánlott, még nincs):

```sql
ALTER TABLE profiles ADD CONSTRAINT profiles_no_self_partner CHECK (partner_id <> id);
```

### 9.3. Trigger: `attendance_pair_sync` (attendances) — jelentkezés-propagálás

`AFTER INSERT OR UPDATE OF status ON attendances`. A jelentkezés `status`-át „as is” átviszi a **kölcsönös** párra, **csak jövőbeli** eseményre. Lánctörő: csak akkor ír, ha a pár státusza tényleg eltér.

**Állapot: v001 JAVASOLT, élesítés + teszt függőben.**

```sql
CREATE OR REPLACE FUNCTION public.sync_attendance_to_partner()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_partner_id uuid;
    v_future     boolean;
BEGIN
    -- csak KÖLCSÖNÖS pár számít
    SELECT q.id INTO v_partner_id
    FROM profiles p
    JOIN profiles q ON q.id = p.partner_id AND q.partner_id = p.id
    WHERE p.id = NEW.profile_id;

    IF v_partner_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- csak jövőbeli esemény
    SELECT (e.event_date >= current_date) INTO v_future
    FROM events e WHERE e.id = NEW.event_id;

    IF v_future IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    -- "as is" propagálás; UPSERT lánctörővel
    INSERT INTO attendances (profile_id, event_id, event_name, status)
    SELECT v_partner_id, NEW.event_id, NEW.event_name, NEW.status
    ON CONFLICT (profile_id, event_id) DO UPDATE
        SET status = EXCLUDED.status
        WHERE attendances.status IS DISTINCT FROM EXCLUDED.status;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_attendance ON attendances;
CREATE TRIGGER trg_sync_attendance
    AFTER INSERT OR UPDATE OF status ON attendances
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_attendance_to_partner();
```

Tervezési döntések: csak `status`-ra indul (nem minden UPDATE-re) — így az `attended`/`paid` pipálása nem vet pár-szinkront. A szétválás magától lekezelődik: ha már nincs kölcsönös link, `v_partner_id` NULL, nincs propagálás.

### 9.4. RPC: `get_event_attendees` — időpont-egyezés javítás

`SECURITY DEFINER`, a modal résztvevő-listáját adja (`nev`, `nem`, `par_neve`, `tudasszint`). **Állapot: v002 ÉLES.** A hiba: `e.start_time::TEXT = p_idopont` a `'16:00:00' = '16:00'` miatt sosem egyezett → üres lista. Javítás:

```sql
-- a WHERE utolsó sora:
AND to_char(e.start_time, 'HH24:MI') = p_idopont;
```

## 10. Statisztika-szemantika (`useStatisticsData`, v007)

A hook három nézetet számol az `get_global_statistics_data` nyers adataiból.

**Táncesemények Összesítő (nemenkénti + szint-bontás).** Identitás:

```
F* + L* + 2·P = Össz
```

ahol `P` = a **kölcsönös, jelenlévő** párok száma (nem `min(F, L)`), `F* = F − P`, `L* = L − P`. A `Fiú`/`Lány` oszlop mostantól a **szóló** (pár nélküli) létszám. A `P` a `partner_id` kölcsönösségéből számol; a `par_neve` fallback **tilos** (azonos nemű / hiányzó téves párokat gyártott).

**Szint-leképezés (explicit, a valós `dance_level` értékekre):**

```
Hobbi  -> Hobbi
Haladó -> H
SzuperH-> Sz
ExtraH -> Ex
```

A korábbi mohó `level.includes('h')` mindent a H oszlopba vitt (mind a négy érték tartalmaz `h`-t), ezért volt H = Össz és a többi 0.

**Megjelenés = `attended` (bool). Fizetés = `paid` (bool).** A `status` a **jelentkezést** kódolja, nem a megjelenést. A halott `status === 'present'` és `payment_status === 'paid'` ágak megszűntek. A `cancelled` jelentkezés kimarad a jelentkező-nevezőből (`megjelenesi_arany` számításánál).

**Állapot: v007 kész, deploy függőben.**

## 11. Egyszeri adatmigrációk

**Elvégezve (COMMIT):**

- `status` legacy `'X'` → `'registered'` (113 sor).
- `get_event_attendees` időformátum-javítás (§9.4).
- Jövőbeli pár-szinkron: a kölcsönös párok hiányzó tagjának `registered` jelentkezése a jövőbeli eseményekre (+12 sor; összes attendances 113 → 125). Az `attended`/`paid` érintetlen (default `false`).

**Ellenőrizendő / függőben:**

- `partner_id` orphan-visszakötés (elárvult féllinkek). A gráf-diagnózis szerint nincs önlink, törött link, A→B→C lánc vagy ≥3 kör — csak kölcsönös párok és egyszerű orphanök. A visszakötés COMMIT-je nem igazolt.
- `sync_partner_relationship` v002 élesítése (§9.2).
- `attendance_pair_sync` trigger élesítése + teszt (§9.3).
- `useStatisticsData` v007 deploy (§10).

## 12. Ismert adatminőségi problémák és nyitott pontok

- **`gender` szennyezett:** legalább egy férfi `Lány`-ként rögzítve (pl. „Szabó Tamás”) — a statisztika Fiú/Lány bontását rontja. DB-javítás kell.
- **`gender`-besorolás a kódban mohó** (`includes('f')`) — `female`/`nő` fiúnak számítana. Explicit leképezésre cserélendő, ahogy a `dance_level`-nél.
- **`event_date` típusa `timestamptz`**, miközben a korábbi doc `date`-et mondott; a lekérdezések `::DATE`-re vágnak.
- **Navbar felirat:** „Saját részvételeim” → „Részvétel” átnevezés a `components/layout/Navbar.tsx`-ben **még nincs elvégezve** (az eredeti kérés innen indult; a fájl nem volt feltöltve).
- **`CHECK (partner_id <> id)`** megszorítás még nincs.
- **Fizetési audit trail:** jövőbeli követelmény (számlázás). A jelentkezés nem igényel naplót, a fizetés viszont igen — külön megtervezendő; jelenleg a séma nem tartja a fizetés-történetet.

## 13. Változásnapló

**Doc v003 (2026-08-30):**

- **Időformátum korrekció:** Az `EventList.tsx` felületen a táncórák időpontjai `HH:MM:SS` helyett immár tisztán `HH:MM` formátumban jelennek meg.
- **Múltbeli vs Jövőbeli szétválasztás a statisztikákban (`useStatisticsData` v008):**
  - A *Jelentkezések fül* (Táncesemények Összesítő) kizárólag a **jövőbeli eseményekre** (`eventEnd > now`) és azok feliratkozásaira vonatkozik.
  - A *Részvételi statisztikák soraiban* (Esemény és Személy szerinti bontások) kizárólag a **múltbeli események** (`eventEnd <= now`) és azok részvételi adatai szerepelnek.
- **Biztonságos matematikai arányok (0/0 division javítása):** Ha egy felhasználó még nem regisztrált vagy nem jelent meg múltbeli órán (0 nevező), a megjelenési és fizetési arányok helyesen `"—"` (Nincs adat) formátumban jelennek meg a korábbi félrevezető `0%` és `100%` helyett.
- **Szerepkör alapú szűrés a statisztikákban:** A statisztikákba csak a `'user'` és `'admin'` szerepkörrel rendelkező profilok számítanak bele; a tiszta tanárok/beléptetők (`'teacher'`) ki vannak szűrve.
- **Esemény részletező modal bővítése:** A jelentkezők listájánál megjelent a **Jelentkezett?**, **Megjelent?** és **Fizetett?** státusz is, látványos zöld/piros Igen/Nem jelvényekkel, kibővített `max-w-4xl` szélességű modalban.
- **Névkonzisztencia korrekció:** Dauphin Berta profil rekordja frissítve lett a valós nevére az adatbázisban, elhárítva az aktivitási listán jelentkező hibás fallback név megjelenést.

**Doc v002 (2026-08-28):**

- §3 séma korrigálva az élő adatbázishoz: `attendances` (`registered` boolean törölve → `status` + `event_name`), `profiles` (`partner_id`, `gender`, `name`, `updated_at` felvéve), `dance_level` valós értékek, `event_date` típus.
- Új fejezetek: §9 (pár- és jelentkezés-automatizmus + triggerek), §10 (statisztika-szemantika), §11 (migrációk), §12 (nyitott pontok).

**Kód / DB verziók:**

- `useStatisticsData` — **v008** (szerepkör-szűrés, split múlt/jövő események, 0/0 division javítás `"—"`-ra, raw adatok exponálása a modalnak).
- `get_event_attendees` — **v002** (`to_char(start_time,'HH24:MI')`), ÉLES.
- `sync_partner_relationship` — **v002** (rekurzió-lánctörő, ütközés-feloldás), FÜGGŐBEN.
- `attendance_pair_sync` — **v001** (jelentkezés-propagálás kölcsönös párra), FÜGGŐBEN.
- Adat: `status` `'X'` → `registered`/`cancelled`; jövőbeli pár-szinkron (+12 sor).
