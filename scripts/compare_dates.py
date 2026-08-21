import os
import re
import json
import pandas as pd
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("Hiba: Hiányoznak a Supabase környezeti változók.")
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
    # 1. Excel fájl beolvasása
    excel_files = [f for f in os.listdir('.') if f.endswith('.xlsx')]
    if not excel_files:
        print("Nem található Excel fájl!")
        return
    
    file_path = excel_files[0]
    df = pd.read_excel(file_path, header=None)
    df = df.where(pd.notnull(df), None)

    # 2. DB események lekérése
    events_res = supabase.table("events").select("id, event_date, title").execute()
    db_events = events_res.data or []

    # 3. Excel 1. sorának dátumai oszlopindexek szerint
    excel_dates = {}
    if len(df) > 0:
        row_zero = df.iloc[0]
        for c in range(1, len(df.columns)):
            date_str = extract_date(row_zero.iloc[c])
            if date_str:
                excel_dates[c] = date_str

    # 4. Összehasonlítás
    comparison = []
    for col_idx, ex_date in excel_dates.items():
        # Megkeressük azokat a DB eseményeket, amelyeknek a dátuma megegyezik az Excel dátumával
        matching_events = [
            {"id": e["id"], "event_date": e["event_date"], "title": e.get("title")}
            for e in db_events if str(e.get("event_date", "")).startswith(ex_date)
        ]
        
        comparison.append({
            "excel_column_index": col_idx,
            "excel_date": ex_date,
            "matching_db_events": matching_events
        })

    print(json.dumps(comparison, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()