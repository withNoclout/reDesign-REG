import requests
from bs4 import BeautifulSoup
from typing import List, Optional
import time
from models import ExamSeat

class ExamScraper:
    BASE_URL = "http://www.scibase.kmutnb.ac.th/examroom/datatrain.php"

    def __init__(self, delay: float = 0.1):
        self.delay = delay

    def get_exam_seats(self, student_id: str) -> List[ExamSeat]:
        """
        Fetches exam seat data for a given student ID.
        Returns a list of ExamSeat objects.
        """
        try:
            params = {"IDcard": student_id}
            response = requests.get(self.BASE_URL, params=params, timeout=10)
            response.raise_for_status()
            
            # The API returns an HTML fragment
            soup = BeautifulSoup(response.text, 'html.parser')
            table = soup.find('table', class_='datatable')
            
            if not table:
                return []

            seats = []
            rows = table.find_all('tr')
            
            # Skip header row
            for row in rows[1:]:
                cols = row.find_all(['td', 'th'])
                if len(cols) >= 10:
                    seat = ExamSeat(
                        student_id=student_id,
                        exam_date=cols[0].text.strip(),
                        exam_time=cols[1].text.strip(),
                        course_code=cols[2].text.strip(),
                        course_name=cols[3].text.strip(),
                        section=cols[4].text.strip(),
                        row=cols[5].text.strip(),
                        seat=cols[6].text.strip(),
                        room=cols[7].text.strip(),
                        floor=cols[8].text.strip(),
                        building=cols[9].text.strip()
                    )
                    seats.append(seat)
                
            return seats
        except Exception as e:
            # Silently return empty on failure for parallel scanning
            return []

