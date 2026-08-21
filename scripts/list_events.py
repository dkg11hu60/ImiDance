import os
import json
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

def main():
    try:
        res = supabase.table("events").select("id, event_date, title, start_time").order("event_date").execute()
        events = res.data or []
        print(json.dumps(events, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"Hiba az események lekérésekor: {e}")

if __name__ == "__main__":
    main()