import json
import os

calendar_path = os.path.join('ICIT_Wifi_Analysis', 'march_maintenance_calendar.json')
html_path = os.path.join('ICIT_Wifi_Analysis', 'march_predictive_maintenance.html')

with open(calendar_path, 'r', encoding='utf-8') as f:
    data_str = f.read()

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Replace the fetch logic with embedded data
fetch_block = """        fetch('march_maintenance_calendar.json')
            .then(response => response.json())
            .then(data => {"""

embedded_block = f"""        const data = {data_str};
        {{"""

new_html = html.replace(fetch_block, embedded_block)

# Remove the catch block
catch_block = """            })
            .catch(error => console.error('Error loading calendar data:', error));"""

new_html = new_html.replace(catch_block, "            }")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(new_html)

print("HTML file successfully updated with embedded data.")
