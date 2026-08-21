import os
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("Error: Missing Supabase environment variables in .env.local.")
    exit(1)

url = url.strip().rstrip('/')
if url.endswith('/rest/v1'):
    url = url[:-8].rstrip('/')

supabase: Client = create_client(url, key)

def main():
    res = supabase.table("events").select("id, event_date, title").execute()
    events = res.data or []
    
    print(f"Total events found in database: {len(events)}")
    
    HOURS_TO_ADD = 16  
    
    for ev in events:
        ev_id = ev["id"]
        old_date_str = ev["event_date"]
        
        dt = datetime.fromisoformat(old_date_str.replace('Z', '+00:00'))
        new_dt = dt + timedelta(hours=HOURS_TO_ADD)
        new_date_str = new_dt.isoformat()
        
        print(f"Updating: {old_date_str} -> {new_date_str} ({ev.get('title')})")
        
        supabase.table("events").update({"event_date": new_date_str}).eq("id", ev_id).execute()
        
    print("All event dates successfully updated!")

if __name__ == "__main__":
    main()