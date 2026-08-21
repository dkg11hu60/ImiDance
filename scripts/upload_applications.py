import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("Error: Missing Supabase environment variables in .env.local")
    exit(1)

url = url.strip().rstrip('/')
if url.endswith('/rest/v1'):
    url = url[:-8].rstrip('/')

supabase: Client = create_client(url, key)

def main():
    print("=== STARTING APPLICATIONS (ATTENDANCES) IMPORT ===")
    
    json_file = "data/dancers_data.json"
    if not os.path.exists(json_file):
        print(f"Error: {json_file} not found!")
        return

    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            records = json.load(f)
    except Exception as e:
        print(f"Error reading JSON file: {e}")
        return

    print("Fetching existing profiles from Supabase...")
    profiles_response = supabase.table("profiles").select("id, full_name, name").execute()
    profiles_data = profiles_response.data
    
    profile_map = {}
    for p in profiles_data:
        if p.get("full_name"):
            profile_map[p["full_name"]] = p["id"]
        if p.get("name"):
            profile_map[p["name"]] = p["id"]

    attendances_to_insert = []
    
    # Szigorú szűrő a nem esemény jellegű oszlopokra
    ignore_keys = [
        'név', 'név email cím', 'nem', 'szint', 'partner', 'email', 
        'fiú / lány', 'email cím', 'tudásszint', 'unnamed'
    ]

    print("Processing applications data...")
    for record in records:
        full_name = record.get("full_name")
        if not full_name:
            continue
            
        profile_id = profile_map.get(full_name)
        if not profile_id:
            continue
            
        apps = record.get("applications", {})
        for event_name, status in apps.items():
            clean_event_name = str(event_name).strip().lower()
            
            # Ellenőrzés, hogy az oszlopnév tartalmazza-e valamelyik tiltott kulcsszót
            if any(ignore in clean_event_name for ignore in ignore_keys):
                continue
                
            if status is None or str(status).strip() == "" or str(status).lower() == "nan":
                continue
                
            attendances_to_insert.append({
                "profile_id": profile_id,
                "event_name": str(event_name).strip(),
                "status": str(status).strip()
            })

    if not attendances_to_insert:
        print("No valid application records found to insert.")
        return

    print(f"Ready to upload {len(attendances_to_insert)} valid attendance records.")
    
    try:
        supabase.table("attendances").upsert(
            attendances_to_insert, 
            on_conflict="profile_id, event_name"
        ).execute()
        print(f"\nSuccessfully uploaded {len(attendances_to_insert)} attendance records to the database!")
    except Exception as e:
        print(f"Error uploading attendances: {e}")

if __name__ == "__main__":
    main()