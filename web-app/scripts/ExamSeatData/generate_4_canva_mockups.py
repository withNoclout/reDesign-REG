import pandas as pd
import numpy as np

# Set random seed for reproducibility
np.random.seed(42)

# Number of data points per group
n_samples = 500

def generate_mockup_scatter(group_name, x_mean, x_std, y_mean, y_std, x_min=0, x_max=100, y_min=-4.5, y_max=4.5):
    # X-axis: Signal Quality % (0-100)
    x_data = np.random.normal(x_mean, x_std, n_samples)
    x_data = np.clip(x_data, x_min, x_max)
    
    # Y-axis: Traffic (Log10 MB)
    y_data = np.random.normal(y_mean, y_std, n_samples)
    y_data = np.clip(y_data, y_min, y_max)
    
    # Add some outliers for realism
    num_outliers = int(n_samples * 0.05) # 5% outliers
    outlier_indices = np.random.choice(n_samples, num_outliers, replace=False)
    # Positive outliers (high traffic)
    y_data[outlier_indices[:num_outliers//2]] = np.random.uniform(y_mean + y_std, y_max, num_outliers//2)
    # Negative outliers (low traffic)
    y_data[outlier_indices[num_outliers//2:]] = np.random.uniform(y_min, y_mean - y_std, num_outliers - num_outliers//2)

    df = pd.DataFrame({
        'User_Group': [group_name] * n_samples,
        'Signal_Quality_Pct': np.round(x_data, 1),
        'Log10_Traffic_MB': np.round(y_data, 2)
    })
    return df

# --- 1. Generate "Before" Data ---

# 5GHz Before: Congested, many users in weak signal areas, dropping traffic
df_5g_before = generate_mockup_scatter(
    group_name='5GHz (Before - Congested)',
    x_mean=25, x_std=15,   # Weak signal
    y_mean=0, y_std=1.5    # Fluctuating, often low traffic
)

# 2.4GHz Before: Underutilized, signal is decent but few users generating heavy traffic
df_24g_before = generate_mockup_scatter(
    group_name='2.4GHz (Before - Underutilized)',
    x_mean=60, x_std=20,   # Good signal spread
    y_mean=-1.5, y_std=1.0 # Low traffic volume generally
)


# --- 2. Generate "After" Data (Band Steering / Policy Implemented) ---

# 5GHz After: Offloaded weak users. Remaining users have great signal & high throughput
df_5g_after = generate_mockup_scatter(
    group_name='5GHz (After - Optimized)',
    x_mean=75, x_std=15,   # Strong signal only
    y_mean=2.5, y_std=1.0  # High throughput
)

# 2.4GHz After: Absorbed the distant users. Signal still ok, traffic increased significantly
df_24g_after = generate_mockup_scatter(
    group_name='2.4GHz (After - Absorbed Load)',
    x_mean=50, x_std=15,   # Mid-range signal
    y_mean=1.5, y_std=1.2  # Moderate to high throughput now
)

# --- 3. Anchor Points for Canva Y-axis Consistency ---
# We force Canva to use exactly [-5, +5] on the Y-axis for all 4 charts
y_global_min = -5.0
y_global_max = 5.0

def add_anchor_points(df, group_name):
    anchors = pd.DataFrame({
        'User_Group': [group_name + ' (Anchor)', group_name + ' (Anchor)'],
        'Signal_Quality_Pct': [0, 100], 
        'Log10_Traffic_MB': [y_global_min, y_global_max] 
    })
    return pd.concat([df, anchors], ignore_index=True)

df_5g_before_anchored = add_anchor_points(df_5g_before, '5GHz (Before)')
df_24g_before_anchored = add_anchor_points(df_24g_before, '2.4GHz (Before)')
df_5g_after_anchored = add_anchor_points(df_5g_after, '5GHz (After)')
df_24g_after_anchored = add_anchor_points(df_24g_after, '2.4GHz (After)')

# --- 4. Export ---
files = {
    'ICIT_Wifi_Analysis/Canva_Scatter_5G_Before.csv': df_5g_before_anchored,
    'ICIT_Wifi_Analysis/Canva_Scatter_2.4G_Before.csv': df_24g_before_anchored,
    'ICIT_Wifi_Analysis/Canva_Scatter_5G_After.csv': df_5g_after_anchored,
    'ICIT_Wifi_Analysis/Canva_Scatter_2.4G_After.csv': df_24g_after_anchored
}

for filename, df in files.items():
    df.to_csv(filename, index=False)
    print(f"Exported: {filename}")

print("\nSuccessfully generated 4 mockup CSV files.")
print("All files contain invisible anchor points at Y=-5 and Y=5 so Canva scales them identically.")
