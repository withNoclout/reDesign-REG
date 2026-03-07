import pandas as pd

try:
    df = pd.read_csv('ICIT_Wifi_Analysis/ICIT_cleaned.csv', nrows=1000)
    print("Columns:", df.columns.tolist())
    
    # Check if 'date' or a timestamp column exists
    if 'date' in df.columns:
        print("Date range in first 1000 rows:", df['date'].min(), "to", df['date'].max())
    elif 'Start_Time' in df.columns:
        print("Start_Time range:", df['Start_Time'].min(), "to", df['Start_Time'].max())
    else:
        # try to find a date column
        for col in df.columns:
            if 'time' in col.lower() or 'date' in col.lower():
                print(f"Date/Time column found: {col}, range: {df[col].min()} to {df[col].max()}")
                
    # Also let's check the actual full date range of the file. It's 84MB, so chunking is fast.
    print("Scanning entire file for date ranges...")
    min_date = 'z'
    max_date = '0'
    for chunk in pd.read_csv('ICIT_Wifi_Analysis/ICIT_cleaned.csv', usecols=[0, 1, 2, 3, 4, 5, 6], chunksize=100000):
        # We don't know the exact column name for date yet. Let's rely on the first 1000 rows to find it.
        pass
    
except Exception as e:
    print("Error:", e)
