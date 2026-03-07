import argparse
import aiohttp
import time
import csv
import sys
import os
import sqlite3
import pandas as pd
import asyncio
from collections import deque
from dotenv import load_dotenv
from async_scraper import AsyncExamScraper, AsyncEngScraper
from models import ExamSeat
from typing import List

from rich.live import Live
from rich.panel import Panel
from rich.layout import Layout
from rich.table import Table
from rich.progress import Progress, BarColumn, TextColumn, TimeRemainingColumn, SpinnerColumn, MofNCompleteColumn, TaskProgressColumn, TimeElapsedColumn
from rich.console import Console
from rich import box

console = Console()

# ──────────────────────────────────────────────
# SQLite DB Setup
# ──────────────────────────────────────────────
DB_FILE = "exam_seats.db"
CHECKPOINT_INTERVAL = 500  # Save to SQLite every N records found

# ──────────────────────────────────────────────
# KMUTNB ID Structure Constants
# ID format: YY CC MM RRRR SSc  (13 digits total)
#   YY   = enrollment year  (67 = B.E. 2567)
#   CC   = campus/faculty   (01-07)
#   MM   = major/dept code  (01-?? , campus-specific)
#   RRRR = admission round  (prefix: 10, 16, 20, 30, 36)
#   SSc  = sequence + check digit (000-999)
# ──────────────────────────────────────────────
CAMPUS_CODES = ["01", "02", "03", "04", "05", "06", "07"]

CAMPUS_NAMES = {
    "01": "วิศวกรรมศาสตร์",
    "02": "ครุศาสตร์อุตสาหกรรม",
    "03": "วิทยาศาสตร์ประยุกต์ (วทอ)",
    "04": "เทคโนโลยีและการจัดการอุตสาหกรรม",
    "05": "ศิลปศาสตร์",
    "06": "เขตปราจีนบุรี",
    "07": "เขตระยอง",
}

# Max department (MM) codes per campus — Engineering confirmed 13-14 depts
CAMPUS_DEPT_MAX = {
    "01": 14,   # Engineering: 13-14 departments confirmed
    "02": 30,   # Teacher Ed: scan 01-30 as safe upper bound
    "03": 30,   # Applied Science
    "04": 20,   # Technology
    "05": 30,   # Liberal Arts
    "06": 20,   # Prachinburi campus
    "07": 20,   # Rayong campus
}

# Known admission round prefixes (first 2 digits of RRRR)
ROUND_PREFIXES = ["10", "16", "20", "30", "36"]


def calculate_kmutnb_check_digit(id12: str) -> int:
    """
    Calculate the 13th digit (check digit) for a 12-digit Thai student/citizen ID.
    Algorithm: Weighted sum mod 11, then subtract from 11.
    """
    if len(id12) != 12 or not id12.isdigit():
        return 0
    weights = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
    s = sum(int(d) * w for d, w in zip(id12, weights))
    remainder = s % 11
    return (11 - remainder) % 10


def init_db(db_path: str = DB_FILE):
    """Initialize the SQLite database and create the table if it doesn't exist."""
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS exam_seats (
            student_id   TEXT,
            student_name TEXT,
            exam_date    TEXT,
            exam_time    TEXT,
            course_code  TEXT,
            course_name  TEXT,
            section      TEXT,
            room         TEXT,
            floor        TEXT,
            building     TEXT,
            row          TEXT,
            seat         TEXT,
            PRIMARY KEY (student_id, course_code, exam_date)
        )
    """)
    # Backward-compatibility: add student_name to existing DBs that don't have it
    try:
        conn.execute("ALTER TABLE exam_seats ADD COLUMN student_name TEXT DEFAULT 'N/A'")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # Backward-compatibility: add exam_day_in_week to existing DBs
    try:
        conn.execute("ALTER TABLE exam_seats ADD COLUMN exam_day_in_week TEXT DEFAULT '-'")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # Column already exists
        
    conn.commit()
    return conn


def save_to_db(conn: sqlite3.Connection, data: List[ExamSeat]):
    """Insert records into SQLite. Duplicate (student_id, course_code, exam_date) are silently ignored."""
    if not data:
        return
    rows = [
        (
            seat.student_id, seat.student_name, seat.exam_date, seat.exam_time, seat.exam_day_in_week,
            seat.course_code, seat.course_name, seat.section,
            seat.room, seat.floor, seat.building, seat.row, seat.seat
        )
        for seat in data
    ]
    conn.executemany("""
        INSERT OR IGNORE INTO exam_seats
        (student_id, student_name, exam_date, exam_time, exam_day_in_week, course_code, course_name,
         section, room, floor, building, row, seat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()


def export_to_csv(db_path: str = DB_FILE, output: str = None):
    """Export all records from SQLite to a CSV file (for Looker Studio)."""
    if output is None:
        output = db_path.replace('.db', '.csv') if db_path else "exam_seat_data.csv"
        
    conn = sqlite3.connect(db_path)
    df = pd.read_sql_query("SELECT * FROM exam_seats ORDER BY student_id, exam_date", conn)
    conn.close()
    df.to_csv(output, index=False, encoding="utf-8-sig")  # utf-8-sig for Excel compatibility
    console.print(f"[green][+] CSV exported: {output}  ({len(df):,} rows)[/green]")
    return output


def export_to_excel(db_path: str = DB_FILE, output: str = None):
    """Export all records from SQLite to an Excel file (for Looker Studio)."""
    if output is None:
        output = db_path.replace('.db', '.xlsx') if db_path else "exam_seat_data.xlsx"
        
    conn = sqlite3.connect(db_path)
    df = pd.read_sql_query("SELECT * FROM exam_seats ORDER BY student_id, exam_date", conn)
    conn.close()
    df.to_excel(output, index=False)
    console.print(f"[green][+] Excel exported: {output}  ({len(df):,} rows)[/green]")
    return output


# ──────────────────────────────────────────────
# UI Helpers
# ──────────────────────────────────────────────
def format_time_dhms(seconds: float) -> str:
    if seconds <= 0:
        return "0s"
    d = int(seconds // (24 * 3600))
    h = int((seconds % (24 * 3600)) // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    parts = []
    if d > 0: parts.append(f"{d}d")
    if h > 0: parts.append(f"{h}h")
    if m > 0: parts.append(f"{m}m")
    if s > 0 or not parts: parts.append(f"{s}s")
    return " ".join(parts)


def create_stats_table(stats_data):
    perf_table = Table(box=None, expand=True)
    perf_table.add_column("🚀 PERFORMANCE", style="cyan", header_style="bold cyan")
    perf_table.add_column("", style="white", justify="right")
    perf_table.add_row("Throughput", stats_data.get("Speed", "0.0 ID/s"))
    perf_table.add_row("Peak Speed", stats_data.get("Peak", "0.0 ID/s"))
    perf_table.add_row("Workers", f"{stats_data.get('Workers', 0)} Active")
    perf_table.add_row("Stability", stats_data.get("Stability", "Stable [green]🟢[/green]"))
    perf_table.add_row("Avg Latency", stats_data.get("Latency", "0ms"))
    if "State" in stats_data:
        perf_table.add_row("Scan Mode", stats_data["State"])

    time_table = Table(box=None, expand=True)
    time_table.add_column("⏱️ TIME & ESTIMATES", style="magenta", header_style="bold magenta")
    time_table.add_column("", style="white", justify="right")
    time_table.add_row("Elapsed", stats_data.get("Elapsed", "00:00"))
    time_table.add_row("Avg Time/ID", stats_data.get("TimePerID", "0ms"))
    time_table.add_row("ETA", stats_data.get("ETA", "N/A"))
    time_table.add_row("Finish Time", stats_data.get("Finish", "N/A"))
    time_table.add_row("Total Scanned", str(stats_data.get("Scanned", 0)))

    quality_table = Table(box=None, expand=True)
    quality_table.add_column("📊 DATA QUALITY", style="green", header_style="bold green")
    quality_table.add_column("", style="white", justify="right")
    quality_table.add_row("Seats Found", f"[bold green]{stats_data.get('Found', 0)}[/bold green]")
    quality_table.add_row("DB Total", f"[bold cyan]{stats_data.get('DBTotal', 0)}[/bold cyan]")
    quality_table.add_row("Success Rate", stats_data.get("SuccessRate", "0.0%"))
    quality_table.add_row("Miss Rate", stats_data.get("MissRate", "0.0%"))
    quality_table.add_row("Consecutive Misses", str(stats_data.get("Misses", 0)))
    quality_table.add_row("Current Range", str(stats_data.get("CurrentID", "N/A")))

    grid = Table.grid(expand=True)
    grid.add_column(ratio=1)
    grid.add_column(ratio=1)
    grid.add_column(ratio=1)
    grid.add_row(perf_table, time_table, quality_table)
    return grid


async def scan_ids_from_list(
    student_ids: list,
    source: str = "kmutnb",
    db_conn=None,
    initial_concurrency: int = 10,
    student_names_map: dict = None
):
    """Scan a specific list of student IDs concurrently using an adaptive Producer-Consumer Queue with Live UI."""
    
    # ── 1. DB Checkpointing: Skip already found IDs ──
    filtered_ids = student_ids
    
    # ── 2. Source Filtering: Skip non-engineering students if source="eng" ──
    if source == "eng":
        filtered_ids = [sid for sid in filtered_ids if str(sid)[2:4] == "01"]
        skipped_faculty = len(student_ids) - len(filtered_ids)
        if skipped_faculty > 0:
            console.print(f"[bold yellow][- Skipped {skipped_faculty:,} non-engineering IDs for efficiency (source=eng).][/bold yellow]")

    if db_conn:
        try:
            cursor = db_conn.execute("SELECT student_id FROM exam_seats")
            existing_ids = {row[0] for row in cursor.fetchall()}
            
            initial_count = len(filtered_ids)
            filtered_ids = [sid for sid in filtered_ids if str(sid) not in existing_ids]
            skipped_db = initial_count - len(filtered_ids)
            
            if skipped_db > 0:
                console.print(f"[bold yellow][- Skipped {skipped_db:,} students already in database.][/bold yellow]")
        except Exception as e:
            console.print(f"[dim]Warning: Could not check DB for existing IDs: {e}[/dim]")

    total_to_scan = len(filtered_ids)
    if total_to_scan == 0:
        console.print("[bold green][+ All students in the list have already been scanned!][/bold green]")
        return 0

    console.print(f"[bold cyan][+ Scanning {total_to_scan:,} students from list (Queue-Based)...][/bold cyan]")

    queue = asyncio.Queue()
    for sid in filtered_ids:
        queue.put_nowait(sid)

    # State Variables
    current_workers = initial_concurrency
    max_workers = 50   # Capped at 50 to prevent macOS `ulimit -n` file descriptor exhaustion / SQLite lock
    min_workers = 5
    error_count = 0
    total_found = 0
    processed_count = 0
    start_time = time.time()
    
    # UI Elements & Radar State
    # active_tasks tracks the current 5 tasks: {sid: {'state': '...', 'progress': 0-100}}
    active_tasks = {}
    sys_logs = deque(maxlen=3)
    stop_workers = False

    def generate_ui():
        """Constructs the Live Radar UI Layout"""
        elapsed = time.time() - start_time
        # Calculate ETA & Avg Wait
        remaining = total_to_scan - processed_count
        speed = processed_count / elapsed if elapsed > 0 else 0
        eta_seconds = remaining / speed if speed > 0 else 0
        eta_str = time.strftime('%H:%M:%S', time.gmtime(eta_seconds)) if eta_seconds < 86400 else "> 1 day"
        avg_wait = (elapsed * current_workers) / processed_count if processed_count > 0 else 0
        
        # 1. Header & Progress
        header_text = f"[bold white]+ KMUTNB List-Based Scanner | Adaptive Queue Engine +[/bold white]"
        progress_pct = (processed_count / total_to_scan * 100) if total_to_scan > 0 else 0
        stats_text = (
            f"[cyan]Progress:[/cyan] {progress_pct:.1f}% ({processed_count:,} / {total_to_scan:,})\n"
            f"[yellow]Elapsed:[/yellow] {time.strftime('%M:%S', time.gmtime(elapsed))}  |  "
            f"[yellow]ETA:[/yellow] {eta_str}  |  "
            f"[blue]Speed:[/blue] {speed:.1f} req/s  |  "
            f"[purple]Avg Wait:[/purple] {avg_wait:.2f}s  |  "
            f"[magenta]Workers:[/magenta] {current_workers}  |  "
            f"[green]Found:[/green] {total_found:,}"
        )
        top_panel = Panel(stats_text, title=header_text, border_style="bright_blue", box=box.ROUNDED)

        # 2. Live Radar Table (Max 5 active tasks)
        feed_table = Table(show_header=True, header_style="bold green", expand=True, box=box.SIMPLE)
        feed_table.add_column("Time", width=10, style="dim")
        feed_table.add_column("St", width=3)
        feed_table.add_column("Student ID", width=15, style="cyan")
        feed_table.add_column("Network Activity", style="white")
        
        # We only show up to 5 active items to keep it clean
        displayed = 0
        for sid, info in list(active_tasks.items())[:5]:
            timestamp = time.strftime("[%H:%M:%S]")
            
            # Simple ASCII progress bar [██████░░░░]
            p = info.get('progress', 0)
            filled = int(p / 10)
            bar = f"[{'█'*filled}{'░'*(10-filled)}] {p}%"
            
            status_icon = "▹" if info.get('state') == 'scanning' else ("✓" if info.get('state') == 'found' else "◦")
            
            feed_table.add_row(
                timestamp, status_icon, str(sid), f"{info.get('msg', 'Polling API...')} {bar}"
            )
            displayed += 1
            
        # Pad with empty rows if less than 5
        while displayed < 5:
            feed_table.add_row("-", "◦", "---", "[dim]Waiting for queue...[/dim]")
            displayed += 1
            
        feed_panel = Panel(feed_table, title="◦ ACTIVE RADAR (Top 5 Tasks)", border_style="green", box=box.ROUNDED, height=10)

        # 3. System Logs
        log_text = "\n".join(list(sys_logs)) or "Waiting for events..."
        log_panel = Panel(log_text, title="- SYSTEM LOGS -", border_style="dim", box=box.ROUNDED, height=5)

        # Assemble Layout (Tight fit)
        layout = Layout()
        layout.split_column(
            Layout(top_panel, size=5),
            Layout(feed_panel, size=12),
            Layout(log_panel, size=5)
        )
        return layout


    conn_http = aiohttp.TCPConnector(limit=max_workers)
    async with aiohttp.ClientSession(connector=conn_http) as session:
        scraper = AsyncEngScraper(session) if source == "eng" else AsyncExamScraper(session)
        
        async def worker(worker_id):
            nonlocal total_found, processed_count, error_count
            records_buffer = []
            
            while not queue.empty() and not stop_workers:
                try:
                    sid = queue.get_nowait()
                except asyncio.QueueEmpty:
                    break

                if worker_id >= current_workers:
                    queue.put_nowait(sid)
                    break
                
                # Register task in radar
                active_tasks[sid] = {'state': 'scanning', 'progress': 10, 'msg': 'Sending request...', 'start_t': time.time()}
                
                try:
                    active_tasks[sid]['progress'] = 50
                    active_tasks[sid]['msg'] = 'Awaiting response...'
                    
                    res = await scraper.get_exam_seats(str(sid))
                    
                    if res and student_names_map:
                        name = student_names_map.get(str(sid))
                        if name:
                            for seat in res:
                                if seat.student_name == "N/A":
                                    seat.student_name = name
                    
                    active_tasks[sid]['progress'] = 90
                    
                    if res:
                        records_buffer.extend(res)
                        total_found += len(res)
                        active_tasks[sid]['state'] = 'found'
                        active_tasks[sid]['msg'] = '[green]Hits found[/green]'
                    else:
                        active_tasks[sid]['state'] = 'empty'
                        active_tasks[sid]['msg'] = '[dim]Empty[/dim]'
                        
                    active_tasks[sid]['progress'] = 100
                        
                except Exception:
                    error_count += 1
                finally:
                    processed_count += 1
                    queue.task_done()
                    # Remove from radar after a tiny delay so user can see it hit 100%
                    await asyncio.sleep(0.1)
                    if sid in active_tasks:
                        del active_tasks[sid]
                    
                if len(records_buffer) >= 10 and db_conn:
                    save_to_db(db_conn, records_buffer)
                    records_buffer = []

            if records_buffer and db_conn:
                save_to_db(db_conn, records_buffer)

        # Start Initial Workers
        workers = [asyncio.create_task(worker(i)) for i in range(current_workers)]

        sys_logs.append(f"[dim]\[sys][/dim] + Started with {current_workers} workers.")

        # ── Start Live UI ──
        with Live(generate_ui(), refresh_per_second=8, console=console) as live:
            async def manager():
                nonlocal current_workers, error_count, workers
                while not queue.empty():
                    await asyncio.sleep(1) # Refresh UI and check scales every second
                    
                    # Update UI safely
                    try:
                        live.update(generate_ui())
                    except Exception as e:
                        sys_logs.append(f"[red]\[sys] - UI Error: {str(e)}[/red]")

                    # Watchdog: Clear stuck radar tasks (e.g. silent timeout hangs)
                    current_time = time.time()
                    stuck_sids = [s for s, data in dict(active_tasks).items() if current_time - data.get('start_t', current_time) > 45]
                    for s in stuck_sids:
                        if s in active_tasks:
                            del active_tasks[s]

                    # Scale Logic (every 2 seconds roughly)
                    if int(time.time() - start_time) % 2 == 0:
                        if error_count > 0:
                            new_target = max(min_workers, current_workers - 10) # Less aggressive scale down
                            if new_target != current_workers:
                                sys_logs.append(f"[red]\[sys] - Encountered errors. Scaling DOWN workers: {current_workers} -> {new_target}[/red]")
                                current_workers = new_target
                            error_count = 0 
                        else:
                            if queue.qsize() > current_workers * 2 and current_workers < max_workers:
                                new_target = min(max_workers, current_workers + 10)
                                if new_target != current_workers:
                                    sys_logs.append(f"[green]\[sys] + API stable. Scaling UP workers: {current_workers} -> {new_target}[/green]")
                                    for i in range(current_workers, new_target):
                                        workers.append(asyncio.create_task(worker(i)))
                                    current_workers = new_target

            manager_task = asyncio.create_task(manager())

            await queue.join()
            
            manager_task.cancel()
            stop_workers = True
            for w in workers:
                w.cancel()
            
            # Final UI Update
            live.update(generate_ui())

        console.print(f"\n[bold green][+ List scan complete. Total new records found: {total_found:,}][/bold green]")
        return total_found



# ──────────────────────────────────────────────
# Hierarchical Scan Engine (ID-Structure-Aware)
# ──────────────────────────────────────────────
async def hierarchical_scan(
    year: str = "67",
    source: str = "kmutnb",
    db_conn=None,
    initial_concurrency: int = 20,
    campus_filter: list = None,   # e.g. ["01"] to scan only Engineering
):
    """
    3-Layer hierarchical scan exploiting KMUTNB ID structure:
      Layer 1: Probe CC × MM combos to find active faculty+major pairs
      Layer 2: Enumerate RRRR (round codes) per active CC+MM
      Layer 3: Extract all SSc sequences per active CC+MM+RRRR
    Total probes: ~201,000 vs 10,000,000 blind scan → 50x faster, 100% complete.
    """
    campuses = campus_filter or CAMPUS_CODES

    conn_http = aiohttp.TCPConnector(limit=initial_concurrency)
    async with aiohttp.ClientSession(connector=conn_http) as session:
        scraper = AsyncEngScraper(session) if source == "eng" else AsyncExamScraper(session)
        all_data = []
        total_found = 0

        async def probe(sid: str):
            res = await scraper.get_exam_seats(sid)
            return res if isinstance(res, list) and res else []

        async def batch_probe(ids: list):
            return await asyncio.gather(*[probe(sid) for sid in ids])

        def flush(records):
            nonlocal total_found
            if records and db_conn:
                save_to_db(db_conn, records)
                total_found += len(records)

        for cc in campuses:
            campus_name = CAMPUS_NAMES.get(cc, cc)
            dept_max = CAMPUS_DEPT_MAX.get(cc, 30)
            console.print(f"\n[bold cyan]━━━ Campus {cc}: {campus_name} (MM=01-{dept_max:02d}) ━━━[/bold cyan]")

            for mm in range(1, dept_max + 1):
                major = f"{mm:02d}"
                major_found = False

                for rp in ROUND_PREFIXES:
                    for rr in range(0, 100):
                        round_code = f"{rp}{rr:02d}"
                        base_10 = f"{year}{cc}{major}{round_code}"
                        
                        # ── Layer 1: Probe the Round (Spread Strategy) ────────
                        # Probe IDs spread out in sequence (0, 10, 20...90)
                        # This prevents skipping rounds where student sequences 
                        # don't start at 00.
                        probe_ids = []
                        for ss in [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]:
                            prefix12 = f"{base_10}{ss:02d}"
                            c = calculate_kmutnb_check_digit(prefix12)
                            probe_ids.append(f"{prefix12}{c}")
                        
                        l1_results = await batch_probe(probe_ids)
                        hits = [r for r in l1_results if r]
                        
                        if not hits:
                            continue  # Round is likely empty, skip to next RR
                            
                        # Round is active!
                        if not major_found:
                            console.print(f"  [green]Major CC={cc} MM={major} is ACTIVE[/green]")
                            major_found = True
                        
                        console.print(f"    [magenta]Rounding {round_code} (Active! Extracting all SS 00-99)[/magenta]")
                        
                        # Flush already found hits from probe
                        for r in hits:
                            all_data.extend(r)
                        if all_data:
                            flush(all_data)
                            all_data = []

                        # ── Layer 2: Extract all sequences (SS=00-99) ─────────
                        # Now scan concurrently to ensure 100% completeness
                        for ss_start in range(0, 100, initial_concurrency):
                            ss_batch = range(ss_start, min(ss_start + initial_concurrency, 100))
                            batch_ids = []
                            for ss in ss_batch:
                                prefix12 = f"{base_10}{ss:02d}"
                                c = calculate_kmutnb_check_digit(prefix12)
                                batch_ids.append(f"{prefix12}{c}")
                            
                            results = await batch_probe(batch_ids)
                            for res in results:
                                if res:
                                    all_data.extend(res)
                            if all_data:
                                flush(all_data)
                                all_data = []

                if not major_found:
                    console.print(f"  [dim]CC={cc} MM={major} — no data found[/dim]")

        console.print(f"\n[bold green][+] Hierarchical scan complete. Total new records found: {total_found:,}[/bold green]")
        return total_found


# ──────────────────────────────────────────────
# Main Scan Engine
# ──────────────────────────────────────────────
async def scan_ids_turbo(
    start_id: int, end_id: int,
    stop_threshold: int = 5,
    initial_concurrency: int = 20,
    source: str = "kmutnb",
    adaptive: bool = True,
    db_conn: sqlite3.Connection = None,
    probe_step: int = None,
    hunt_step: int = None,
    pass_label: str = ""
):
    all_data: List[ExamSeat] = []
    total_found = 0
    ids_scanned_count = 0
    total_ids = end_id - start_id + 1
    start_run_time = time.time()
    last_checkpoint_count = 0

    current_concurrency = initial_concurrency
    max_concurrency = 100
    min_concurrency = 5

    target_latency_per_request = 0.2
    max_speed = 0.0
    stability_status = "Stable [green]🟢[/green]"

    # Auto-calibrate based on range: ensure full range is covered in ~5 batches
    if probe_step is None:
        probe_step = max(50, total_ids // (initial_concurrency * 5))
    if hunt_step is None:
        hunt_step = max(10, probe_step // 10)

    scan_state = "PROBING"
    consecutive_misses = 0

    stats_data = {
        "Workers": initial_concurrency, "Found": 0, "DBTotal": 0,
        "CurrentID": start_id, "Speed": "0.0 ID/s", "Peak": "0.0 ID/s",
        "Stability": stability_status, "Elapsed": "00:00:00",
        "TimePerID": "0ms", "State": "PROBING 🛰️", "ETA": "N/A",
        "Finish": "N/A", "SuccessRate": "0.0%", "MissRate": "0.0%",
        "Misses": 0, "Scanned": 0, "Latency": "0ms"
    }

    progress = Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(), TaskProgressColumn(), TimeRemainingColumn(),
        TextColumn("• {task.fields[dhms]}"),
        console=console
    )

    layout = Layout()
    layout.split_column(
        Layout(name="header", size=3),
        Layout(name="stats", size=11),
        Layout(name="progress", size=6),
        Layout(name="logs", size=4)
    )
    layout["header"].update(Panel(
        f"[bold cyan]KMUTNB EXAM SCANNER{' — ' + pass_label if pass_label else ''}[/bold cyan]"
        f" | Range: {start_id} to {end_id}"
        f" | probe_step=[yellow]{probe_step:,}[/yellow]  hunt_step=[yellow]{hunt_step:,}[/yellow]",
        box=box.SIMPLE, style="blue"
    ))
    current_logs = []

    def update_layout(live_ctx=None):
        try:
            layout["stats"].update(Panel(create_stats_table(stats_data), title="Live Statistics Dashboard", border_style="bright_blue"))
            layout["progress"].update(Panel(progress, title="Real-time Tracking", border_style="bright_magenta"))
            log_text = "\n".join(current_logs[-2:]) if current_logs else "Waiting for events..."
            layout["logs"].update(Panel(log_text, title="Latest System Alert", border_style="yellow"))
            if live_ctx is not None:
                live_ctx.refresh()
        except Exception as e:
            import sys
            print(f"[UI Error] {type(e).__name__}: {e}", file=sys.stderr)

    def checkpoint_save(force: bool = False):
        """Save newly found records to SQLite as a checkpoint."""
        nonlocal last_checkpoint_count
        new_records = all_data[last_checkpoint_count:]
        if new_records and (force or len(all_data) - last_checkpoint_count >= CHECKPOINT_INTERVAL):
            save_to_db(db_conn, new_records)
            last_checkpoint_count = len(all_data)
            # Get current DB row count
            cursor = db_conn.execute("SELECT COUNT(*) FROM exam_seats")
            count = cursor.fetchone()[0]
            stats_data["DBTotal"] = count
            current_logs.append(f"[{time.strftime('%H:%M:%S')}] [💾] Checkpoint: {count:,} unique records in DB")

    overall_task = progress.add_task("[cyan]Overall Scan", total=total_ids, dhms="Initializing...")
    batch_task = progress.add_task("[magenta]Batch Progress", total=100, dhms="")

    conn_http = aiohttp.TCPConnector(limit=max_concurrency)
    async with aiohttp.ClientSession(connector=conn_http) as session:
        scraper = AsyncEngScraper(session) if source == "eng" else AsyncExamScraper(session)
        current_id = start_id

        with Live(layout, refresh_per_second=4, screen=False) as live:
            update_layout(live)

            try:
                while current_id <= end_id:
                    now = time.time()
                    elapsed_total = now - start_run_time
                    ids_remaining = end_id - current_id
                    display_speed = ids_scanned_count / elapsed_total if elapsed_total > 0 else 0
                    if display_speed > max_speed:
                        max_speed = display_speed
                        stats_data["Peak"] = f"{max_speed:.1f} ID/s"

                    elapsed_str = format_time_dhms(elapsed_total)
                    eta_str = "N/A"
                    finish_time = "N/A"
                    if display_speed > 0:
                        eta_seconds = ids_remaining / display_speed
                        finish_time = time.strftime('%H:%M:%S', time.localtime(now + eta_seconds))
                        eta_str = format_time_dhms(eta_seconds)

                    stats_data.update({
                        "Elapsed": elapsed_str, "ETA": f"{eta_str} left",
                        "Finish": finish_time, "CurrentID": current_id,
                        "Speed": f"{display_speed:.1f} ID/s", "Scanned": ids_scanned_count,
                        "Found": total_found,
                        "SuccessRate": f"{(total_found / ids_scanned_count * 100):.1f}%" if ids_scanned_count > 0 else "0.0%",
                    })

                    # ── PHASE 1: PROBING ────────────────────────────────
                    if scan_state == "PROBING":
                        stats_data["State"] = "PROBING 🛰️"
                        batch_size = current_concurrency
                        current_batch = [sid for sid in [current_id + (i * probe_step) for i in range(batch_size)] if sid <= end_id]
                        if not current_batch:
                            break

                        progress.update(batch_task, total=len(current_batch), completed=0, description=f"[cyan]Probing {current_id}...")
                        update_layout(live)

                        tasks = [scraper.get_exam_seats(str(sid)) for sid in current_batch]
                        results = await asyncio.gather(*tasks, return_exceptions=True)

                        # FIX: Do NOT break on first hit — collect ALL hits in the probe batch
                        first_found_idx = -1
                        for idx, res in enumerate(results):
                            ids_scanned_count += 1
                            if isinstance(res, list) and res:
                                if first_found_idx == -1:
                                    first_found_idx = idx  # remember first for state transition
                                total_found += len(res)
                                all_data.extend(res)
                                current_logs.append(f"[{time.strftime('%H:%M:%S')}] [🎯] Hit: {current_batch[idx]} ({len(res)} seats)")

                        if first_found_idx != -1:
                            # Transition: step back to refine the cluster start
                            current_id = max(start_id, current_batch[first_found_idx] - probe_step)
                            scan_state = "HUNTING"
                            checkpoint_save()
                        else:
                            current_id = current_batch[-1] + probe_step
                            progress.update(overall_task, completed=min(total_ids, current_id - start_id), dhms=f"{eta_str} left")

                    # ── PHASE 2: HUNTING ────────────────────────────────
                    elif scan_state == "HUNTING":
                        stats_data["State"] = "HUNTING 🎯"
                        batch_size = min(current_concurrency, 10)
                        current_batch = [sid for sid in [current_id + (i * hunt_step) for i in range(batch_size)] if sid <= end_id]

                        progress.update(batch_task, total=len(current_batch), completed=0, description="[yellow]Hunting Cluster Start...")
                        update_layout(live)

                        tasks = [scraper.get_exam_seats(str(sid)) for sid in current_batch]
                        results = await asyncio.gather(*tasks, return_exceptions=True)

                        # FIX: Also collect ALL hits in hunt batch
                        first_found_idx = -1
                        for idx, res in enumerate(results):
                            ids_scanned_count += 1
                            if isinstance(res, list) and res:
                                if first_found_idx == -1:
                                    first_found_idx = idx
                                total_found += len(res)
                                all_data.extend(res)

                        if first_found_idx != -1:
                            target_id = current_batch[first_found_idx]
                            current_id = max(start_id, target_id - hunt_step)
                            scan_state = "EXTRACTING"
                            current_logs.append(f"[{time.strftime('%H:%M:%S')}] [📥] Cluster found near {target_id}, extracting...")
                        else:
                            current_id = current_batch[-1] + hunt_step
                            if current_id > end_id:
                                break

                    # ── PHASE 3: EXTRACTING ──────────────────────────────
                    elif scan_state == "EXTRACTING":
                        stats_data["State"] = "EXTRACTING 📥"
                        batch_size = current_concurrency
                        batch_end = min(current_id + batch_size - 1, end_id)
                        current_batch = list(range(current_id, batch_end + 1))

                        progress.update(batch_task, total=len(current_batch), completed=0, description=f"[magenta]Extracting {current_id}-{batch_end}")
                        update_layout(live)

                        batch_start_time = time.time()
                        tasks = [scraper.get_exam_seats(str(sid)) for sid in current_batch]
                        results = await asyncio.gather(*tasks, return_exceptions=True)

                        cluster_ended = False
                        for sid, res in zip(current_batch, results):
                            ids_scanned_count += 1
                            if isinstance(res, list) and res:
                                total_found += len(res)
                                all_data.extend(res)
                                consecutive_misses = 0
                            else:
                                consecutive_misses += 1

                            progress.update(overall_task, completed=min(total_ids, sid - start_id), dhms=f"{eta_str} left")
                            progress.update(batch_task, advance=1)

                            if consecutive_misses >= stop_threshold:
                                current_logs.append(f"[{time.strftime('%H:%M:%S')}] [🏁] Cluster ended at {sid} — resuming PROBING from {sid + 1}")
                                scan_state = "PROBING"
                                # FIX: Resume from sid+1, NOT sid+probe_step
                                # Old code jumped probe_step IDs forward here, skipping any
                                # smaller clusters that exist in that gap.
                                current_id = sid + 1
                                consecutive_misses = 0
                                cluster_ended = True
                                break

                        # Periodic checkpoint during extraction
                        checkpoint_save()

                        if not cluster_ended:
                            current_id = batch_end + 1

                        batch_elapsed = time.time() - batch_start_time
                        if adaptive and batch_elapsed > 0:
                            if batch_elapsed > (target_latency_per_request * len(current_batch)) * 1.5:
                                current_concurrency = max(min_concurrency, int(current_concurrency * 0.8))
                                stability_status = "Throttled [yellow]🟡[/yellow]"
                            elif batch_elapsed < (target_latency_per_request * len(current_batch)):
                                current_concurrency = min(max_concurrency, current_concurrency + 2)
                                stability_status = "Stable [green]🟢[/green]"
                            stats_data["Workers"] = current_concurrency
                            stats_data["Stability"] = stability_status
                            stats_data["Latency"] = f"{int(batch_elapsed/len(current_batch)*1000)}ms"
                        stats_data["Misses"] = consecutive_misses

                    update_layout(live)

            except (asyncio.CancelledError, KeyboardInterrupt):
                current_logs.append(f"[{time.strftime('%H:%M:%S')}] [🛑] Scan interrupted — saving checkpoint...")
                checkpoint_save(force=True)
                update_layout(live)
            except Exception as e:
                current_logs.append(f"[{time.strftime('%H:%M:%S')}] [❌] Error: {str(e)}")
                checkpoint_save(force=True)
                update_layout(live)

    # Final save of any remaining records
    checkpoint_save(force=True)

    total_time = time.time() - start_run_time
    avg_speed = ids_scanned_count / total_time if total_time > 0 else 0
    console.print("\n" + "=" * 50, style="blue")
    console.print(f"📊 [bold]FINAL SCAN SUMMARY ({source.upper()})[/bold]", style="blue")
    console.print("=" * 50, style="blue")
    console.print(f"🏁 Range Scanned : [white]{start_id} -> {stats_data['CurrentID']}[/white]")
    console.print(f"🔍 Scanned/Found : [white]{ids_scanned_count}/{total_found}[/white]")
    console.print(f"💾 DB Total Unique: [bold green]{stats_data['DBTotal']}[/bold green]")
    console.print("=" * 50 + "\n", style="blue")
    return all_data


# ──────────────────────────────────────────────
# Custom Help Menu
# ──────────────────────────────────────────────
def print_custom_help():
    help_text = """
[bold cyan]KMUTNB EXAM SCANNER (TURBO MODE) - HELP GUIDE[/bold cyan]

[bold yellow]How to Run the Program:[/bold yellow]
1. [green]Interactive Mode (Recommended)[/green]
   Simply run: [bold white]python3 turbo_main.py[/bold white]
   The program will ask you step-by-step for the Student ID range and what to do.

2. [green]Exporting Data to CSV/Excel (For Looker Studio)[/green]
   If you already scanned and just want to get the files:
   [bold white]python3 turbo_main.py --export-only --export-csv --export-excel[/bold white]

3. [green]Command-Line Mode (For Automation)[/green]
   Run it directly by passing arguments:
   [bold white]python3 turbo_main.py --source kmutnb --start 6701091610000 --end 6701091619999 --export-csv[/bold white]

[bold yellow]Available Arguments:[/bold yellow]
  --start          Start Student ID (e.g. 6701091610000)
  --end            End Student ID
  --threshold      Stop scanning after N consecutive missing IDs (default 10000)
  --concurrency    Initial concurrent requests (default 20)
  --source         "kmutnb" (University-wide) or "eng" (Engineering Faculty)
  --no-adaptive    Disable adaptive concurrency
  --export-csv     Export SQLite DB to CSV after scanning
  --export-excel   Export SQLite DB to Excel after scan
  --export-only    Skip scanning, ONLY export the existing database
  --db             Custom path to the SQLite database file
  --hierarchical   Use 3-layer hierarchical scan instead of sequential
  --input          Path to CSV/TXT file containing student IDs
  --year           Enrollment year prefix for hierarchical scan (default: 67)

[bold yellow]Tips:[/bold yellow]
- The program uses a strategic "Jump Search" to scan billions of IDs quickly.
- All scanned IDs are safely saved in `exam_seats.db` to prevent data loss.
- You can press [bold red]Ctrl+C[/bold red] to stop scanning midway. Data will be saved!
"""
    console.print(Panel(help_text, title="📖 Help / Instructions", border_style="bright_blue"))

# ──────────────────────────────────────────────
# CLI Entry Point
# ──────────────────────────────────────────────
async def main():
    load_dotenv()

    # Intercept custom help flags before argparse throws errors for positional args
    if len(sys.argv) > 1 and sys.argv[1].lower() in ["help", "/help", "-h", "--help"]:
        print_custom_help()
        return

    import argparse
    parser = argparse.ArgumentParser(description="Exam Seat Data Scraper (Turbo Mode)", add_help=False)
    parser.add_argument("--start", type=int, help="Start Student ID")
    parser.add_argument("--end", type=int, help="End Student ID")
    parser.add_argument("--threshold", type=int, help="Stop Threshold (consecutive misses before leaving cluster)")
    parser.add_argument("--concurrency", type=int, default=10, help="Initial concurrent requests (Mac OS cap highly recommended: 50 max)")
    parser.add_argument("--source", type=str, choices=["kmutnb", "eng"], help="Data source: kmutnb | eng")
    parser.add_argument("--no-adaptive", action="store_true", help="Disable adaptive concurrency")
    parser.add_argument("--export-csv", action="store_true", help="Export DB to CSV after scan")
    parser.add_argument("--export-excel", action="store_true", help="Export DB to Excel after scan")
    parser.add_argument("--export-only", action="store_true", help="Skip scan, just export existing DB data")
    parser.add_argument("--db", type=str, default=DB_FILE, help="SQLite database file path")
    parser.add_argument("--hierarchical", action="store_true", help="Use 3-layer hierarchical scan instead of sequential")
    parser.add_argument("--input", type=str, help="Path to CSV/TXT file containing student IDs")
    parser.add_argument("--year", type=str, default="67", help="Enrollment year prefix for hierarchical scan (default: 67)")

    args = parser.parse_args()
    adaptive = not args.no_adaptive

    # 1. Determine Source first so we can dynamically name outputs
    source = args.source
    if source is None:
        source_input = console.input("[bold cyan]Select Source (1: KMUTNB-Wide, 2: Engineering Faculty, default 1): [/bold cyan]").strip()
        source = "eng" if source_input == "2" else "kmutnb"

    # 2. Setup dynamic DB Path
    db_path = args.db
    if db_path == DB_FILE:
        db_path = f"exam_seats_{source}.db"

    # Export-only mode — no scan
    if args.export_only:
        console.print("[bold cyan][+] Export-only mode[/bold cyan]")
        if args.export_csv:
            export_to_csv(db_path)
        if args.export_excel:
            export_to_excel(db_path)
        if not args.export_csv and not args.export_excel:
            console.print("[yellow]No export format specified. Use --export-csv or --export-excel[/yellow]")
        return

    # Initialize SQLite
    db_conn = init_db(db_path)
    try:
        cursor = db_conn.execute("SELECT COUNT(*) FROM exam_seats")
        existing_count = cursor.fetchone()[0]
        console.print(f"[cyan][📂] Database: {db_path}  ({existing_count:,} existing records)[/cyan]")
    except Exception as e:
        console.print(f"[red][!] Error checking DB: {e}[/red]")
        sys.exit(1)

    start_id = args.start
    end_id = args.end
    input_ids = []
    student_names_map = {}

    if args.input:
        path = args.input
        if not os.path.exists(path):
            console.print(f"[red][!] Error: File not found: {path}[/red]")
            return
        
        try:
            with open(path, mode='r', encoding='utf-8-sig') as f:
                # Try to detect if it's CSV or plain list
                if path.endswith('.csv'):
                    reader = csv.DictReader(f)
                    if 'student_id' in reader.fieldnames:
                        for row in reader:
                            sid = row['student_id']
                            input_ids.append(sid)
                            if 'student_name' in row:
                                student_names_map[sid] = row['student_name']
                    else:
                        # Fallback to first column
                        f.seek(0)
                        reader = csv.reader(f)
                        next(reader)  # skip header if possible
                        for row in reader:
                            if row:
                                input_ids.append(row[0])
                else:
                    input_ids = [line.strip() for line in f if line.strip()]
            
            console.print(f"[green][📂] Loaded {len(input_ids):,} student IDs from {path}[/green]")
        except Exception as e:
            console.print(f"[red][!] Error reading file: {str(e)}[/red]")
            return

    elif not args.hierarchical: # This block now handles the "sequential" or range-based scan
        if start_id is None:
            while True:
                val = console.input("[bold cyan]Enter Start Student ID (13 digits, default 6701091610000): [/bold cyan]").strip()
                if not val:
                    start_id = 6701091610000
                    break
                if len(val) == 13 and val.isdigit():
                    start_id = int(val)
                    break
                console.print("[red]Error: Student ID must be exactly 13 digits.[/red]")

        if end_id is None:
            while True:
                val = console.input("[bold cyan]Enter End Student ID (13 digits, default 6701091619999): [/bold cyan]").strip()
                if not val:
                    end_id = 6701091619999
                    break
                if len(val) == 13 and val.isdigit():
                    end_id = int(val)
                    break
                console.print("[red]Error: Student ID must be exactly 13 digits.[/red]")

    threshold = args.threshold
    if threshold is None and not args.input and not args.hierarchical:
        val = console.input("[bold cyan]Enter Stop Threshold (consecutive misses before leaving cluster, default 10000): [/bold cyan]").strip()
        threshold = int(val) if val else 10000
    elif threshold is None: # Default threshold if not provided, and not interactive for it
        threshold = 10000

    if not args.hierarchical and not args.input and (end_id - start_id) > 1_000_000:
        console.print(f"[bold yellow]⚠️ WARNING: You are about to scan {end_id - start_id + 1:,} IDs.[/bold yellow]")
        confirm = console.input("[bold red]This is a very large range. Are you sure? (y/n): [/bold red]").strip().lower()
        if confirm != 'y':
            console.print("[yellow]Scan cancelled by user.[/yellow]")
            db_conn.close()
            return

    total_start = time.time()
    try:
        if args.input:
            console.print(f"\n[bold magenta]🚀 Starting List-Based Scan ({len(input_ids)} IDs)[/bold magenta]")
            await scan_ids_from_list(
                student_ids=input_ids,
                source=source,
                db_conn=db_conn,
                initial_concurrency=args.concurrency,
                student_names_map=student_names_map
            )
        elif args.hierarchical:
            console.print(f"\n[bold magenta]🚀 Starting Hierarchical Scan (Year {args.year})[/bold magenta]")
            await hierarchical_scan(
                year=args.year,
                source=source,
                db_conn=db_conn,
                initial_concurrency=args.concurrency
            )
        else: # This is the default sequential 3-pass scan if no --input or --hierarchical
            console.print(f"\n[bold magenta]🚀 Starting Sequential 3-Pass Scan - DEFAULT MODE[/bold magenta]")
            # ── 3-Pass Adaptive Multi-Pass Scan ──────────────────────────────
            # Each pass covers the range more densely than the previous.
            # Next pass only runs if the previous pass found ZERO NEW records.
            range_size = end_id - start_id + 1
            passes = [
                # (probe_step, hunt_step, label)
                (max(50, range_size // (args.concurrency * 5)),   None,  "Pass 1/3 — Wide Scan 🛰️"),
                (max(20, range_size // (args.concurrency * 50)),  None,  "Pass 2/3 — Medium Scan 🎯"),
                (max(10, range_size // (args.concurrency * 500)), None,  "Pass 3/3 — Dense Scan 📥"),
            ]

            any_pass_found_data = False
            for p_step, h_step, label in passes:
                console.print(f"\n[bold cyan]━━━ {label} (probe_step={p_step:,}) ━━━[/bold cyan]")

                # FIX: Snapshot DB count BEFORE this pass to detect only NEW records
                cursor = db_conn.execute("SELECT COUNT(*) FROM exam_seats")
                count_before_pass = cursor.fetchone()[0]

                await scan_ids_turbo(
                    start_id, end_id, threshold,
                    initial_concurrency=args.concurrency,
                    source=source,
                    adaptive=adaptive,
                    db_conn=db_conn,
                    probe_step=p_step,
                    hunt_step=h_step,
                    pass_label=label
                )

                # Count only records found in THIS pass
                cursor = db_conn.execute("SELECT COUNT(*) FROM exam_seats")
                count_after_pass = cursor.fetchone()[0]
                new_records = count_after_pass - count_before_pass

                if new_records > 0:
                    any_pass_found_data = True
                    console.print(f"[bold green]✅ {label}: Found [bold]{new_records:,}[/bold] new seat record(s)! "
                                   f"Total in DB: {count_after_pass:,}[/bold green]")
                    # Don't break — the scan already covered the full range in this pass.
                    # Next pass only needed if ZERO found in this pass.
                    break
                else:
                    console.print(f"[yellow]⚠️  {label}: No new data found in this range. "
                                   f"Trying denser scan...[/yellow]")

            if not any_pass_found_data:
                console.print("\n[bold red]🔍 All 3 passes complete — No data found in this range.[/bold red]")
                console.print("[dim]Possible reasons: ID range may be wrong, server may be down, "
                              "or these IDs have no exam seat assigned.[/dim]")

        console.print(f"\n[bold green]Total time elapsed: {time.time() - total_start:.2f}s[/bold green]")

        # Auto-export after scan
        if args.export_csv:
            export_to_csv(db_path)
        if args.export_excel:
            export_to_excel(db_path)

        # Always ask the user if they want to export
        if not args.export_csv and not args.export_excel:
            choice = console.input("\n[bold cyan]Export data? (1: CSV, 2: Excel, 3: Both, Enter to skip): [/bold cyan]").strip()
            if choice in ("1", "3"):
                export_to_csv(db_path)
            if choice in ("2", "3"):
                export_to_excel(db_path)

    except asyncio.CancelledError:
        console.print("\n[bold red]🛑 Scan Cancelled (Async Task Cancelled)[/bold red]")
    except KeyboardInterrupt:
        console.print("\n[bold red]🛑 Scan Interrupted by user (Ctrl+C)[/bold red]")
    except Exception as e:
        console.print(f"\n[bold red]❌ Unexpected Error: {str(e)}[/bold red]")
    finally:
        db_conn.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
