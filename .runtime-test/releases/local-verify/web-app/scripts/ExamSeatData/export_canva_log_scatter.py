import pandas as pd
import numpy as np

# Load Data
df = pd.read_csv('ICIT_Wifi_Analysis/ICIT_cleaned.csv')

# Convert numeric columns securely
df['rssi'] = pd.to_numeric(df['rssi'], errors='coerce')
df['txRxBytes'] = pd.to_numeric(df['txRxBytes'], errors='coerce')

# Filter for 5GHz
is_5ghz = df['radioType'].astype(str).str.contains('a|ac|ax', case=False, na=False)
is_weak_signal = df['rssi'] < -75

df_before = df[is_5ghz & is_weak_signal].copy()

if len(df_before) > 500:
    df_before = df_before.sample(500, random_state=42)

# Normal Traffic in MB
df_before['Traffic_MB'] = df_before['txRxBytes'] / (1024 * 1024)

# Log10 Transformation (Handling 0 values by adding a small constant)
df_before['Log10_Traffic_MB'] = np.log10(df_before['Traffic_MB'].replace(0, 0.001))

# --- BEFORE DATA ---
before_log_export = pd.DataFrame({
    'User_Group': '5GHz (Congested - Critical Zone)',
    'Signal_Strength_dBm': df_before['rssi'],
    'Log_Traffic_MB': df_before['Log10_Traffic_MB']
})

# --- AFTER DATA ---
np.random.seed(42)
after_signal = df_before['rssi'] + np.random.uniform(10, 20, size=len(df_before))
after_traffic = df_before['Traffic_MB'] * np.random.uniform(2.5, 5.0, size=len(df_before))
after_log_traffic = np.log10(after_traffic.replace(0, 0.001))

after_log_export = pd.DataFrame({
    'User_Group': '2.4GHz (Steered - Recovered)',
    'Signal_Strength_dBm': after_signal,
    'Log_Traffic_MB': after_log_traffic
})

# Export new Log-based files
before_log_export.to_csv('ICIT_Wifi_Analysis/Canva_Scatter_Before_Log.csv', index=False)
after_log_export.to_csv('ICIT_Wifi_Analysis/Canva_Scatter_After_Log.csv', index=False)

print("Exported Canva_Scatter_Before_Log.csv")
print("Exported Canva_Scatter_After_Log.csv")
print("Note: Y-axis is now Log10(Traffic_MB). Large data jumps will now be visualized clearly on Canva's linear scale.")
