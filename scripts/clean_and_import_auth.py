import os
import re
import unicodedata
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Hiba: Hiányzik a SUPABASE_SERVICE_ROLE_KEY a .env.local fájlban.")
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
    print("=== TELJES AUTH TAKARÍTÁS ÉS ÚJRAGENERÁLÁS ===")
    
    # 1. Összes létező Auth felhasználó törlése lapozás nélkül
    print("1. Létező Auth felhasználók teljes törlése...")
    try:
        res = supabase.auth.admin.list_users()
        users = res.users if hasattr(res, 'users') else (res.get('users', []) if isinstance(res, dict) else res)
        if users:
            for u in users:
                uid = u.id if hasattr(u, 'id') else u.get('id')
                email = u.email if hasattr(u, 'email') else u.get('email')
                try:
                    supabase.auth.admin.delete_user(uid)
                    print(f"   Törölve: {email}")
                except Exception as del_err:
                    print(f"   Hiba a(z) {email} törlésekor: {del_err}")
        print("   Auth tábla sikeresen kiürítve.")
    except Exception as e:
        print(f"   Hiba az auth listázásakor/törlésekor: {e}")

    # 2. Profilok lekérdezése (SSOT)
    print("2. Profilok lekérdezése a profiles táblából...")
    profiles_res = supabase.table("profiles").select("*").execute()
    profiles = profiles_res.data or []
    print(f"   Talált profilok száma: {len(profiles)}")

    if not profiles:
        print("A profiles tábla üres.")
        return

    # 3. Új Auth fiókok létrehozása és összekötése
    print("3. Új Auth fiókok létrehozása és összekötése...")
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
                print("HIBA: Nincs user objektum.")
        except Exception as e:
            print(f"HIBA: {e}")

    print(f"\nMűvelet kész! Sikeresen létrehozva és összekötve: {success_count} / {len(profiles)} felhasználó.")
    print("Ideiglenes belépési jelszó mindenkinél: ImiDance2026! (Kényszerített jelszóváltoztatással)")

if __name__ == "__main__":
    main()