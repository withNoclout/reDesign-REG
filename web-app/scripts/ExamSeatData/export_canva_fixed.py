import pandas as pd
import numpy as np

# Load Data
df = pd.read_csv('ICIT_Wifi_Analysis/ICIT_cleaned.csv', low_memory=False)
df['rssi'] = pd.to_numeric(df['rssi'], errors='coerce')
df['txRxBytes'] = pd.to_numeric(df['txRxBytes'], errors='coerce')

# Filter for 5GHz users with weak signal
is_5ghz = df['radioType'].astype(str).str.contains('a|ac|ax', case=False, na=False)
is_weak_signal = df['rssi'] < -75

df_before = df[is_5ghz & is_weak_signal].copy()
if len(df_before) > 500:
    df_before = df_before.sample(500, random_state=42)

# Traffic in MB
df_before['Traffic_MB'] = df_before['txRxBytes'] / (1024 * 1024)

# === KEY FIX ===
# The HTML scatter chart likely plots RSSI as |RSSI| (absolute), so stronger signal = higher X
# In the HTML: -75 dBm shows closer to right, -100 dBm shows at left (0 = strongest)
# To match: convert RSSI to "Signal Quality" % which is a positive scale
# Signal Quality = 100 - abs(RSSI)... but RSSI goes from 0 to -100
# Common formula: Quality (%) = 2 * (RSSI + 100) clamped to 0-100
df_before['Signal_Quality_Pct'] = (2 * (df_before['rssi'] + 100)).clip(0, 100)

# Log10 of traffic (for Y axis)
df_before['Log10_Traffic_MB'] = np.log10(df_before['Traffic_MB'].replace(0, 0.001))

# === BEFORE ===
before_export = pd.DataFrame({
    'User_Group': '5GHz (Congested Zone)',
    # X-axis: Signal quality 0-100% (matches HTML scatter axis direction)
    'Signal_Quality_Pct': df_before['Signal_Quality_Pct'],
    # Y-axis: Log10 traffic (matches HTML log scale)
    'Log10_Traffic_MB': df_before['Log10_Traffic_MB']
})

# === AFTER === 
np.random.seed(42)
# After: steered to 2.4GHz, RSSI improves by 10-20 dB
after_signal = df_before['rssi'] + np.random.uniform(10, 20, size=len(df_before))
after_quality = (2 * (after_signal + 100)).clip(0, 100)
after_traffic = df_before['Traffic_MB'] * np.random.uniform(2.5, 5.0, size=len(df_before))
after_log_traffic = np.log10(after_traffic.replace(0, 0.001))

after_export = pd.DataFrame({
    'User_Group': '2.4GHz (Recovered)',
    'Signal_Quality_Pct': after_quality,
    'Log10_Traffic_MB': after_log_traffic
})

# Export
before_export.to_csv('ICIT_Wifi_Analysis/Canva_Scatter_Before_Fixed.csv', index=False)
after_export.to_csv('ICIT_Wifi_Analysis/Canva_Scatter_After_Fixed.csv', index=False)

print("Exported Canva_Scatter_Before_Fixed.csv")
print("Exported Canva_Scatter_After_Fixed.csv")
print()
print("=== Before stats ===")
print(f"Signal Quality: {before_export['Signal_Quality_Pct'].min():.1f}% - {before_export['Signal_Quality_Pct'].max():.1f}%")
print(f"Log10 Traffic: {before_export['Log10_Traffic_MB'].min():.2f} - {before_export['Log10_Traffic_MB'].max():.2f}")
print()
print("=== After stats ===")
print(f"Signal Quality: {after_export['Signal_Quality_Pct'].min():.1f}% - {after_export['Signal_Quality_Pct'].max():.1f}%")
print(f"Log10 Traffic: {after_export['Log10_Traffic_MB'].min():.2f} - {after_export['Log10_Traffic_MB'].max():.2f}")
