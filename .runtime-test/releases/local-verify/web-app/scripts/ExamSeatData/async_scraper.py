import aiohttp
import asyncio
import re
from bs4 import BeautifulSoup
from typing import List
from models import ExamSeat

MAX_RETRIES = 3
RETRY_DELAY = 0.5  # seconds

def parse_room_info(raw_room: str):
    raw_room = raw_room.strip()
    building = "N/A"
    floor = "N/A"
    room_num = raw_room

    if "-" in raw_room:
        parts = raw_room.split("-", 1)
        building = parts[0].strip()
        r_part = parts[1].strip()
        
        if len(r_part) >= 3 and r_part.isdigit():
            floor = r_part[:-2]
            try:
                room_num = str(int(r_part[-2:]))
            except ValueError:
                room_num = r_part[-2:]
        else:
            room_num = r_part
            
    return building, floor, room_num

def extract_section(course_name: str, existing_section: str):
    sec_match = re.search(r'\s+(S\.|Sec\.?|Section)\s*(\d+)', course_name, flags=re.IGNORECASE)
    if sec_match:
        extracted_sec = sec_match.group(2)
        clean_name = course_name[:sec_match.start()].strip()
        return clean_name, extracted_sec
def extract_date_time(raw_dt_string: str):
    # Match format like: "Monday, 16th of March 2026 [09:00 - 12:00]"
    match = re.search(r'(.*?)\s*\[(.*?)\]', raw_dt_string)
    if match:
        full_date = match.group(1).strip()
        time_part = match.group(2).strip()
        
        parts = full_date.split(',', 1)
        if len(parts) >= 2:
            day_in_week = parts[0].strip()
            date_part = parts[1].strip()
            return day_in_week, date_part, time_part
        return "-", full_date, time_part
        
    parts = raw_dt_string.split('|')
    date_part = parts[0].strip() if len(parts) > 0 else "N/A"
    time_part = parts[1].strip() if len(parts) > 1 else "N/A"
    return "-", date_part, time_part


class AsyncExamScraper:
    BASE_URL = "http://www.scibase.kmutnb.ac.th/examroom/datatrain.php"

    def __init__(self, session: aiohttp.ClientSession):
        self.session = session

    async def get_exam_seats(self, student_id: str) -> List[ExamSeat]:
        """
        Fetches exam seat data for a given student ID asynchronously.
        Retries up to MAX_RETRIES times on network/timeout errors.
        Returns a list of ExamSeat objects, or [] if truly no data.
        """
        for attempt in range(MAX_RETRIES):
            try:
                params = {"IDcard": student_id}
                timeout = aiohttp.ClientTimeout(total=10)
                async with self.session.get(self.BASE_URL, params=params, timeout=timeout) as response:
                    if response.status != 200:
                        return []

                    html = await response.text()
                    soup = BeautifulSoup(html, 'lxml')

                # --- Parse student name from the heading outside the table ---
                student_name = "N/A"
                # The page text contains: "ของ คุณ <name> รหัสนักศึกษา <id>"
                page_text = soup.get_text(separator=" ", strip=True)
                if "คุณ " in page_text:
                    try:
                        after_khun = page_text.split("คุณ ", 1)[1]
                        # Stop at "รหัสนักศึกษา" (student ID label)
                        if "รหัสนักศึกษา" in after_khun:
                            student_name = after_khun.split("รหัสนักศึกษา")[0].strip()
                        else:
                            student_name = after_khun.split()[0].strip()
                    except (IndexError, AttributeError):
                        student_name = "N/A"

                table = soup.find('table', class_='datatable')

                if not table:
                    return []

                seats = []
                rows = table.find_all('tr')

                # Skip header row
                for row in rows[1:]:
                    cols = row.find_all(['td', 'th'])
                    if len(cols) >= 10:
                        raw_cname = cols[3].text.strip()
                        raw_sec = cols[4].text.strip()
                        clean_cname, extracted_sec = extract_section(raw_cname, raw_sec)
                        
                        raw_room = cols[7].text.strip()
                        bld, flr, rnum = parse_room_info(raw_room)
                        
                        seat = ExamSeat(
                            student_id=student_id,
                            student_name=student_name,
                            exam_date=cols[0].text.strip(),
                            exam_time=cols[1].text.strip(),
                            exam_day_in_week="-",
                            course_code=cols[2].text.strip(),
                            course_name=clean_cname,
                            section=extracted_sec,
                            row=cols[5].text.strip(),
                            seat=cols[6].text.strip(),
                            room=rnum,
                            floor=flr,
                            building=bld
                        )
                        seats.append(seat)

                return seats

            except (aiohttp.ClientError, asyncio.TimeoutError):
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_DELAY * (attempt + 1))
                else:
                    return []  # Exhausted all retries
            except Exception:
                return []  # Non-network parse errors — skip

        return []


class AsyncEngScraper:
    BASE_URL = "https://www.eng.kmutnb.ac.th/eservice/exam/seating"

    def __init__(self, session: aiohttp.ClientSession):
        self.session = session

    async def get_exam_seats(self, student_id: str) -> List[ExamSeat]:
        """
        Fetches exam seat data for a given student ID from the Engineering portal.
        Retries up to MAX_RETRIES times on network/timeout errors.
        Returns a list of ExamSeat objects.
        """
        for attempt in range(MAX_RETRIES):
            try:
                data = {"student_id": student_id}
                timeout = aiohttp.ClientTimeout(total=10)
                async with self.session.post(self.BASE_URL, data=data, timeout=timeout) as response:
                    if response.status != 200:
                        return []

                    html = await response.text()
                    soup = BeautifulSoup(html, 'lxml')

                    exam_divs = soup.find_all('div', class_='media-body')
                    if not exam_divs:
                        return []

                    seats = []
                    for div in exam_divs:
                        course_tag = div.find('strong', class_='text-gray-dark')
                        if not course_tag:
                            continue
                        course_info = course_tag.get_text(strip=True)
                        parts = course_info.split(' ', 1)
                        course_code = parts[0] if len(parts) > 0 else "N/A"
                        course_name = parts[1] if len(parts) > 1 else course_info

                        strongs = div.find_all('strong', class_='text-gray-dark')
                        dt_info = strongs[1].get_text(strip=True) if len(strongs) > 1 else "N/A"
                        day_w, d_part, t_part = extract_date_time(dt_info)

                        room_tag = div.find('strong', class_='text-primary')
                        room_info = room_tag.get_text(strip=True) if room_tag else "N/A"
                        room_parts = room_info.split('|')
                        raw_room = room_parts[0].replace('Room :', '').strip() if len(room_parts) > 0 else "N/A"
                        seat_val = room_parts[1].replace('Seat:', '').strip() if len(room_parts) > 1 else "N/A"
                        
                        clean_cname, extracted_sec = extract_section(course_name, "N/A")
                        bld, flr, rnum = parse_room_info(raw_room)

                        seat = ExamSeat(
                            student_id=student_id,
                            student_name="N/A",  # Filled in by main.py
                            exam_date=d_part,
                            exam_time=t_part,
                            exam_day_in_week=day_w,
                            course_code=course_code,
                            course_name=clean_cname,
                            section=extracted_sec,
                            row="N/A",
                            seat=seat_val,
                            room=rnum,
                            floor=flr,
                            building=bld
                        )
                        seats.append(seat)

                    return seats

            except (aiohttp.ClientError, asyncio.TimeoutError):
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_DELAY * (attempt + 1))
                else:
                    return []
            except Exception:
                return []

        return []
