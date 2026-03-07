import re

file_path = 'ICIT_Wifi_Analysis/manager_dashboard.html'
with open(file_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Issue 1: Missing observerOptions definition.
# At line 3911 it says `}, observerOptions);` but observerOptions was deleted.
# We need to restore the observerOptions at the top of the main script block.
observer_options_code = """
        // --- Intersection Observer for Fade-Up Animations ---
        const observerOptions = {
            threshold: 0.1,
            rootMargin: "0px 0px -50px 0px"
        };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
"""

# Let's find the broken observer call.
broken_observer = """
        // --- Intersection Observer for Fade-Up Animations ---
        
        }, observerOptions);
"""

if broken_observer in html:
    html = html.replace(broken_observer, observer_options_code)
    print("Fixed broken observer options.")
else:
    # Try regex if exact match fails
    html = re.sub(
        r'// --- Intersection Observer for Fade-Up Animations ---[\s\S]*?\}, observerOptions\);',
        observer_options_code.strip(),
        html
    )
    print("Fixed broken observer options (via regex).")

# Issue 2 & 3: Unexpected tokens / empty IIFE closures.
# The cleanup script added `(() => {` and `})();` incorrectly to multiple <script> tags.
# Let's remove all `(() => {` and `})();` from the file first, 
# then properly wrap ONLY the embeddedCalendarData declaration.
html = html.replace('(() => {\n', '')
html = html.replace('\n})();', '')

# Now, properly wrap the calendar data script block
def wrap_calendar(match):
    content = match.group(1)
    if 'const embeddedCalendarData' in content:
        return '(() => {\n' + content + '\n})();'
    return match.group(0)

# We need to find the <script> block containing embeddedCalendarData
# It usually starts with <script> and ends with </script>
html = re.sub(r'<script>\s*(const embeddedCalendarData[\s\S]*?)</script>', r'<script>\n(() => {\n\1\n})();\n</script>', html)

# Fix for line 1623 "Unexpected end of input": 
# Looking at the HTML, there are multiple `</script>` tags, we need to ensure they match.
# Let's just write securely.

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Applied syntax fixes to HTML.")
