import pandas as pd

try:
    eng_df = pd.read_csv('exam_seats_eng.csv', header=None, usecols=[9])
    kmutnb_df = pd.read_csv('exam_seats_kmutnb.csv', usecols=['building'])
    
    buildings = set(eng_df[9].dropna().astype(str).str.strip())
    buildings.update(kmutnb_df['building'].dropna().astype(str).str.strip())
    
    print(f"Total Unique Buildings ({len(buildings)}):")
    print(sorted(list(buildings)))
except Exception as e:
    print("Error:", e)
