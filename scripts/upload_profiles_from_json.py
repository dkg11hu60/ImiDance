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
    print("=== STARTING PROFILE UPDATE FROM JSON ===")
    
    json_file = "data/dancers_data.json"
    if not os.path.exists(json_file):
        print(f"Error: {json_file} not found! Please run the extraction script first.")
        return

    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            records = json.load(f)
    except Exception as e:
        print(f"Error reading JSON file: {e}")
        return

    print(f"Loaded {len(records)} records from JSON. Updating profiles...")
    
    success_count = 0
    for record in records:
        full_name = record.get("full_name")
        if not full_name:
            continue
            
        update_data = {
            "first_name": record.get("first_name"),
            "last_name": record.get("last_name"),
            "gender": record.get("gender"),
            "dance_level": record.get("dance_level")
        }
        
        try:
            # Először a 'full_name' oszlop alapján próbálunk frissíteni
            response = supabase.table("profiles").update(update_data).eq("full_name", full_name).execute()
            
            # Ha esetleg a 'name' oszlopban lenne a név (a korábbi logika miatt), megpróbáljuk az alapján is
            if len(response.data) == 0:
                response = supabase.table("profiles").update(update_data).eq("name", full_name).execute()
            
            if len(response.data) > 0:
                success_count += 1
                print(f"   Success: {full_name}")
            else:
                print(f"   Warning: No profile found in database for {full_name}")
                
        except Exception as e:
            print(f"   Error updating profile for {full_name}: {e}")

    print(f"\nUpdate finished! Successfully updated {success_count} / {len(records)} profiles.")
    print("The UI should now properly display gender and dance level.")

if __name__ == "__main__":
    main()