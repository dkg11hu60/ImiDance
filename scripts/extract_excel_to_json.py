import os
import re
import json
import pandas as pd
from datetime import datetime

def parse_name(full_name):
    if not full_name or not isinstance(full_name, str):
        return None, None, None
    
    cleaned = re.sub(r'[,]', ' ', full_name)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    parts = cleaned.split(' ')
    
    if not parts or parts[0].lower() in ['none', 'nan', '', 'név', 'név email cím', 'unnamed']:
        return None, None, None
        
    if len(parts) == 1:
        return cleaned, parts[0], ""
        
    first_name = parts[-1]
    last_name = " ".join(parts[:-1])
    return cleaned, last_name, first_name

def extract_gender(row_values):
    for val in row_values:
        if val is not None:
            val_str = str(val).strip().lower()
            if val_str in ['fiú', 'fiu', 'férfi']:
                return 'Fiú'
            elif val_str in ['lány', 'lany', 'nő']:
                return 'Lány'
    return None

def extract_dance_level(row_values):
    for val in row_values:
        if val is not None:
            val_str = str(val).strip().lower()
            if 'szuperh' in val_str:
                return 'SzuperH'
            elif 'extrah' in val_str:
                return 'ExtraH'
            elif 'hobbi' in val_str:
                return 'Hobbi'
            elif 'halad' in val_str:
                return 'Haladó'
    return 'Haladó'

def main():
    print("Starting comprehensive Excel to JSON extraction (Including all applications)...")
    
    target_file = None
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.xlsx') and 'jelentkezes' in file.lower():
                target_file = os.path.join(root, file)
                break
        if target_file:
            break
            
    if not target_file:
        print("Error: No Excel file matching 'jelentkezes' found!")
        return

    print(f"Reading file: {target_file}")
    
    try:
        # Az első sort (index 0) tekintjük fejlécnek
        df = pd.read_excel(target_file, header=0)
        df = df.where(pd.notna(df), None)
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return
        
    records = []
    
    for index, row in df.iterrows():
        row_dict = row.to_dict()
        
        # Tisztítjuk a szótár kulcsait és értékeit, hogy JSON kompatibilisek legyenek
        cleaned_row = {}
        for k, v in row_dict.items():
            # A dátum típusú oszlopnevek stringgé alakítása
            key_str = k.strftime('%Y-%m-%d') if isinstance(k, datetime) else str(k)
            # A cellaértékek stringgé alakítása (vagy None marad)
            val_clean = v.strftime('%Y-%m-%d %H:%M:%S') if isinstance(v, datetime) else (str(v).strip() if v is not None else None)
            cleaned_row[key_str] = val_clean

        # Jellemzően az első oszlop tartalmazza a neveket
        first_col_key = list(cleaned_row.keys())[0]
        name_val = cleaned_row.get(first_col_key)
        
        full_name, last_name, first_name = parse_name(name_val)
        if not full_name:
            continue

        # Kinyerjük az értékeket, hogy a nemet és a szintet megtaláljuk bennük
        row_values = list(cleaned_row.values())
        gender = extract_gender(row_values)
        dance_level = extract_dance_level(row_values)

        records.append({
            "full_name": full_name,
            "last_name": last_name,
            "first_name": first_name,
            "gender": gender,
            "dance_level": dance_level,
            "applications": cleaned_row  # <--- ITT VAN MINDEN EGYÉB ADAT (dátumok, regisztrációk, megjegyzések)
        })

    os.makedirs("data", exist_ok=True)
    output_file = "data/dancers_data.json"
    
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=4)
        print(f"Successfully extracted {len(records)} comprehensive records to {output_file}")
    except Exception as e:
        print(f"Error writing JSON file: {e}")

if __name__ == "__main__":
    main()