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
    print("=== OKOS AUTH ÉS PROFIL SZINKRONIZÁCIÓ ===")
    
    # 1. Lekérdjük az összes meglévő Auth felhasználót
    print("1. Meglévő Auth felhasználók lekérdezése...")
    auth_users_map = {}
    page = 1
    while True:
        try:
            response = supabase.auth.admin.list_users(page=page, per_page=100)
            users = []
            if isinstance(response, list):
                users = response
            elif hasattr(response, 'users'):
                users = response.users
            elif isinstance(response, dict):
                users = response.get('users', [])
            
            if not users:
                break
            
            for u in users:
                uid = u.id if hasattr(u, 'id') else u.get('id')
                email = u.email if hasattr(u, 'email') else u.get('email')
                if email:
                    auth_users_map[email.lower()] = uid
            
            if len(users) < 100:
                break
            page += 1
        except Exception as e:
            print(f"Hiba az auth listázáskor: {e}")
            break

    print(f"Talált Auth felhasználók száma: {len(auth_users_map)}")

    # 2. Lekérdjük a profilokat (SSOT)
    print("2. Profilok lekérdezése a profiles táblából...")
    profiles_res = supabase.table("profiles").select("*").execute()
    profiles = profiles_res.data or []
    print(f"Talált profilok száma: {len(profiles)}")

    if not profiles:
        print("A profiles tábla üres.")
        return

    # 3. Szinkronizálás (Frissítés vagy Létrehozás)
    print("3. Felhasználók szinkronizálása és összekötése...")
    success_count = 0
    for p in profiles:
        old_id = p.get('id')
        name = p.get('full_name') or p.get('name') or 'Ismeretlen'
        email = generate_clean_email(name)
        email_lower = email.lower()

        print(f"   Feldolgozás: {name} ({email}) ... ", end="")
        
        uid = None
        try:
            if email_lower in auth_users_map:
                # Már létezik, frissítjük a jelszavát és metadata-ját
                uid = auth_users_map[email_lower]
                supabase.auth.admin.update_user_by_id(
                    uid,
                    {
                        "password": "ImiDance2026!",
                        "user_metadata": {
                            "full_name": name,
                            "must_change_password": True
                        }
                    }
                )
                print("FRISSÍTVE", end=" ")
            else:
                # Nem létezik, létrehozzuk
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
                    uid = new_user.id if hasattr(new_user, 'id') else new_user.get('id')
                    auth_users_map[email_lower] = uid
                    print("LÉTREHOZVA", end=" ")
                else:
                    print("HIBA: Nincs user objektum")
                    continue

            # Profil frissítése az új/helyes Auth UID-val
            if uid:
                supabase.table("profiles").update({
                    "id": uid,
                    "email": email,
                    "full_name": name,
                    "name": name,
                    "must_change_password": True
                }).eq('id', old_id).execute()
                print(f"(ID: {uid}) -> SIKER")
                success_count += 1

        except Exception as e:
            print(f"HIBA: {e}")

    print(f"\nMűvelet kész! Sikeresen szinkronizálva: {success_count} / {len(profiles)} felhasználó.")
    print("Ideiglenes belépési jelszó mindenkinél: ImiDance2026! (Kényszerített jelszóváltoztatással)")

if __name__ == "__main__":
    main()