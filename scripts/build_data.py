import os
import re
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

def parse_name(full_name):
    if not full_name or not isinstance(full_name, str):
        return None, None
    cleaned = re.sub(r'[,]', ' ', full_name)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    parts = cleaned.split(' ')
    if not parts or parts[0].lower() in ['none', 'nan', '', 'név', 'név email cím']:
        return None, None
    if len(parts) == 1:
        return parts[0], ""
    first_name = parts[-1]
    last_name = " ".join(parts[:-1])
    return last_name, first_name

def extract_gender(row):
    for val in row:
        if val is not None:
            val_str = str(val).strip()
            val_lower = val_str.lower()
            if val_lower in ['fiú', 'lány', 'férfi', 'nő', 'fiu', 'lany']:
                if val_lower in ['fiú', 'fiu', 'férfi']:
                    return 'Fiú'
                elif val_lower in ['lány', 'lany', 'nő']:
                    return 'Lány'
                return val_str.capitalize()
    return None

def extract_dance_level(row):
    for val in row:
        if val is not None:
            val_str = str(val).strip()
            val_lower = val_str.lower()
            
            if 'szuperh' in val_lower:
                return 'SzuperH'
            elif 'extrah' in val_lower:
                return 'ExtraH'
            elif 'hobbi' in val_lower:
                return 'Hobbi'
            elif 'halad' in val_lower:
                return 'Haladó'
                
    return 'Haladó' # Alapértelmezett érték, ha nincs találat

def main():
    try:
        supabase.table("profiles").select("*", count="exact").limit(1).execute()
        print("Kapcsolat sikeres a Supabase-el!")
    except Exception as e:
        print(f"Kritikus hiba a kapcsolat tesztelésekor: {e}")
        return

    target_file = None
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.xlsx') and 'jelentkezes' in file.lower():
                target_file = os.path.join(root, file)
                break
        if target_file:
            break
    
    if not target_file:
        print("Nem található 'jelentkezes' mintájú Excel fájl a mappafában sem!")
        return
    
    print(f"Feldolgozás alatt: {target_file}")
    
    df = pd.read_excel(target_file, header=None)
    df = df.where(pd.notnull(df), None)

    profiles_records = []
    for index, row in df.iterrows():
        name_val = row.iloc[0] if len(df.columns) > 0 else None
        if not name_val:
            continue
        name = str(name_val).strip()
        
        name_lower = name.lower()
        if 'név' in name_lower or 'unnamed' in name_lower or name_lower in ['none', 'nan', '', 'név email cím']:
            continue

        last_name, first_name = parse_name(name)
        if not last_name and not first_name:
            continue

        gender = extract_gender(row)
        dance_level = extract_dance_level(row)

        profiles_records.append({
            "name": name,
            "last_name": last_name,
            "first_name": first_name,
            "gender": gender,
            "dance_level": dance_level
        })

    if profiles_records:
        try:
            print(f"{len(profiles_records)} érvényes profil feltöltése a frissített dance_level adatokkal...")
            supabase.table("profiles").upsert(profiles_records, on_conflict="name").execute()
            print("Profilok sikeresen feltöltve!")
        except Exception as e:
            print(f"Hiba a profilok feltöltésekor: {e}")

    print("A feldolgozás lefutott!")

if __name__ == "__main__":
    main()