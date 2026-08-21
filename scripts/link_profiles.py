import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Hiba: Hiányzik a SUPABASE_SERVICE_ROLE_KEY a .env.local fájlban.")
    exit(1)

supabase: Client = create_client(url, key)

def main():
    print("Kapcsolat felvétele a Supabase Admin API-val...")
    
    auth_users = []
    try:
        # Paginációs paraméterek megadása a gotrue-py kompatibilitás érdekében
        response = supabase.auth.admin.list_users(page=1, per_page=200)
        if isinstance(response, list):
            auth_users = response
        elif hasattr(response, 'users'):
            auth_users = response.users
        else:
            auth_users = getattr(response, 'data', []) or []
    except Exception as e:
        print(f"Hiba az auth felhasználók lekérdezésekor: {e}")
        return

    print(f"Talált Auth felhasználók száma: {len(auth_users)}")

    # Lekérdjük a profiles tábla tartalmát
    profiles_res = supabase.table("profiles").select("*").execute()
    profiles = profiles_res.data or []
    print(f"Talált profilok száma a táblában: {len(profiles)}")

    # Összekötés és migráció
    for user in auth_users:
        user_id = user.id
        user_email = user.email
        user_metadata = getattr(user, 'user_metadata', {}) or {}
        user_name = user_metadata.get('full_name') or user_metadata.get('name')

        print(f"Feldolgozás: {user_email} (ID: {user_id})")

        matching_profile = None
        for p in profiles:
            p_name = p.get('full_name') or p.get('name')
            if (user_email and p.get('email') == user_email) or (user_name and p_name and user_name.strip().lower() == p_name.strip().lower()):
                matching_profile = p
                break

        if matching_profile:
            old_id = matching_profile['id']
            if old_id != user_id:
                print(f" -> Profil átkötése a régi ID-ról ({old_id}) az Auth ID-ra ({user_id})...")
                updated_data = {
                    "id": user_id,
                    "full_name": matching_profile.get('full_name'),
                    "name": matching_profile.get('name'),
                    "gender": matching_profile.get('gender'),
                    "dance_level": matching_profile.get('dance_level') or 'Haladó',
                    "partner_id": matching_profile.get('partner_id'),
                    "email": user_email
                }
                supabase.table("profiles").upsert(updated_data).execute()
                if old_id != user_id:
                    try:
                        supabase.table("profiles").delete().eq('id', old_id).execute()
                    except Exception as del_err:
                        print(f"    (Megjegyzés a régi rekord törlésénél: {del_err})")
            else:
                print(" -> Az ID már tökéletesen stimmel.")
        else:
            print(f" -> Nincs még profil ehhez a felhasználóhoz, létrehozás...")
            new_profile = {
                "id": user_id,
                "full_name": user_name or (user_email.split('@')[0] if user_email else 'Felhasználó'),
                "name": user_name or (user_email.split('@')[0] if user_email else 'Felhasználó'),
                "email": user_email,
                "dance_level": "Haladó"
            }
            supabase.table("profiles").upsert(new_profile).execute()

    print("Migráció sikeresen lefutott! Minden felhasználó a saját Auth ID-jához lett kötve.")

if __name__ == "__main__":
    main()