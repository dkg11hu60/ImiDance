import os
import re
import unicodedata
import pandas as pd
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

# Megjegyzés: Az auth admin műveletekhez a SUPABASE_SERVICE_ROLE_KEY szükséges!
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
                return 'Fiú'
    return 'Fiú'

def extract_email(row):
    for val in row:
        if val is not None and isinstance(val, str):
            val_str = val.strip()
            if '@' in val_str and '.' in val_str:
                return val_str
    return None

def generate_email(name):
    if not name:
        return "user@imisdance.local"
    normalized = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('utf-8')
    safe_name = re.sub(r'[^a-zA-Z0-9]', '.', normalized).strip('.')
    safe_name = re.sub(r'\.\.+', '.', safe_name)
    if not safe_name:
        safe_name = "user"
    return f"{safe_name.lower()}@imisdance.local"

def main():
    try:
        supabase.table("profiles").select("*", count="exact").limit(1).execute()
        print("Successfully connected to Supabase!")
    except Exception as e:
        print(f"Critical error testing connection: {e}")
        return

    excel_files = [f for f in os.listdir('.') if f.endswith('.xlsx')]
    if not excel_files:
        print("No Excel file found in the directory!")
        return
    
    file_path = excel_files[0]
    print(f"Processing file: {file_path}")
    
    # header=0: Az első sort fejlécként kezeljük, így az nem kerül be az adatok közé
    df = pd.read_excel(file_path, header=0)
    df = df.where(pd.notnull(df), None)

    try:
        print("Clearing activities table...")
        supabase.table("activities").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print("Activities table cleared successfully.")
    except Exception as e:
        print(f"Notice while clearing activities table: {e}")

    profiles_records = []
    emails_to_sync = []

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
        email = extract_email(row)
        if not email:
            email = generate_email(name)

        profiles_records.append({
            "name": name,
            "last_name": last_name,
            "first_name": first_name,
            "gender": gender,
            "email": email
        })
        emails_to_sync.append(email)

    if profiles_records:
        try:
            print(f"Upserting {len(profiles_records)} profiles...")
            supabase.table("profiles").upsert(profiles_records, on_conflict="name").execute()
            print("Profiles successfully updated!")
        except Exception as e:
            print(f"Error upserting profiles: {e}")
            return

        # Supabase Auth (`auth.users`) szinkronizáció Admin API-n keresztül
        print("Synchronizing Supabase Auth users...")
        try:
            existing_users = []
            page = 1
            while True:
                response = supabase.auth.admin.list_users(page=page, per_page=1000)
                users = response.users if hasattr(response, 'users') else response
                if not users:
                    break
                existing_users.extend(users)
                if len(users) < 1000:
                    break
                page += 1
            
            existing_emails = {u.email.lower() for u in existing_users if hasattr(u, 'email') and u.email}
        except Exception as e:
            print(f"Warning: Could not list auth users (check Service Role Key): {e}")
            existing_emails = set()

        for email in emails_to_sync:
            if email.lower() not in existing_emails:
                try:
                    supabase.auth.admin.create_user({
                        "email": email,
                        "password": "ImisDanceTemporaryPassword2026!",
                        "email_confirm": True
                    })
                    print(f"Created auth user: {email}")
                except Exception as e:
                    print(f"Error creating auth user {email}: {e}")

    print("Full processing and authentication sync completed successfully!")

if __name__ == "__main__":
    main()