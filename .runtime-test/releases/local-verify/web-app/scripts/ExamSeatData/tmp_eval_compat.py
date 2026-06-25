import pandas as pd

def check_wifi_dates():
    print("Checking ICIT_cleaned.csv date range...")
    min_date = '9999-99-99'
    max_date = '0000-00-00'
    for chunk in pd.read_csv('ICIT_Wifi_Analysis/ICIT_cleaned.csv', usecols=['date'], chunksize=100000):
        cmin = str(chunk['date'].min())
        cmax = str(chunk['date'].max())
        if cmin < min_date: min_date = cmin
        if cmax > max_date: max_date = cmax
    print(f"Wi-Fi Data Dates: {min_date} to {max_date}")

def check_exam_eng():
    print("Checking exam_seats_eng.csv date range...")
    # Has no header, columns: student_id, name, date, time, course_code, course_name, section, room, floor, building, row, seat, day_of_week
    df = pd.read_csv('exam_seats_eng.csv', header=None, usecols=[2], names=['date'])
    print(f"Exam Eng Dates: {df['date'].unique()}")

def check_exam_kmutnb():
    print("Checking exam_seats_kmutnb.csv date range...")
    df = pd.read_csv('exam_seats_kmutnb.csv', usecols=['exam_date'])
    print(f"Exam KMUTNB Dates: {df['exam_date'].unique()}")

check_wifi_dates()
check_exam_eng()
check_exam_kmutnb()
