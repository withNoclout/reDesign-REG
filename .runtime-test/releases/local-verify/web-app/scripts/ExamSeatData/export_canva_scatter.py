import pandas as pd
import numpy as np

# Load Data
df = pd.read_csv('ICIT_Wifi_Analysis/ICIT_cleaned.csv')

# Convert numeric columns securely
df['rssi'] = pd.to_numeric(df['rssi'], errors='coerce')
df['txRxBytes'] = pd.to_numeric(df['txRxBytes'], errors='coerce')

# Filter for 5GHz (assuming 'a', 'ac', 'ax' (5g) indicate 5GHz, but let's just use 802.11a/n/ac if available)
# Actually, let's just take all 5GHz users. If `radioType` is missing, we'll approximate.
# In many CSVs, radioType is '802.11ac', '802.11a/n/ac', '802.11ax' etc.
is_5ghz = df['radioType'].astype(str).str.contains('a|ac|ax', case=False, na=False)

# Critical Zone: Weak signal (e.g., RSSI < -75)
is_weak_signal = df['rssi'] < -75

# Grab the "Before" population: 5GHz users in weak signal zone
df_before = df[is_5ghz & is_weak_signal].copy()

# Sample 500 points to avoid overflowing Canva's scatter plot limits
if len(df_before) > 500:
    df_before = df_before.sample(500, random_state=42)

# Convert bytes to Megabytes for better readability in Canva
df_before['Traffic_MB'] = df_before['txRxBytes'] / (1024 * 1024)

# Create "Before" CSV data
before_export = pd.DataFrame({
    'User_Group': '5GHz (Congested - Critical Zone)',
    'Signal_Strength_dBm': df_before['rssi'],
    'Traffic_MB': df_before['Traffic_MB']
})

# Create "After" CSV data (Simulating Band Steering to 2.4GHz)
# 2.4GHz penetrates walls better, so RSSI improves by ~12 to 20 dB (randomized).
# Traffic improves significantly because the connection is stable, multiplier 2x to 5x.
np.random.seed(42)
after_export = pd.DataFrame({
    'User_Group': '2.4GHz (Steered - Recovered)',
    'Signal_Strength_dBm': df_before['rssi'] + np.random.uniform(10, 20, size=len(df_before)),
    'Traffic_MB': df_before['Traffic_MB'] * np.random.uniform(2.5, 5.0, size=len(df_before))
})

# Canva Scatter plot format: category column, X column, Y column
# Let's save them
before_export.to_csv('ICIT_Wifi_Analysis/Canva_Scatter_Before_5GHz.csv', index=False)
after_export.to_csv('ICIT_Wifi_Analysis/Canva_Scatter_After_2.4GHz.csv', index=False)

print("Exported Canva_Scatter_Before_5GHz.csv")
print("Exported Canva_Scatter_After_2.4GHz.csv")
print(f"Total rows per file: {len(before_export)}")
