import re

file_path = 'ICIT_Wifi_Analysis/manager_dashboard.html'
with open(file_path, 'r', encoding='utf-8') as f:
    html = f.read()

print(f"Original length: {len(html)} chars")

# 1. Deduplicate identical <section> tags containing the calendar
# The calendar was injected twice, which includes the JS and CSS.
# Let's find the start of the calendar section
marker_start = '<!-- Predictive Maintenance Calendar V4 -->'
marker_end = '<!-- End Predictive Maintenance Calendar V4 -->'

parts = html.split(marker_start)
if len(parts) > 2:
    print(f"Found {len(parts)-1} instances of the calendar section. Removing duplicates...")
    # Keep the first part (before the first injection) 
    # and the very last occurrence's content.
    # Actually, we just need to keep exactly one.
    
    # We will reconstruct the HTML using parts[0] + marker + the content of the FIRST instance + end marker + whatever is after the LAST end marker.
    # Let's do it safer with regex: remove all but the last one.
    
    # Simple approach: Find all blocks from start to end.
    pattern = re.compile(re.escape(marker_start) + r'.*?' + re.escape(marker_end), re.DOTALL)
    blocks = pattern.findall(html)
    
    if len(blocks) > 1:
        # Keep only the first block, replace all others with empty string
        first_block = blocks[0]
        html = html.replace(first_block, "___KEEP_ME___", 1) # Protect first
        
        # Remove all remaining blocks
        for block in blocks[1:]:
             html = html.replace(block, "")
             
        # Restore first
        html = html.replace("___KEEP_ME___", first_block)
        print("Duplicate calendar sections removed.")

# 2. Scope Isolation (IIFE wrapping)
# Let's wrap the script inside the calendar section safely. 
# We need to find the <script> block inside the calendar section and wrap its contents.
def wrap_in_iife(match):
    script_content = match.group(1)
    if '(() => {' not in script_content and 'const embeddedCalendarData' in script_content:
        print("Wrapping calendar script in IIFE for scope isolation.")
        return '<script>\n(() => {\n' + script_content + '\n})();\n</script>'
    return match.group(0)

# Apply IIFE wrapper only to the script containing embeddedCalendarData
html = re.sub(r'<script>(.*?const embeddedCalendarData.*?)</script>', wrap_in_iife, html, flags=re.DOTALL)


# 3. Dedicated observerOptions cleanup
# Ensure there is only ONE observer definition.
# Searching for standard intersection observer code.
observer_pattern = re.compile(r'const observerOptions = \{[\s\S]*?const observer = new IntersectionObserver[\s\S]*?\}\);')
obs_blocks = observer_pattern.findall(html)
if len(obs_blocks) > 1:
    print(f"Found {len(obs_blocks)} observer blocks. Deduplicating...")
    first_obs = obs_blocks[0]
    html = html.replace(first_obs, "___KEEP_OBS___", 1)
    for b in obs_blocks[1:]:
        html = html.replace(b, "")
    html = html.replace("___KEEP_OBS___", first_obs)

print(f"Cleaned length: {len(html)} chars")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Cleanup complete.")
