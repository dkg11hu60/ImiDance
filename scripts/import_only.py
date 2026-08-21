import os
import re
import unicodedata
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Hiba: Hiányzik a Supabase URL vagy Service Role Key a .env.local fájlban.")
    exit(1)

supabase: Client = create_client(url, key)

def generate_clean_email(name, existing_emails):
    if not name:
        base = "tancos"
    else:
        nfkd_form = unicodedata.normalize('NFKD', name)
        no_accents = "".join([c for c in nfkd_form if unicodedata.combining(c) == 0])
        clean_name = re.sub(r'[^a-zA-Z0-9]', '.', no_accents).lower()
        base = re.sub(r'\.+', '.', clean_name).strip('.') or "tancos"
    
    email = f"{base}@imisdance.local"
    counter = 1
    while email in existing_emails:
        email = f"{base}{counter}@imisdance.local"
        counter += 1
    existing_emails.add(email)
    return email

def main():
    print("=== TISZTA AUTH IMPORT A PROFILES TÁBLÁBÓL ===")
    
    # 1. Profilok lekérdezése (SSOT)
    print("1. Profilok lekérdezése a profiles táblából...")
    profiles_res = supabase.table("profiles").select("*").execute()
    profiles = profiles_res.data or []
    print(f"   Talált profilok száma: {len(profiles)}")

    if not profiles:
        print("A profiles tábla üres.")
        return

    # 2. Új Auth fiókok létrehozása és összekötése
    print("2. Új Auth fiókok létrehozása és összekötése...")
    existing_emails = set()
    success_count = 0

    for p in profiles:
        old_id = p.get('id')
        name = p.get('full_name') or p.get('name') or 'Ismeretlen'
        email = generate_clean_email(name, existing_emails)

        print(f"   Létrehozás: {name} ({email}) ... ", end="")
        try:
            response = supabase.auth.admin.create_user({
                "email": email,
                "password": "ImiDance2026!",
                "email_confirm": True,
                "user_metadata": {
                    "full_name": name,
                    "must_change_password": True
                }
            })

            new_user = getattr(response, 'user', None) or (response.get('user') if isinstance(response, dict) else None)

            if new_user:
                new_id = new_user.id if hasattr(new_user, 'id') else new_user.get('id')
                
                supabase.table("profiles").update({
                    "id": new_id,
                    "email": email,
                    "full_name": name,
                    "name": name,
                    "must_change_password": True
                }).eq('id', old_id).execute()

                print(f"SIKER (ID: {new_id})")
                success_count += 1
            else:
                print("HIBA: Nincs user objektum a válaszban.")
        except Exception as e:
            print(f"HIBA: {e}")

    print(f"\nMűvelet kész! Sikeresen létrehozva és összekötve: {success_count} / {len(profiles)} felhasználó.")
    print("Ideiglenes belépési jelszó mindenkinél: ImiDance2026! (Kényszerített jelszóváltoztatással)")

if __name__ == "__main__":
    main()