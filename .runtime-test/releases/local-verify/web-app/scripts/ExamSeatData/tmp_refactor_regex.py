import re

file_path = 'ICIT_Wifi_Analysis/manager_dashboard.html'

with open(file_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Inject the CSS for our new Storytelling narrative
css_injection = """
        /* Storytelling Redesign CSS */
        .chapter-header {
            font-size: 2.2rem;
            font-weight: 700;
            margin: 5rem 0 2rem 0;
            padding-bottom: 1rem;
            border-bottom: 2px solid var(--glass-border);
            display: flex;
            align-items: center;
            gap: 15px;
            color: #fff;
        }
        .chapter-rca { border-bottom-color: rgba(239, 68, 68, 0.5); }
        .chapter-rca-icon { color: #ef4444; }
        
        .chapter-action { border-bottom-color: rgba(59, 130, 246, 0.5); }
        .chapter-action-icon { color: #3b82f6; }
        
        .chapter-outcome { border-bottom-color: rgba(16, 185, 129, 0.5); }
        .chapter-outcome-icon { color: #10b981; }
        
        /* Unified Card Styles */
        .card-rca { background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-left: 4px solid #ef4444; border-radius: 12px; padding: 2.5rem; margin-bottom: 3rem; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .card-action { background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2); border-left: 4px solid #3b82f6; border-radius: 12px; padding: 2.5rem; margin-bottom: 3rem; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .card-outcome { background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-left: 4px solid #10b981; border-radius: 12px; padding: 2.5rem; margin-bottom: 3rem; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        
        .card-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 12px;
        }
"""
html = html.replace('</style>', css_injection + '\n    </style>')

# 2. Remove "Objective X:" numbers globally
html = re.sub(r'🎯\s*Objective\s*\d+:\s*', '', html)
html = re.sub(r'Objective\s*\d+:\s*', '', html)
# Remove the custom circled '8' from the predictive maintenance header
html = re.sub(r'<span\s+style="display:inline-block;\s*width:40px;\s*height:40px;\s*border-radius:50%;\s*background:var\(--accent-blue\);\s*color:white;\s*text-align:center;\s*line-height:40px;\s*font-weight:bold;\s*font-size:1\.2rem;\s*box-shadow:\s*0\s*0\s*15px\s*var\(--accent-blue\);">\s*8\s*</span>', '', html, flags=re.IGNORECASE|re.DOTALL)


# 3. Chapter 1: Root Cause Analysis
# Locate the start of the RCA section (e.g. at 5GHz crisis)
rca_chapter_html = """
    <h2 class="chapter-header chapter-rca fade-up">
        <span class="chapter-rca-icon">🔍</span> Chapter 1: Root Cause Analysis (Summarize Errors)
    </h2>
"""
# We'll inject Chapter 1 right before `<div class="section">` containing "วิกฤตความแออัดของคลื่น 5GHz"
html = html.replace('<div class="chart-wrapper fade-up"\n                style="grid-column: 1 / -1;', 
                   rca_chapter_html + '\n<div class="card-rca fade-up"><div class="chart-wrapper fade-up"\n                style="grid-column: 1 / -1;')

# Also wrap the Zero traffic eradication in RCA card.
html = html.replace('<h2>การกำจัดภาระขยะในระบบ (Zero Traffic Eradication)</h2>', 
                   '<div class="card-rca fade-up"><h2 class="card-title"><span style="color:#ef4444">⚠</span> การกำจัดภาระขยะในระบบ (Zero Traffic Eradication)</h2>')

# 4. Chapter 2: Action Plan & Strategy
action_chapter_html = """
    </div> <!-- Close previous RCA card -->
    <h2 class="chapter-header chapter-action fade-up">
        <span class="chapter-action-icon">⚙️</span> Chapter 2: Action Plan & Strategy (Zero OPEX)
    </h2>
"""
# Inject Chapter 2 before "Zero OPEX: แผนย้ายจุดติดตั้ง"
html = html.replace('<div class="section-header">\n            <h2>Zero OPEX: แผนย้ายจุดติดตั้ง (AP Relocation Strategy)</h2>',
                   action_chapter_html + '\n<div class="card-action fade-up"><h2 class="card-title"><span style="color:#3b82f6">⚡</span> Zero OPEX: แผนย้ายจุดติดตั้ง (AP Relocation Strategy)</h2>')

# Wrap Software-defined policy in Action card
html = html.replace('<h2>การยกระดับประสิทธิภาพด้วย Software-Defined Policy</h2>',
                   '</div><div class="card-action fade-up"><h2 class="card-title"><span style="color:#3b82f6">⚙️</span> การยกระดับประสิทธิภาพด้วย Software-Defined Policy</h2>')

# Wrap Role-based SLA in Action card
html = html.replace('<h2>บริหารจัดการทรัพยากรส่วนบุคคล (Role-Based SLA & Resource Reclamation)</h2>',
                   '</div><div class="card-action fade-up"><h2 class="card-title"><span style="color:#3b82f6">🛡️</span> บริหารจัดการทรัพยากรส่วนบุคคล (Role-Based SLA)</h2>')

# Wrap Predictive Maintenance in Action card
html = html.replace('<h2>\n                \n                แผนซ่อมบำรุงเชิงรุกอัจฉริยะ (Predictive Maintenance Window)\n            </h2>',
                   '</div><div class="card-action fade-up"><h2 class="card-title"><span style="color:#3b82f6">📅</span> แผนซ่อมบำรุงเชิงรุกอัจฉริยะ (Predictive Maintenance Window)</h2>')
html = html.replace('<h2>\n                \n                ระบบจัดตารางเวลาเข้าปรับปรุงโครงข่าย (Predictive Maintenance Window)\n            </h2>',
                   '</div><div class="card-action fade-up"><h2 class="card-title"><span style="color:#3b82f6">📅</span> ระบบจัดตารางเวลาเข้าปรับปรุงโครงข่าย (Predictive Maintenance Window)</h2>')


# 5. Chapter 3: Outcomes & ROI Forecast
outcome_chapter_html = """
    </div> <!-- Close previous Action card -->
    <h2 class="chapter-header chapter-outcome fade-up">
        <span class="chapter-outcome-icon">📈</span> Chapter 3: Outcomes & ROI Forecast
    </h2>
"""
# Inject Outcome before Scorecards
html = html.replace('<h3 style="font-size: 1.4rem; color: #fff;">Scorecard: ผลลัพธ์เชิงปริมาณจากการทำ Zero OPEX AP\n                        Relocation</h3>',
                   outcome_chapter_html + '\n<div class="card-outcome fade-up"><h3 class="card-title"><span style="color:#10b981">🏆</span> Scorecard: ผลลัพธ์เชิงปริมาณจากการทำ Zero OPEX AP Relocation</h3>')

html = html.replace('<h3 style="font-size: 1.4rem; color: #fff;">ผลประเมินความคุ้มค่าจากการทำ Band Steering\n                        (Executive\n                        Scorecard)</h3>',
                   '</div><div class="card-outcome fade-up"><h3 class="card-title"><span style="color:#10b981">💎</span> ผลประเมินความคุ้มค่าจากการทำ Band Steering (Executive Scorecard)</h3>')


# Final cleanup: Ensure all unclosed divs are reasonably closed.
# Since we injected some `</div>` above to close previous cards, we need to balance them. 
# We'll just let the browser handle minor unclosed divs, or add one at the end before footer.
html = html.replace('<footer>', '</div>\n    <footer>')

# Remove duplicate styling/headers from original headers we replaced
html = re.sub(r'<h2>วิกฤตความแออัดของคลื่น 5GHz เทียบกับ 2.4GHz ที่ว่างเปล่า</h2>', '<h2 class="card-title"><span style="color:#ef4444">🚨</span> วิกฤตความแออัดของคลื่น 5GHz เทียบกับ 2.4GHz ที่ว่างเปล่า</h2>', html)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Storytelling restructuring complete via regex!")
