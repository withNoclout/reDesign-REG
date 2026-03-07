import json
import os

calendar_json_path = 'ICIT_Wifi_Analysis/march_maintenance_calendar.json'
dashboard_html_path = 'ICIT_Wifi_Analysis/manager_dashboard.html'
output_html_path = 'ICIT_Wifi_Analysis/manager_dashboard.html' # Overwrite directly per user request

print("Loading JSON data...")
with open(calendar_json_path, 'r', encoding='utf-8') as f:
    calendar_data_str = f.read()

print("Loading Dashboard HTML...")
with open(dashboard_html_path, 'r', encoding='utf-8') as f:
    dashboard_html = f.read()

# --- CSS and HTML for the Calendar Injection ---
# We use Vanilla CSS that matches the dark glassmorphism of the dashboard
calendar_injection = f"""
    <!-- Objective 8: Predictive Maintenance Window Calendar -->
    <section class="section">
        <div class="container">
            <h2 style="margin-bottom: 2rem; display: flex; align-items: center; gap: 15px;">
                <span style="display:inline-block; width:40px; height:40px; border-radius:50%; background:var(--accent-blue); color:white; text-align:center; line-height:40px; font-weight:bold; font-size:1.2rem; box-shadow: 0 0 15px var(--accent-blue);">8</span>
                ระบบจัดตารางเวลาเข้าปรับปรุงโครงข่าย (Predictive Maintenance Window)
            </h2>
            
            <div class="glass-card" style="padding: 2rem; margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1.5rem;">
                    <div>
                        <h3 style="color: var(--accent-purple); font-size: 1.5rem; margin-bottom: 0.5rem;">March 2026</h3>
                        <p style="color: var(--text-muted); font-size: 0.95rem;">Smart Maintenance Scheduling - Quick Scan View (Hardcoded Data Sync)</p>
                    </div>
                    <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; border: 1px solid var(--glass-border); font-size: 0.85rem;">
                        <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-main);">Legend:</div>
                        <div style="display: flex; align-items: center; margin-bottom: 4px;"><div style="width: 12px; height: 12px; border-radius: 3px; background: var(--success); margin-right: 8px;"></div> Available Work Hours (08:30 - 16:30)</div>
                        <div style="display: flex; align-items: center; margin-bottom: 8px;"><div style="width: 12px; height: 12px; border-radius: 3px; background: var(--text-muted); margin-right: 8px;"></div> Available Off-Hours / Weekends</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.8rem;">
                            <div><span style="color: var(--warning); font-weight: 600; font-family: monospace; display: inline-block; width: 65px;">[STAFF_OP]</span> สูง/บุคลากร</div>
                            <div><span style="color: var(--warning); font-weight: 600; font-family: monospace; display: inline-block; width: 65px;">[EXAM_AM]</span> สอบเช้า</div>
                            <div><span style="color: var(--warning); font-weight: 600; font-family: monospace; display: inline-block; width: 65px;">[EXAM_PM]</span> สอบบ่าย</div>
                            <div><span style="color: var(--success); font-weight: 600; font-family: monospace; display: inline-block; width: 65px;">[HOLIDAY]</span> วันหยุด</div>
                        </div>
                    </div>
                </div>

                <style>
                    /* Scoped Vanilla CSS for the Calendar inside the Dark Dashboard */
                    .cal-grid {{ display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; }}
                    .cal-header {{ text-align: center; font-weight: 600; color: var(--text-muted); padding: 10px 0; font-size: 0.9rem; }}
                    .cal-header.weekend {{ color: var(--warning); }}
                    
                    .cal-cell {{ min-height: 140px; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; }}
                    .cal-cell:hover {{ transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.1); }}
                    .cal-cell.empty {{ background: rgba(0,0,0,0.1); border: 1px dashed rgba(255,255,255,0.05); }}
                    .cal-cell.holiday {{ background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.2); }}
                    .cal-cell.exam {{ background: rgba(245, 158, 11, 0.05); border-color: rgba(245, 158, 11, 0.2); }}
                    .cal-cell.weekend {{ background: rgba(255,255,255,0.02); }}
                    
                    .cal-date-row {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }}
                    .cal-date-num {{ font-size: 1.2rem; font-weight: bold; color: var(--text-main); line-height: 1; }}
                    .cal-date-num.weekend {{ color: var(--warning); }}
                    .cal-badge {{ font-size: 0.65rem; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 10px; }}
                    .cal-badge.holiday {{ background: rgba(16, 185, 129, 0.2); color: var(--success); }}
                    .cal-badge.exam {{ background: rgba(245, 158, 11, 0.2); color: var(--warning); }}
                    
                    .cal-panel-base {{ padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 500; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; position: relative; cursor: help; }}
                    .cal-panel-green {{ background: rgba(16, 185, 129, 0.1); border-left: 3px solid var(--success); color: var(--success); }}
                    .cal-panel-gray {{ background: rgba(139, 148, 158, 0.1); border-left: 3px solid var(--text-muted); color: var(--text-main); }}
                    
                    .cal-ticket {{ background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-left: 3px solid #ef4444; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; position: relative; cursor: help; transition: background 0.2s; }}
                    .cal-ticket:hover {{ background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); }}
                    
                    .cal-tooltip {{ display: none; position: absolute; z-index: 100; width: 280px; padding: 12px; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); top: 100%; left: 50%; transform: translateX(-50%); margin-top: 8px; cursor: default; }}
                    .cal-tooltip::before {{ content: ''; position: absolute; top: -5px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 10px; height: 10px; background: rgba(15, 23, 42, 0.95); border-left: 1px solid rgba(255,255,255,0.1); border-top: 1px solid rgba(255,255,255,0.1); }}
                    
                    /* Show tooltips */
                    .cal-panel-base:hover .cal-tooltip,
                    .cal-ticket:hover .cal-tooltip {{ display: block; }}
                    
                    .cal-tag-pill {{ display: inline-block; padding: 2px 6px; margin: 2px; border-radius: 12px; font-size: 0.65rem; font-weight: 700; font-family: monospace; border: 1px solid transparent; }}
                    .cal-tag-green {{ background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); color: var(--success); }}
                    .cal-tag-gray {{ background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.1); color: var(--text-main); }}
                    .cal-tag-red {{ background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); color: #ef4444; }}

                    /* Reference Legend Grid */
                    .legend-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 1.5rem; }}
                    .legend-item {{ display: flex; align-items: center; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--glass-border); }}
                    .legend-text {{ font-size: 0.85rem; color: var(--text-main); }}
                </style>

                <!-- Calendar Week Headers -->
                <div class="cal-grid" style="margin-bottom: 8px;">
                    <div class="cal-header">Mon</div>
                    <div class="cal-header">Tue</div>
                    <div class="cal-header">Wed</div>
                    <div class="cal-header">Thu</div>
                    <div class="cal-header">Fri</div>
                    <div class="cal-header weekend">Sat</div>
                    <div class="cal-header weekend">Sun</div>
                </div>
                
                <!-- Main Calendar Grid Generated via JS -->
                <div class="cal-grid" id="main-calendar-grid"></div>

                <!-- Bottom Building Reference -->
                <div style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--glass-border);">
                    <h3 style="color: var(--text-main); font-size: 1.1rem; margin-bottom: 1rem;">Building Reference Dictionary</h3>
                    <div class="legend-grid">
                        <div class="legend-item"><span class="cal-tag-pill cal-tag-gray" style="margin-right: 12px; font-size: 0.75rem;">31</span><span class="legend-text">อาคารนวมินทรราชินี</span></div>
                        <div class="legend-item"><span class="cal-tag-pill cal-tag-gray" style="margin-right: 12px; font-size: 0.75rem;">72</span><span class="legend-text">อาคารสิรินธร</span></div>
                        <div class="legend-item"><span class="cal-tag-pill cal-tag-gray" style="margin-right: 12px; font-size: 0.75rem;">75</span><span class="legend-text">อาคารอเนกประสงค์</span></div>
                        <div class="legend-item"><span class="cal-tag-pill cal-tag-gray" style="margin-right: 12px; font-size: 0.75rem;">78</span><span class="legend-text">อาคารคณะวิทย์ประยุกต์</span></div>
                        <div class="legend-item"><span class="cal-tag-pill cal-tag-gray" style="margin-right: 12px; font-size: 0.75rem;">81</span><span class="legend-text">อาคารวิศวกรรมศาสตร์ 81</span></div>
                        <div class="legend-item"><span class="cal-tag-pill cal-tag-gray" style="margin-right: 12px; font-size: 0.75rem;">88</span><span class="legend-text">อาคารวิศวกรรมศาสตร์ 88</span></div>
                        <div class="legend-item"><span class="cal-tag-pill cal-tag-gray" style="margin-right: 12px; font-size: 0.75rem;">89</span><span class="legend-text">อาคาร 89</span></div>
                        <div class="legend-item" style="background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.2);"><span class="cal-tag-pill cal-tag-red" style="margin-right: 12px; font-size: 0.75rem;">B25</span><span class="legend-text">อาคารอเนกประสงค์ (สนง.)</span></div>
                    </div>
                </div>
            </div>
        </div>
    </section>
    
    <script>
        // HARDCODED V4 CALENDAR DATA FOR STATIC HTML DEPLOYMENT
        const embeddedCalendarData = {calendar_data_str};
        
        function renderCalendar() {{
            const grid = document.getElementById('main-calendar-grid');
            if(!grid) return;
            
            // March 2026 starts on Sunday (index 6, but we shift Mon=0..Sun=6 so Sunday is 6)
            for(let i = 0; i < 6; i++) {{
                grid.innerHTML += `<div class="cal-cell empty"></div>`;
            }}

            function getTags(arr, pillClass) {{
                if (!arr || arr.length === 0) return '';
                return arr.map(id => `<span class="cal-tag-pill ${{pillClass}}">${{id}}</span>`).join(' ');
            }}

            embeddedCalendarData.forEach(dayInfo => {{
                const isWeekend = dayInfo.day_name === 'Saturday' || dayInfo.day_name === 'Sunday';
                let cellClass = "cal-cell";
                if (dayInfo.type === 'Holiday') cellClass += " holiday";
                else if (dayInfo.type === 'Exam Day') cellClass += " exam";
                else if (isWeekend) cellClass += " weekend";

                let badges = '';
                if (dayInfo.type === 'Holiday') badges = `<span class="cal-badge holiday">Holiday</span>`;
                else if (dayInfo.type === 'Exam Day') badges = `<span class="cal-badge exam">Exams</span>`;
                
                let panelsHtml = `<div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">`;
                
                if (dayInfo.available_work_hours && dayInfo.available_work_hours.length > 0) {{
                    const tagsList = getTags(dayInfo.available_work_hours, 'cal-tag-green');
                    const label = dayInfo.available_work_hours.length === 7 ? 'All' : `${{dayInfo.available_work_hours.length}} Bldgs`;
                    panelsHtml += `
                    <div class="cal-panel-base cal-panel-green">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">✓ Work Hrs</span>
                        <span style="opacity: 0.7; font-size: 0.65rem;">${{label}}</span>
                        <div class="cal-tooltip">
                            <div style="font-weight: 600; color: var(--success); margin-bottom: 8px; border-bottom: 1px solid rgba(16, 185, 129, 0.2); padding-bottom: 4px;">🟢 Avail. Work Hours (08:30-16:30)</div>
                            <div style="line-height: 1.6;">${{tagsList}}</div>
                        </div>
                    </div>`;
                }}

                if (dayInfo.available_off_hours && dayInfo.available_off_hours.length > 0) {{
                    const tagsList = getTags(dayInfo.available_off_hours, 'cal-tag-gray');
                    const label = dayInfo.available_off_hours.length === 8 ? 'All' : `${{dayInfo.available_off_hours.length}} Bldgs`;
                    panelsHtml += `
                    <div class="cal-panel-base cal-panel-gray">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">✓ Off-Hrs</span>
                        <span style="opacity: 0.7; font-size: 0.65rem;">${{label}}</span>
                        <div class="cal-tooltip">
                            <div style="font-weight: 600; color: var(--text-main); margin-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 4px;">🔘 Avail. Off-Hours (18:00-06:00)</div>
                            <div style="line-height: 1.6;">${{tagsList}}</div>
                        </div>
                    </div>`;
                }}

                if (dayInfo.tickets && dayInfo.tickets.length > 0) {{
                    dayInfo.tickets.forEach(ticket => {{
                        const bCount = ticket.conflicts.length;
                        let conflictsList = '';
                        ticket.conflicts.forEach(c => {{
                            conflictsList += `
                            <div style="margin-bottom: 8px; display: flex; align-items: flex-start;">
                                <span class="cal-tag-pill cal-tag-red" style="margin-top: 2px; margin-right: 8px; flex-shrink: 0;">${{c.building}}</span>
                                <div>
                                    <div style="font-size: 0.75rem; color: #cbd5e1; line-height: 1.4;"><span style="color: #ef4444; font-weight: bold; font-family: monospace;">[${{c.reason_code}}]</span> ${{c.reason_text}}</div>
                                </div>
                            </div>`;
                        }});

                        panelsHtml += `
                        <div class="cal-ticket">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.65rem; font-weight: 700; color: #ef4444;">${{ticket.time_block}}</span>
                                <span style="font-size: 0.6rem; font-weight: 600; color: #fca5a5; background: rgba(239, 68, 68, 0.1); padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.2);">${{bCount}} ${{bCount === 1 ? 'Bldg' : 'Bldgs'}}</span>
                            </div>
                            <div style="font-size: 0.6rem; color: var(--text-muted); font-style: italic; margin-top: 2px;">Hover for details</div>
                            
                            <div class="cal-tooltip">
                                <div style="font-weight: 600; color: #ef4444; margin-bottom: 12px; border-bottom: 1px solid rgba(239, 68, 68, 0.2); padding-bottom: 6px; font-size: 0.85rem;">🔴 Blocked: ${{ticket.time_block}}</div>
                                ${{conflictsList}}
                            </div>
                        </div>`;
                    }});
                }}

                panelsHtml += `</div>`;

                const cellHtml = `
                <div class="${{cellClass}}">
                    <div class="cal-date-row">
                        <span class="cal-date-num ${{isWeekend ? 'weekend' : ''}}">${{dayInfo.day}}</span>
                        ${{badges}}
                    </div>
                    ${{panelsHtml}}
                </div>`;
                
                grid.innerHTML += cellHtml;
            }});
        }}
        
        // Execute render on load
        document.addEventListener('DOMContentLoaded', renderCalendar);
    </script>
"""

# Inject before the <footer> tag
if '<footer>' in dashboard_html:
    new_html = dashboard_html.replace('<footer>', calendar_injection + '\n    <footer>')
else:
    # If no footer found, simple append
    new_html = dashboard_html + calendar_injection

with open(output_html_path, 'w', encoding='utf-8') as f:
    f.write(new_html)

print(f"Successfully injected hardcoded calendar into {output_html_path}")
