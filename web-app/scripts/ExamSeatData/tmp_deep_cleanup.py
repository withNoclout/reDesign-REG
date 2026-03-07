from bs4 import BeautifulSoup
import re

file_path = 'ICIT_Wifi_Analysis/manager_dashboard.html'
with open(file_path, 'r', encoding='utf-8') as f:
    html = f.read()

print(f"Original length before deep clean: {len(html)} chars")

soup = BeautifulSoup(html, 'html.parser')

# Find all schedule components (the calendar sections)
# The section has id "proactive-sla-calendar" or similar.
calendars = soup.find_all(id='proactive-sla-calendar')
if len(calendars) > 1:
    print(f"Found {len(calendars)} calendar sections. Removing all but the first.")
    for cal in calendars[1:]:
        cal.decompose()

# What about the RCA/Action/Outcome cards? Did they get duplicated?
chapters = soup.find_all('section', class_='section')
print(f"Found {len(chapters)} main sections.")
# It's possible the entire chunk of sections got duplicated.
# Let's count h2 elements to see if chapters repeat
h2s = soup.find_all('h2')
h2_texts = [h2.get_text(strip=True) for h2 in h2s]
print("H2 Headers found:")
for t in h2_texts:
    print(" - " + t[:50])
    
# If we see duplicates like "Root Cause Analysis (RCA)" multiple times, the whole container was duplicated.
seen_h2 = set()
duplicate_sections = []

for section in soup.find_all('section'):
    h2 = section.find('h2')
    if h2:
        title = h2.get_text(strip=True)
        if title in seen_h2:
            duplicate_sections.append(section)
        else:
            seen_h2.add(title)

if duplicate_sections:
    print(f"Removing {len(duplicate_sections)} duplicated main sections.")
    for sec in duplicate_sections:
        sec.decompose()

# Clean up redundant global script declarations
# We need only one const observerOptions and one const embeddedCalendarData
script_tags = soup.find_all('script')
# Keep track of what we've injected to avoid double injecting
has_embedded = False
has_observer = False

for script in script_tags:
    if not script.string: continue
    
    modified = False
    new_string = script.string
    
    if 'const embeddedCalendarData' in new_string:
        if has_embedded:
            # We already have one, remove this declaration if it's identical or just clear it.
            # Easiest way is to remove the whole script tag if it's just a duplicate, but might have other code.
            print("Found duplicate embeddedCalendarData")
            new_string = re.sub(r'const embeddedCalendarData.*?;', '', new_string, flags=re.DOTALL)
            modified = True
        else:
            has_embedded = True
            
    if 'const observerOptions' in new_string:
        if has_observer:
            print("Found duplicate observerOptions")
            new_string = re.sub(r'const observerOptions.*?\n\}\);', '', new_string, flags=re.DOTALL)
            modified = True
        else:
            has_observer = True
            
    if modified:
        script.string.replace_with(new_string)

final_html = str(soup)
print(f"Final cleaned length: {len(final_html)} chars")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(final_html)

print("Deep cleanup complete.")
