import pandas as pd
import json
import calendar
from datetime import datetime
import os
import re

print("Loading exam data...")
# Read English program exams
eng_df = pd.read_csv('exam_seats_eng.csv', header=None,
                     names=['student_id', 'name', 'date_str', 'time_str', 'course_code', 'course_name', 'section', 'room', 'floor', 'building', 'row', 'seat', 'day_of_week'])
# Read Thai program exams
kmutnb_df = pd.read_csv('exam_seats_kmutnb.csv')

# --- TIME NORMALIZATION ---
def normalize_time_range(t_str):
    t_str = str(t_str).strip().replace(' ', '')
    # Match patterns like 9:00-12:00 or 09:00-12.00
    match = re.search(r'(\d{1,2})[:\.](\d{2})-(\d{1,2})[:\.](\d{2})', t_str)
    if match:
        h1, m1, h2, m2 = match.groups()
        # Force HH:MM format
        return f"{int(h1):02d}:{m1} - {int(h2):02d}:{m2}"
    return t_str # fallback

eng_df['time'] = eng_df['time_str'].apply(normalize_time_range)
kmutnb_df['time'] = kmutnb_df['exam_time'].apply(normalize_time_range)

# --- DATE PARSING ---
def parse_eng_date(d_str):
    try:
        clean_str = str(d_str).replace('st of', '').replace('nd of', '').replace('rd of', '').replace('th of', '')
        return datetime.strptime(clean_str.strip(), '%d %B %Y').strftime('%Y-%m-%d')
    except:
        return None
eng_df['date'] = eng_df['date_str'].apply(parse_eng_date)

def parse_kmutnb_date(d_str):
    try:
        parts = str(d_str).split()
        day = int(parts[0])
        year = int(parts[2]) - 543
        month = 3  # Based on the user stating it's for March
        return f"{year:04d}-{month:02d}-{day:02d}"
    except:
        return None
kmutnb_df['date'] = kmutnb_df['exam_date'].apply(parse_kmutnb_date)

# --- BUILDING CLEANING ---
def extract_building(b_str):
    val = str(b_str).strip()
    if val.endswith('.0'): val = val[:-2]
    return val
eng_df['building_clean'] = eng_df['building'].apply(extract_building)
kmutnb_df['building_clean'] = kmutnb_df['building'].apply(extract_building)

# Group by Date, Building, Time AND Course Name
# Clean course names
eng_df['course'] = eng_df['course_name'].fillna('Unknown Course').astype(str)
# kmutnb_df has subject_name instead of course_name sometimes, wait, let's use what's available
if 'subject_name' in kmutnb_df.columns:
    kmutnb_df['course'] = kmutnb_df['subject_name'].fillna('Unknown Subject').astype(str)
elif 'course_name' in kmutnb_df.columns:
    kmutnb_df['course'] = kmutnb_df['course_name'].fillna('Unknown Subject').astype(str)
else:
    kmutnb_df['course'] = 'Regular Exam'

eng_agg = eng_df.groupby(['date', 'building_clean', 'time', 'course']).size().reset_index(name='students')
kmutnb_agg = kmutnb_df.groupby(['date', 'building_clean', 'time', 'course']).size().reset_index(name='students')
all_exams = pd.concat([eng_agg, kmutnb_agg])

# All unique buildings with exams, plus B25 as staff building
all_buildings = sorted(list(set(all_exams['building_clean'].unique())))
if 'building' in all_buildings: all_buildings.remove('building')
all_buildings.append('B25')

exam_dict = {}
for _, row in all_exams.iterrows():
    d = row['date']
    b = row['building_clean']
    t = row['time']
    c = row['course']
    s = row['students']
    if b == 'building' or pd.isna(d): continue
    
    if d not in exam_dict:
        exam_dict[d] = {}
    if b not in exam_dict[d]:
        exam_dict[d][b] = {}
    
    if t not in exam_dict[d][b]:
        exam_dict[d][b][t] = []
        
    exam_dict[d][b][t].append({'course': c, 'students': s})

days_in_march = calendar.monthrange(2026, 3)[1]
calendar_data = []

def get_exam_reason_code(time_str):
    if time_str.startswith('08:') or time_str.startswith('09:') or time_str.startswith('10:'): return 'EXAM_AM'
    if time_str.startswith('12:') or time_str.startswith('13:') or time_str.startswith('14:'): return 'EXAM_PM'
    if time_str.startswith('15:') or time_str.startswith('16:') or time_str.startswith('17:'): return 'EXAM_EVE'
    return 'EXAM'

for day in range(1, days_in_march + 1):
    date_str = f"2026-03-{day:02d}"
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    day_name = calendar.day_name[dt.weekday()]
    is_weekend = dt.weekday() >= 5
    is_holiday = date_str == '2026-03-03'
    
    day_info = {
        'date': date_str,
        'day': day,
        'day_name': day_name,
        'type': 'Holiday' if is_holiday else ('Weekend' if is_weekend else 'Weekday'),
        'available_work_hours': [],
        'available_off_hours': [],
        'tickets': []
    }
    
    if is_holiday or is_weekend:
        day_info['available_off_hours'] = all_buildings.copy()
    else:
        # Full day ticket for Staff Ops
        staff_ticket = {
            'time_block': '08:30 - 16:30',
            'conflicts': [{
                'building': 'B25',
                'reason_code': 'STAFF_OP',
                'reason_text': 'Staff / Committee Operations'
            }]
        }
        day_info['available_off_hours'].append('B25')
        
        has_exam_today = date_str in exam_dict
        if has_exam_today:
            day_info['type'] = 'Exam Day'
            
        exam_time_blocks = {}
        
        for b in all_buildings:
            if b == 'B25': continue
            
            if has_exam_today and b in exam_dict[date_str]:
                # Collect exam times for tickets
                for t_block, courses in exam_dict[date_str][b].items():
                    if t_block not in exam_time_blocks:
                        exam_time_blocks[t_block] = []
                    
                    r_code = get_exam_reason_code(t_block)
                    
                    # Summarize courses
                    course_names = [c['course'] for c in courses]
                    total_students = sum(c['students'] for c in courses)
                    
                    # Truncate course list if very long
                    if len(course_names) > 2:
                        c_text = ", ".join(course_names[:2]) + f" (+{len(course_names)-2} more)"
                    else:
                        c_text = ", ".join(course_names)
                        
                    exam_time_blocks[t_block].append({
                        'building': b,
                        'reason_code': r_code,
                        'reason_text': f"{c_text} ({total_students} pax)"
                    })
                day_info['available_off_hours'].append(b)
            else:
                day_info['available_work_hours'].append(b)

        master_tickets = []
        # Add Staff Ticket
        master_tickets.append(staff_ticket)
        
        # Add Exam Tickets and Sort Chronologically
        # Extract starting hour for sorting
        def get_sort_key(time_str):
            try:
                return int(time_str[:2])
            except:
                return 99 # Push weird formats to bottom

        for t_block in sorted(exam_time_blocks.keys(), key=get_sort_key):
            master_tickets.append({
                'time_block': t_block,
                'conflicts': exam_time_blocks[t_block]
            })
            
        day_info['tickets'] = master_tickets

    calendar_data.append(day_info)

output_path = os.path.join('ICIT_Wifi_Analysis', 'march_maintenance_calendar.json')
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(calendar_data, f, ensure_ascii=False, indent=4)

print(f"Generated {output_path} successfully!")
