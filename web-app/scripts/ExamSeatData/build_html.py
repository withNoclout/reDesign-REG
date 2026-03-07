import json
import os

with open('ICIT_Wifi_Analysis/march_maintenance_calendar.json', 'r', encoding='utf-8') as f:
    calendar_data = f.read()

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Predictive Maintenance Window - March 2026</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {{ font-family: 'Inter', sans-serif; background-color: #f3f4f6; }}
        .glass {{
            background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        }}
        .calendar-grid {{ display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0.5rem; }}
        
        .ticket-panel {{
            background: white; border: 1px solid #fee2e2; border-left: 3px solid #ef4444;
            border-radius: 0.375rem; padding: 0.375rem 0.5rem; margin-bottom: 0.375rem;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: help; position: relative;
        }}
        .ticket-panel:hover {{ border-color: #fca5a5; background: #fffcfc; }}
        
        /* Custom Tooltip Positioning */
        .tooltip {{
            display: none; position: absolute; z-index: 50;
            width: 240px; padding: 0.75rem; background: white;
            border: 1px solid #e5e7eb; border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            top: 100%; left: 50%; transform: translateX(-50%);
            margin-top: 0.5rem;
        }}
        .tooltip::before {{
            content: ''; position: absolute;
            top: -5px; left: 50%; transform: translateX(-50%) rotate(45deg);
            width: 10px; height: 10px; background: white;
            border-left: 1px solid #e5e7eb; border-top: 1px solid #e5e7eb;
        }}
        .ticket-panel:hover .tooltip {{ display: block; }}
        .has-tooltip:hover .tooltip {{ display: block; }}
        
        /* Available Panels */
        .panel-green {{ background-color: #d1fae5; border-left: 3px solid #10b981; color: #065f46; cursor: help; }}
        .panel-gray {{ background-color: #f3f4f6; border-left: 3px solid #9ca3af; color: #374151; cursor: help; }}
        .panel-base {{ padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 0.25rem; font-weight: 500; margin-bottom: 0.375rem; transition: background 0.2s; }}
        .panel-green:hover {{ background-color: #a7f3d0; }}
        .panel-gray:hover {{ background-color: #e5e7eb; }}
        
        /* Tag/Pill Styles */
        .tag-pill {{
            display: inline-block; padding: 0.125rem 0.375rem; margin: 0.125rem;
            border-radius: 9999px; font-size: 0.65rem; font-weight: 700; font-family: monospace;
            background-color: #f1f5f9; border: 1px solid #cbd5e1; color: #475569;
        }}
        .tag-pill-green {{ background-color: #ecfdf5; border-color: #a7f3d0; color: #059669; }}
        .tag-pill-gray {{ background-color: #f8fafc; border-color: #e2e8f0; color: #64748b; }}
        .tag-pill-red {{ background-color: #fef2f2; border-color: #fecaca; color: #dc2626; }}
    </style>
</head>
<body class="text-gray-800 p-8 min-h-screen">
    <div class="max-w-7xl mx-auto glass rounded-2xl p-8 mb-8 shadow-sm">
        <div class="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
            <div>
                <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Predictive Maintenance Window</h1>
                <p class="text-gray-500 mt-2">Smart Maintenance Scheduling - Quick Scan View</p>
            </div>
            <div class="flex flex-col space-y-2 text-[11px] font-medium bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div class="font-bold text-gray-700 mb-1 text-xs">Legend:</div>
                <div class="flex items-center"><div class="w-3 h-3 rounded bg-green-400 mr-2"></div> Available Work Hours (08:30 - 16:30)</div>
                <div class="flex items-center"><div class="w-3 h-3 rounded bg-gray-400 mr-2"></div> Available Off-Hours / Weekends</div>
                <div class="mt-1 pt-1 border-t border-gray-200 text-[10px] grid grid-cols-2 gap-x-3 gap-y-1">
                    <div><span class="font-bold text-red-600 w-12 inline-block">[STAFF_OP]</span> Staff High Traffic</div>
                    <div><span class="font-bold text-red-600 w-12 inline-block">[EXAM_AM]</span> Morning Exam (09:00-12:00)</div>
                    <div><span class="font-bold text-red-600 w-12 inline-block">[EXAM_PM]</span> Afternoon Exam (13:00-16:30)</div>
                    <div><span class="font-bold text-green-600 w-12 inline-block">[HOLIDAY]</span> Public Holiday</div>
                </div>
            </div>
        </div>

        <h2 class="text-2xl font-bold text-gray-800 mb-4">March 2026</h2>
        <div class="calendar-grid mb-2">
            <div class="text-center font-semibold text-gray-500 text-sm py-2">Mon</div>
            <div class="text-center font-semibold text-gray-500 text-sm py-2">Tue</div>
            <div class="text-center font-semibold text-gray-500 text-sm py-2">Wed</div>
            <div class="text-center font-semibold text-gray-500 text-sm py-2">Thu</div>
            <div class="text-center font-semibold text-gray-500 text-sm py-2">Fri</div>
            <div class="text-center font-semibold text-red-400 text-sm py-2">Sat</div>
            <div class="text-center font-semibold text-red-400 text-sm py-2">Sun</div>
        </div>
        <div class="calendar-grid" id="calendarGrid"></div>
        
        <!-- Bottom Legend -->
        <div class="mt-10 pt-8 border-t border-gray-200">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Building Reference Dictionary</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="flex items-center bg-gray-50 p-2 rounded border border-gray-100"><span class="tag-pill tag-pill-gray mr-3">31</span> <span class="text-sm text-gray-700">อาคารนวมินทรราชินี</span></div>
                <div class="flex items-center bg-gray-50 p-2 rounded border border-gray-100"><span class="tag-pill tag-pill-gray mr-3">72</span> <span class="text-sm text-gray-700">อาคารสิรินธร</span></div>
                <div class="flex items-center bg-gray-50 p-2 rounded border border-gray-100"><span class="tag-pill tag-pill-gray mr-3">75</span> <span class="text-sm text-gray-700">อาคารอเนกประสงค์</span></div>
                <div class="flex items-center bg-gray-50 p-2 rounded border border-gray-100"><span class="tag-pill tag-pill-gray mr-3">78</span> <span class="text-sm text-gray-700">อาคารคณะวิทย์ประยุกต์</span></div>
                <div class="flex items-center bg-gray-50 p-2 rounded border border-gray-100"><span class="tag-pill tag-pill-gray mr-3">81</span> <span class="text-sm text-gray-700">อาคารวิศวกรรมศาสตร์ 81</span></div>
                <div class="flex items-center bg-gray-50 p-2 rounded border border-gray-100"><span class="tag-pill tag-pill-gray mr-3">88</span> <span class="text-sm text-gray-700">อาคารวิศวกรรมศาสตร์ 88</span></div>
                <div class="flex items-center bg-gray-50 p-2 rounded border border-gray-100"><span class="tag-pill tag-pill-gray mr-3">89</span> <span class="text-sm text-gray-700">อาคาร 89</span></div>
                <div class="flex items-center bg-red-50 p-2 rounded border border-red-100"><span class="tag-pill tag-pill-red mr-3">B25</span> <span class="text-sm text-gray-700">อาคารอเนกประสงค์ (สนง.)</span></div>
            </div>
        </div>
    </div>

    <script>
        const calendarData = {calendar_data};
        const grid = document.getElementById('calendarGrid');
        
        for(let i = 0; i < 6; i++) {{
            grid.innerHTML += `<div class="min-h-[140px] bg-gray-50/50 rounded-xl border border-dashed border-gray-200"></div>`;
        }}

        function getTags(arr, pillClass) {{
            if (!arr || arr.length === 0) return '';
            return arr.map(id => `<span class="tag-pill ${{pillClass}}">${{id}}</span>`).join(' ');
        }}

        calendarData.forEach(dayInfo => {{
            const isWeekend = dayInfo.day_name === 'Saturday' || dayInfo.day_name === 'Sunday';
            let bgClass = "bg-white";
            if (dayInfo.type === 'Holiday') bgClass = "bg-green-50/50 border-green-200";
            else if (dayInfo.type === 'Exam Day') bgClass = "bg-yellow-50/50 border-yellow-200";
            else if (isWeekend) bgClass = "bg-gray-50 border-gray-100";
            else bgClass = "bg-white border-gray-200";

            let badges = '';
            if (dayInfo.type === 'Holiday') badges = `<span class="text-[9px] font-bold uppercase tracking-wider text-green-700 bg-green-200 px-2 py-0.5 rounded-full">Holiday</span>`;
            else if (dayInfo.type === 'Exam Day') badges = `<span class="text-[9px] font-bold uppercase tracking-wider text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded-full">Exams</span>`;
            
            let panelsHtml = `<div class="mt-2 space-y-1">`;
            
            if (dayInfo.available_work_hours && dayInfo.available_work_hours.length > 0) {{
                const tagsList = getTags(dayInfo.available_work_hours, 'tag-pill-green');
                const label = dayInfo.available_work_hours.length === 7 ? 'All' : `${{dayInfo.available_work_hours.length}} Bldgs`;
                panelsHtml += `
                <div class="relative has-tooltip">
                    <div class="panel-base panel-green flex justify-between items-center">
                        <span class="truncate">✓ Work Hours</span>
                        <span class="opacity-70 text-[9px]">${{label}}</span>
                    </div>
                    <div class="tooltip text-left cursor-default">
                        <div class="font-bold text-green-700 mb-1 text-xs">🟢 Avail. Work Hours (08:30-16:30)</div>
                        <div class="text-[11px] text-gray-700 border-t pt-2 mt-1 leading-relaxed">${{tagsList}}</div>
                    </div>
                </div>`;
            }}

            if (dayInfo.available_off_hours && dayInfo.available_off_hours.length > 0) {{
                const tagsList = getTags(dayInfo.available_off_hours, 'tag-pill-gray');
                const label = dayInfo.available_off_hours.length === 8 ? 'All' : `${{dayInfo.available_off_hours.length}} Bldgs`;
                panelsHtml += `
                <div class="relative has-tooltip">
                    <div class="panel-base panel-gray flex justify-between items-center">
                        <span class="truncate">✓ Off-Hours</span>
                        <span class="opacity-70 text-[9px]">${{label}}</span>
                    </div>
                    <div class="tooltip text-left cursor-default">
                        <div class="font-bold text-gray-700 mb-1 text-xs">🔘 Avail. Off-Hours (18:00-06:00)</div>
                        <div class="text-[11px] text-gray-600 border-t pt-2 mt-1 leading-relaxed">${{tagsList}}</div>
                    </div>
                </div>`;
            }}

            if (dayInfo.tickets && dayInfo.tickets.length > 0) {{
                dayInfo.tickets.forEach(ticket => {{
                    const bCount = ticket.conflicts.length;
                    let conflictsList = '';
                    ticket.conflicts.forEach(c => {{
                        conflictsList += `
                        <div class="mb-2 leading-tight flex items-start">
                            <span class="tag-pill tag-pill-red mt-0 mr-1.5 flex-shrink-0">${{c.building}}</span>
                            <div>
                                <div class="text-[10px] text-gray-600 font-medium"><span class="text-red-600 font-bold">[${{c.reason_code}}]</span> ${{c.reason_text}}</div>
                            </div>
                        </div>`;
                    }});

                    panelsHtml += `
                    <div class="ticket-panel">
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-bold text-red-700 truncate">${{ticket.time_block}}</span>
                            <span class="text-[9px] font-medium text-red-500 bg-red-50 px-1 rounded border border-red-100">${{bCount}} ${{bCount === 1 ? 'Bldg' : 'Bldgs'}}</span>
                        </div>
                        <div class="text-[9px] text-gray-500 truncate mt-0.5 italic">Hover to view impacted IDs</div>
                        
                        <div class="tooltip text-left cursor-default">
                            <div class="font-bold text-red-700 mb-2 border-b border-red-100 pb-1 text-xs">🔴 Blocked: ${{ticket.time_block}}</div>
                            ${{conflictsList}}
                        </div>
                    </div>`;
                }});
            }}

            panelsHtml += `</div>`;

            const cellHtml = `
            <div class="min-h-[140px] rounded-xl border p-2.5 flex flex-col hover:shadow-lg transition-all duraton-200 ${{bgClass}}">
                <div class="flex justify-between items-start">
                    <span class="font-bold text-lg leading-none ${{isWeekend ? 'text-red-500' : 'text-gray-700'}}">${{dayInfo.day}}</span>
                    ${{badges}}
                </div>
                ${{panelsHtml}}
            </div>`;
            
            grid.innerHTML += cellHtml;
        }});
    </script>
</body>
</html>
"""

with open('ICIT_Wifi_Analysis/march_predictive_maintenance.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

# We also copy to v4 to bust cache immediately
with open('ICIT_Wifi_Analysis/march_maintenance_v4.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print("Generated new HTML with V4 Time Normalization, Sorting, and Topics successfully.")
