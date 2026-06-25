import bs4
import re
import os

html_path = 'ICIT_Wifi_Analysis/manager_dashboard.html'
out_path = 'ICIT_Wifi_Analysis/manager_dashboard.html'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

soup = bs4.BeautifulSoup(html, 'html.parser')

body = soup.body

# The user wants styling standardized.
# We will inject a new chapter-header CSS class.
style_tag = soup.new_tag('style')
style_tag.string = """
    .chapter-header {
        font-size: 2rem;
        font-weight: 700;
        margin: 4rem 0 2rem 0;
        padding-bottom: 1rem;
        border-bottom: 2px solid var(--glass-border);
        display: flex;
        align-items: center;
        gap: 15px;
    }
    .chapter-rca { color: #ef4444; border-bottom-color: rgba(239, 68, 68, 0.3); }
    .chapter-action { color: #3b82f6; border-bottom-color: rgba(59, 130, 246, 0.3); }
    .chapter-outcome { color: #10b981; border-bottom-color: rgba(16, 185, 129, 0.3); }
    
    .card-rca { background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-left: 4px solid #ef4444; border-radius: 12px; padding: 2rem; margin-bottom: 2rem; }
    .card-action { background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2); border-left: 4px solid #3b82f6; border-radius: 12px; padding: 2rem; margin-bottom: 2rem; }
"""
soup.head.append(style_tag)

# Let's remove all "🎯 Objective X:" text
for text_node in soup.find_all(string=re.compile(r'🎯\s*Objective\s*\d+:\s*|Objective\s*\d+:\s*')):
    new_text = re.sub(r'🎯\s*Objective\s*\d+:\s*|Objective\s*\d+:\s*', '', text_node)
    text_node.replace_with(new_text)

# Also remove the specific <span>8</span> tag for objective 8
for span in soup.find_all('span', text='8'):
    if 'box-shadow: 0 0 15px var(--accent-blue)' in str(span):
        span.decompose()

# 1. Identify Sections by their headers
# Sections are typically inside `<div class="section">` or `<section class="section">` or just loose in container.

sections = []
container = soup.find('div', class_='container')
# We will just traverse the children of container and regroup them.
# The structure right now is:
# <header>
# <div class="container"> -> <div class="metrics-grid">
# S-T-A-R section div
# <div class="chart-container"> (Band Steering etc)
# <div class="section"> (Obj 7)
# <div class="section"> (Obj 9)
# <div class="section"> (Obj 10)
# <section class="section"> (Zero OPEX)
# <section class="section"> (Calendar)

# Actually, let's just create 3 new master sections: RCA, ACTION, OUTCOME.
rca_wrapper = soup.new_tag('div', id='chapter-rca')
rca_wrapper.append(bs4.BeautifulSoup('<h2 class="chapter-header chapter-rca">🔍 Chapter 1: Root Cause Analysis (Summarize Errors)</h2>', 'html.parser'))

action_wrapper = soup.new_tag('div', id='chapter-action')
action_wrapper.append(bs4.BeautifulSoup('<h2 class="chapter-header chapter-action">⚙️ Chapter 2: Action Plan & Strategy (Zero OPEX)</h2>', 'html.parser'))

outcome_wrapper = soup.new_tag('div', id='chapter-outcome')
outcome_wrapper.append(bs4.BeautifulSoup('<h2 class="chapter-header chapter-outcome">📈 Chapter 3: Outcomes & ROI Forecast</h2>', 'html.parser'))

# Move existing elements into these wrappers
# Band Steering (5GHz congestion) -> RCA
# Zero Traffic Eradication (Garbage traffic) -> RCA
# Software-Defined Policy -> Action
# Role-Based SLA -> Action
# Predictive Maintenance (Calendar) -> Action
# Zero OPEX AP Relocation (Moving APs) -> Action
# Scorecards & Results -> Outcome (Currently nested inside Zero OPEX and Band Steering, but we'll extract them if possible, or just treat the whole section)

for el in container.find_all(recursive=False):
    # Find headers to classify the element
    text = el.text.lower()
    
    if 'วิกฤตความแออัดของคลื่น 5ghz' in text or 'band steering' in text:
        # Currently band steering and scorecard are together. Let's wrap standard card.
        el['class'] = el.get('class', []) + ['card-rca', 'fade-up']
        rca_wrapper.append(el.extract())
        
    elif 'การกำจัดภาระขยะในระบบ' in text or 'zero traffic eradication' in text:
        el['class'] = el.get('class', []) + ['card-rca', 'fade-up']
        rca_wrapper.append(el.extract())
        
    elif 'การยกระดับประสิทธิภาพด้วย software' in text:
        el['class'] = el.get('class', []) + ['card-action', 'fade-up']
        action_wrapper.append(el.extract())
        
    elif 'บริหารจัดการทรัพยากรส่วนบุคคล' in text or 'role-based sla' in text:
        el['class'] = el.get('class', []) + ['card-action', 'fade-up']
        action_wrapper.append(el.extract())

    elif 'zero opex: แผนย้ายจุดติดตั้ง' in text or 'ap relocation strategy' in text:
        # Separate the scorecard inside it to Outcome?
        # For simplicity, keep it in Action but maybe split Scorecard.
        scorecard = el.find(lambda t: t.name == 'div' and 'scorecard: ผลลัพธ์เชิงปริมาณ' in t.text.lower())
        if scorecard:
            # scorecard is usually a div containing h3.
            # let's extract the charts-container that holds the scorecard
            charts_container = scorecard.find_parent('div', class_='charts-container')
            if charts_container:
                charts_container.extract()
                charts_container['class'] = charts_container.get('class', []) + ['fade-up']
                outcome_wrapper.append(charts_container)
        
        el['class'] = el.get('class', []) + ['card-action', 'fade-up']
        action_wrapper.append(el.extract())
        
# Calendar was inserted outside `.container` as a `<section class="section">` right before `<footer>` in V5.
# Let's find it and move it to Action wrapper.
cal_section = soup.find(lambda t: t.name == 'section' and 'ระบบจัดตารางเวลาเข้าปรับปรุงโครงข่าย' in t.text)
if cal_section:
    cal_section_div = cal_section.find('div', class_='container')
    if cal_section_div:
        # Extract content of cal_section_div and append to action_wrapper
        for child in cal_section_div.find_all(recursive=False):
            child['class'] = child.get('class', []) + ['card-action', 'fade-up']
            action_wrapper.append(child.extract())
    cal_section.decompose()

# Reconstruct container
# Executive summary stays at top
# STAR Intro stays
container.append(rca_wrapper)
container.append(action_wrapper)
container.append(outcome_wrapper)

# Update Javascript IntersectionObserver selection
if '<script>' in str(soup):
    pass # fade-up observer already targets .fade-up

# Write to file
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(str(soup))

print("Dashboard rewritten successfully!")
