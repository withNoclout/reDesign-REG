import pandas as pd
import numpy as np

# Set random seed for reproducibility
np.random.seed(42)

# Number of data points per group
n_samples = 500

# --- Function to generate mockup data ---
def generate_mockup_scatter(group_name, x_min, x_max, y_mean, y_std, y_min, y_max):
    # X-axis: Signal Quality % (Canva X-axis)
    # Generate using a beta distribution to cluster towards a specific range if needed,
    # or just uniform if we want to spread it out.
    # Let's use a slightly skewed distribution to look more realistic
    x_data = np.random.uniform(x_min, x_max, n_samples)
    
    # Y-axis: Traffic (Log10 MB) (Canva Y-axis)
    # Generate normally distributed data, then clip to min/max
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

# --- Parameters based on previous real data stats ---
# Before stats:
# Signal Quality: 6.0% - 48.0%
# Log10 Traffic: -4.72 - 3.94

# After stats:
# Signal Quality: 30.7% - 87.9%
# Log10 Traffic: -4.31 - 4.63

# Generate "Before" Data (5GHz Congested)
# X: Signal Quality low (10-50%)
# Y: Traffic spread out, generally lower
df_before_mockup = generate_mockup_scatter(
    group_name='5GHz (Congested Zone)',
    x_min=5, x_max=50,
    y_mean=0, y_std=1.5,
    y_min=-4.5, y_max=4.0
)

# Generate "After" Data (2.4GHz Recovered)
# X: Signal Quality better (30-90%)
# Y: Traffic higher on average, same overall scale
df_after_mockup = generate_mockup_scatter(
    group_name='2.4GHz (Recovered)',
    x_min=30, x_max=90,
    y_mean=1.5, y_std=1.2, # Shifted mean higher
    y_min=-4.5, y_max=4.7
)

# --- Ensure consistent Y-axis limits across both files for Canva ---
# Canva will auto-scale based on the data provided. 
# To force Canva to use the exact same Y-axis scale for BOTH datasets if plotted separately,
# we need to inject invisible "anchor" points at the extreme min/max of the overall Y-range.
y_global_min = min(df_before_mockup['Log10_Traffic_MB'].min(), df_after_mockup['Log10_Traffic_MB'].min())
y_global_max = max(df_before_mockup['Log10_Traffic_MB'].max(), df_after_mockup['Log10_Traffic_MB'].max())
y_global_min = np.floor(y_global_min) # Round down to integer
y_global_max = np.ceil(y_global_max)  # Round up to integer

def add_anchor_points(df, group_name):
    # Add points at x=0 (or min x) and x=100 (or max x) with the global min/max Y
    # These points will stretch the Canva axes to be identical for both charts.
    anchors = pd.DataFrame({
        'User_Group': [group_name + ' (Anchor)', group_name + ' (Anchor)'],
        'Signal_Quality_Pct': [0, 100], # Force X axis 0-100
        'Log10_Traffic_MB': [y_global_min, y_global_max] # Force Y axis global min-max
    })
    return pd.concat([df, anchors], ignore_index=True)

df_before_mockup_anchored = add_anchor_points(df_before_mockup, '5GHz (Congested Zone)')
df_after_mockup_anchored = add_anchor_points(df_after_mockup, '2.4GHz (Recovered)')

# Export to CSV
before_filename = 'ICIT_Wifi_Analysis/Canva_Scatter_Before_Mockup.csv'
after_filename = 'ICIT_Wifi_Analysis/Canva_Scatter_After_Mockup.csv'

df_before_mockup_anchored.to_csv(before_filename, index=False)
df_after_mockup_anchored.to_csv(after_filename, index=False)

print(f"Exported: {before_filename}")
print(f"Exported: {after_filename}")
print(f"\nGlobal Y-Axis forced to range: [{y_global_min}, {y_global_max}]")
print("Added two 'Anchor' points to each file at X=0 and X=100 with these min/max Y values.")
print("This ensures Canva scales both charts identically.")
