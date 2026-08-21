import os
import re
import json
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("Hiba: Hiányoznak a Supabase környezeti változók a .env.local fájlban.")
    exit(1)

url = url.strip().rstrip('/')
if url.endswith('/rest/v1'):
    url = url[:-8].rstrip('/')

supabase: Client = create_client(url, key)

def extract_date(val):
    if val is None or pd.isna(val):
        return None
    val_str = str(val).strip()
    match = re.search(r'(\d{4}-\d{2}-\d{2})', val_str)
    if match:
        return match.group(1)
    return None

def main():
    try:
        supabase.table("profiles").select("*", count="exact").limit(1).execute()
        print("Kapcsolat sikeres a Supabase-el!")
    except Exception as e:
        print(f"Kritikus hiba a kapcsolat tesztelésekor: {e}")
        return

    excel_files = [f for f in os.listdir('.') if f.endswith('.xlsx')]
    if not excel_files:
        print("Nem található Excel fájl a könyvtárban!")
        return
    
    file_path = excel_files[0]
    print(f"Feldolgozás alatt: {file_path}")
    
    df = pd.read_excel(file_path, header=None)
    df = df.where(pd.notnull(df), None)

    # 1. Supabase adatok lekérése
    events_res = supabase.table("events").select("id, event_date, title").execute()
    db_events = events_res.data or []

    profiles_res = supabase.table("profiles").select("id, name, full_name, last_name, first_name").execute()
    db_profiles = profiles_res.data or []

    # 2. Szigorúan az 1. sor (index 0) feldolgozása a dátumokhoz
    excel_event_mapping = {} # { col_index: { "excel_date": ..., "event_id": ..., "event_title": ... } }
    
    if len(df) > 0:
        row_zero = df.iloc[0]
        for c in range(1, len(df.columns)):
            cell_val = row_zero.iloc[c]
            date_str = extract_date(cell_val)
            if date_str:
                matching_event = next((e for e in db_events if str(e.get("event_date", "")).startswith(date_str)), None)
                if matching_event:
                    excel_event_mapping[c] = {
                        "excel_date": date_str,
                        "event_id": matching_event["id"],
                        "event_title": matching_event.get("title")
                    }

    print("\n--- 1. sor alapján párosított események (JSON) ---")
    print(json.dumps(excel_event_mapping, ensure_ascii=False, indent=2))
    print("--------------------------------------------------\n")

    if not excel_event_mapping:
        print("Hiba: Az 1. sorban nem találtunk egyező dátum oszlopokat a DB eseményekkel.")
        return

    def find_profile_id(name_str):
        if not name_str or pd.isna(name_str):
            return None
        cleaned = str(name_str).strip().lower()
        if cleaned in ['none', 'nan', 'nat', '', 'név', 'név email cím']:
            return None

        for p in db_profiles:
            p_name = str(p.get("name") or "").strip().lower()
            p_full = str(p.get("full_name") or "").strip().lower()
            p_last = str(p.get("last_name") or "").strip().lower()
            p_first = str(p.get("first_name") or "").strip().lower()
            p_combined = f"{p_last} {p_first}".strip()
            p_reversed = f"{p_first} {p_last}".strip()

            if cleaned in [p_name, p_full, p_combined, p_reversed]:
                return p["id"]
        return None

    # 3. Jelentkezések gyűjtése a 2. sortól kezdve
    attendance_records = []
    
    for row_idx in range(1, len(df)):
        row = df.iloc[row_idx]
        name_val = row.iloc[0]
        if not name_val:
            continue
        
        name_str = str(name_val).strip()
        if 'név' in name_str.lower() or name_str.lower() in ['none', 'nan', 'nat', '']:
            continue

        profile_id = find_profile_id(name_str)
        if not profile_id:
            continue

        for col_idx, mapping in excel_event_mapping.items():
            cell_val = row.iloc[col_idx]
            if cell_val is not None and str(cell_val).strip().upper() == 'X':
                attendance_records.append({
                    "event_id": mapping["event_id"],
                    "profile_id": profile_id,
                    "attending": True
                })

    if attendance_records:
        try:
            print(f"{len(attendance_records)} jelentkezés feltöltése...")
            supabase.table("attendances").upsert(attendance_records, on_conflict="event_id,profile_id").execute()
            print("Jelentkezések sikeresen feltöltve!")
        except Exception as e:
            print(f"Hiba a jelentkezések mentésekor: {e}")
    else:
        print("Nem található X jelölésű jelentkezés.")

if __name__ == "__main__":
    main()