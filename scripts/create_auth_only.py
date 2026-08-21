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

names = [
    "Bajnai Krisztina", "Erdős Adél", "Geiger Ágnes", "Golács Erzsébet",
    "Havasi Tímea", "Horváth Orsolya", "Jánoska Nikol Ágnes", "Kádas Eszter",
    "Kanizsai Zoltán", "Kelen Botond", "Kiss Berta", "Balázs Imre",
    "admin admin", "Lau Winnie", "Polyák-Bartos Viktória", "Szabó Győző",
    "Szabó Tünde", "Király Anna", "Kirner Dezső", "Kiss Gábor",
    "Kollár György", "Kuralit Piroska", "Kuripla István", "Szajkó Szabolcs",
    "Szecsődi Zsigmond", "Szekeres Katalin", "Tábori Ármin", "Tóth Ágnes",
    "Vágó Gergely", "Zilahy Zsuzsa", "Zólyomi Johanna", "Vincze Csilla",
    "Szabó Tamás", "Szolnoki Gábor", "Kisfaludi Gábor", "Lakatos Anna",
    "Lau Winnie", "Lejtényi Ágnes", "Lovas Anikó", "Miklós Márta",
    "Molnár Katalin", "Murányi Réka", "Nagyné Horváth Anikó", "Petrusic Dorotea"
]

def generate_clean_email(name, existing_emails):
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
    print("=== CSAK AUTH FELHASZNÁLÓK LÉTREHOZÁSA (A TRIGGER INTÉZI A PROFILT) ===")
    existing_emails = set()
    success_count = 0

    for name in names:
        email = generate_clean_email(name, existing_emails)
        print(f"   Létrehozás: {name} ({email}) ... ", end="")
        try:
            supabase.auth.admin.create_user({
                "email": email,
                "password": "ImiDance2026!",
                "email_confirm": True,
                "user_metadata": {
                    "full_name": name,
                    "must_change_password": True
                }
            })
            print("SIKER")
            success_count += 1
        except Exception as e:
            print(f"HIBA: {e}")

    print(f"\nMűvelet kész! Sikeresen létrehozva: {success_count} / {len(names)} felhasználó.")
    print("A trigger automatikusan létrehozta a profilokat a profiles táblában.")

if __name__ == "__main__":
    main()