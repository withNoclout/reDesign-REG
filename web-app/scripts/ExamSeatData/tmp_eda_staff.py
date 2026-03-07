import pandas as pd

try:
    print("Loading valid data from ICIT_cleaned.csv in chunks to analyze account_type...")
    
    # We want to aggregate txRxBytes, session counts, and unique users by account_type and hour
    personnel_stats = {'txRxBytes': 0, 'sessions': 0, 'macs': set()}
    student_stats = {'txRxBytes': 0, 'sessions': 0, 'macs': set()}
    
    # Also let's check holiday behavior (Jan 1 was a holiday)
    jan1_stats = {'txRxBytes': 0, 'sessions': 0}
    normal_day_stats = {'txRxBytes': 0, 'sessions': 0}
    normal_day_count = 0
    
    chunk_count = 0
    for chunk in pd.read_csv('ICIT_Wifi_Analysis/ICIT_cleaned.csv', chunksize=500000):
        chunk_count += 1
        
        # Filter for personnel vs student
        personnel = chunk[chunk['account_type_clean'] == 'personnel']
        student = chunk[chunk['account_type_clean'] == 'student']
        
        personnel_stats['txRxBytes'] += personnel['txRxBytes'].sum()
        personnel_stats['sessions'] += len(personnel)
        personnel_stats['macs'].update(personnel['clientMac'].unique())
        
        student_stats['txRxBytes'] += student['txRxBytes'].sum()
        student_stats['sessions'] += len(student)
        student_stats['macs'].update(student['clientMac'].unique())
        
        # Holiday vs Normal working day (let's use Jan 6-10 as normal Mon-Fri)
        jan1 = chunk[chunk['date'] == '2026-01-01']
        normal = chunk[chunk['date'].isin(['2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10'])]
        
        jan1_stats['txRxBytes'] += jan1['txRxBytes'].sum()
        jan1_stats['sessions'] += len(jan1)
        
        normal_day_stats['txRxBytes'] += normal['txRxBytes'].sum()
        normal_day_stats['sessions'] += len(normal)

    print("\n--- Usage Comparison (Whole Month) ---")
    print(f"Personnel: {personnel_stats['sessions']} sessions, {len(personnel_stats['macs'])} unique devices, {personnel_stats['txRxBytes']/1e9:.2f} GB")
    print(f"Student:   {student_stats['sessions']} sessions, {len(student_stats['macs'])} unique devices, {student_stats['txRxBytes']/1e9:.2f} GB")
    
    print("\n--- Holiday vs Normal Day Averages ---")
    print(f"Jan 1 (Holiday)    : {jan1_stats['sessions']} sessions, {jan1_stats['txRxBytes']/1e9:.2f} GB")
    print(f"Normal Day (Avg/day): {normal_day_stats['sessions']/5} sessions, {(normal_day_stats['txRxBytes']/1e9)/5:.2f} GB")
    
except Exception as e:
    print(f"Error during EDA: {e}")
