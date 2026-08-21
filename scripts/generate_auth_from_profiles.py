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

def generate_clean_email(name):
    if not name:
        return "tancos@imisdance.local"
    nfkd_form = unicodedata.normalize('NFKD', name)
    no_accents = "".join([c for c in nfkd_form if unicodedata.combining(c) == 0])
    clean_name = re.sub(r'[^a-zA-Z0-9]', '.', no_accents).lower()
    clean_name = re.sub(r'\.+', '.', clean_name).strip('.')
    return f"{clean_name}@imisdance.local"

def main():
    print("=== TELJES AUTENTIKÁCIÓS TAKARÍTÁS ÉS ÚJRAGENERÁLÁS ===")
    
    # 1. Teljes körű törlés az auth.users táblából
    print("1. Összes létező Auth felhasználó radikális törlése...")
    deleted_count = 0
    while True:
        try:
            response = supabase.auth.admin.list_users(page=1, per_page=50)
            users = []
            if isinstance(response, list):
                users = response
            elif hasattr(response, 'users'):
                users = response.users
            elif isinstance(response, dict):
                users = response.get('users', [])
            
            if not users:
                break
            
            batch_deleted = 0
            for u in users:
                uid = u.id if hasattr(u, 'id') else u.get('id')
                email = u.email if hasattr(u, 'email') else u.get('email')
                try:
                    supabase.auth.admin.delete_user(uid)
                    print(f"   Törölve: {email} ({uid})")
                    deleted_count += 1
                    batch_deleted += 1
                except Exception as del_err:
                    print(f"   Hiba a(z) {email} törlésekor: {del_err}")
            
            if batch_deleted == 0:
                break
        except Exception as e:
            print(f"   Hiba a felhasználók listázásakor/törlésekor: {e}")
            break

    print(f"Összesen törölt Auth felhasználók száma: {deleted_count}")

    # 2. Lekérdjük a profiles táblát (SSOT)
    print("2. Profilok lekérdezése a profiles táblából...")
    profiles_res = supabase.table("profiles").select("*").execute()
    profiles = profiles_res.data or []
    print(f"Talált profilok száma: {len(profiles)}")

    if not profiles:
        print("A profiles tábla üres, nincs amiből generálni.")
        return

    # 3. Új Auth fiókok létrehozása tiszta lappal
    print("3. Új Auth fiókok létrehozása és összekötése...")
    success_count = 0
    for p in profiles:
        old_id = p.get('id')
        name = p.get('full_name') or p.get('name') or 'Ismeretlen'
        email = generate_clean_email(name)
        
        print(f"   Létrehozás: {name} ({email}) ... ", end="")
        try:
            response = supabase.auth.admin.create_user({
                "email": email,
                "password": "ImiDance2026!",
                "email_confirm": True,
                "user_metadata": {"full_name": name}
            })

            new_user = getattr(response, 'user', None) or (response.get('user') if isinstance(response, dict) else None)

            if new_user:
                new_id = new_user.id if hasattr(new_user, 'id') else new_user.get('id')
                
                # Frissítjük a profiles táblát az új Auth ID-val és a hivatalos email-lel
                supabase.table("profiles").update({
                    "id": new_id,
                    "email": email,
                    "full_name": name,
                    "name": name
                }).eq('id', old_id).execute()
                
                print(f"SIKER (ID: {new_id})")
                success_count += 1
            else:
                print("HIBA: Nincs user objektum a válaszban.")
        except Exception as e:
            print(f"HIBA: {e}")

    print(f"\nMűvelet kész! Sikeresen létrehozva és összekötve: {success_count} / {len(profiles)} felhasználó.")
    print("Ideiglenes belépési jelszó mindenkinél: ImiDance2026!")

if __name__ == "__main__":
    main()