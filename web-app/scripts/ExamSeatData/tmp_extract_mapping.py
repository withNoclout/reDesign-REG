import pandas as pd

try:
    print("Extracting unique Building and BuildingName from ICIT_cleaned.csv...")
    
    # We only need 'Building' and 'BuildingName' columns
    # We can read a subset or process in chunks. The file is ~84MB, so chunking is safe.
    mapping = {}
    
    for chunk in pd.read_csv('ICIT_Wifi_Analysis/ICIT_cleaned.csv', usecols=['Building', 'BuildingName'], chunksize=100000):
        # Drop NaN values
        valid_chunk = chunk.dropna(subset=['Building', 'BuildingName'])
        for _, row in valid_chunk.drop_duplicates().iterrows():
            b_id = str(row['Building']).strip()
            # Handle float strings like '31.0'
            if b_id.endswith('.0'): b_id = b_id[:-2]
            
            b_name = str(row['BuildingName']).strip()
            if b_id not in mapping and b_id != 'nan':
                mapping[b_id] = b_name

    print("\n--- Discovered Mapping ---")
    for k, v in sorted(mapping.items()):
        print(f"ID: {k:5} -> Name: {v}")
        
    print("\nNow let's check the Exam Data building IDs:")
    eng_df = pd.read_csv('exam_seats_eng.csv', header=None, usecols=[9])
    kmutnb_df = pd.read_csv('exam_seats_kmutnb.csv', usecols=['building'])
    
    exam_bldgs = set(eng_df[9].dropna().astype(str).str.strip())
    exam_bldgs.update(kmutnb_df['building'].dropna().astype(str).str.strip())
    
    clean_exam_bldgs = set()
    for b in exam_bldgs:
        b_clean = b
        if b_clean.endswith('.0'): b_clean = b_clean[:-2]
        if b_clean != 'building': 
            clean_exam_bldgs.add(b_clean)
            
    print(f"\nExam Buildings found: {sorted(list(clean_exam_bldgs))}")
    
    print("\nMapping Results:")
    for b in sorted(list(clean_exam_bldgs)):
        name = mapping.get(b, "Unknown Building Name")
        print(f"Building {b} -> {name}")

except Exception as e:
    print("Error:", e)
