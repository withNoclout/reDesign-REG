from dataclasses import dataclass, field
from typing import Optional

@dataclass
class ExamSeat:
    student_id: str
    student_name: str        # e.g. "ณัฐกานต์ ถนอมญาติ"
    exam_date: str
    exam_time: str
    exam_day_in_week: str  # e.g. "Friday" or "วันศุกร์"
    course_code: str
    course_name: str
    section: str
    row: str
    seat: str
    room: str
    floor: str
    building: str
