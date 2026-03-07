import os
import pandas as pd
from dotenv import load_dotenv
from scraper import ExamScraper
from models import ExamSeat
from typing import List
import argparse

from concurrent.futures import ThreadPoolExecutor, as_completed

def scan_ids_parallel(start_id: int, end_id: int, stop_threshold: int = 5, workers: int = 10, batch_size: int = 20):
    scraper = ExamScraper(delay=0)
    all_data = []
    consecutive_misses = 0
    total_found = 0
    
    print(f"Starting parallel scan from {start_id} to {end_id}...")
    print(f"Using {workers} workers and batch size of {batch_size}.")
    
    current_start = start_id
    while current_start <= end_id:
        batch_end = min(current_start + batch_size - 1, end_id)
        batch_range = range(current_start, batch_end + 1)
        
        print(f"Batch: {current_start} - {batch_end} | Scanning...", end=" ", flush=True)
        
        batch_results = {}
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_id = {executor.submit(scraper.get_exam_seats, str(sid)): sid for sid in batch_range}
            for future in as_completed(future_to_id):
                sid = future_to_id[future]
                try:
                    batch_results[sid] = future.result()
                except Exception:
                    batch_results[sid] = []
        
        # Process results in order to check stop condition
        batch_found_in_loop = 0
        stop_triggered = False
        for sid in sorted(batch_range):
            seats = batch_results.get(sid, [])
            if not seats:
                consecutive_misses += 1
            else:
                consecutive_misses = 0
                all_data.extend(seats)
                batch_found_in_loop += len(seats)
                total_found += len(seats)
            
            if consecutive_misses >= stop_threshold:
                stop_triggered = True
                break
        
        print(f"Found {batch_found_in_loop} exams. Consecutive misses: {consecutive_misses}")
        
        if stop_triggered:
            print(f"\nStopped: {stop_threshold} consecutive IDs with no data.")
            break
            
        current_start = batch_end + 1
            
    return all_data

def save_to_excel(data: List[ExamSeat], filename: str = "exam_seat_data.xlsx"):
    if not data:
        print("No new data to save.")
        return
        
    # Convert new data to DataFrame
    new_df = pd.DataFrame([vars(seat) for seat in data])
    
    # Check if file exists to decide whether to append or create
    if os.path.exists(filename):
        try:
            print(f"Reading existing data from {filename}...")
            existing_df = pd.read_excel(filename)
            # Concatenate existing and new data
            combined_df = pd.concat([existing_df, new_df], ignore_index=True)
            print(f"Merged {len(new_df)} new entries with {len(existing_df)} existing entries.")
        except Exception as e:
            print(f"Error reading existing file {filename}: {e}. Creating new file instead.")
            combined_df = new_df
    else:
        combined_df = new_df

    # Remove duplicates based on unique identifiers
    # We use student_id, course_code, and exam_date to identify a unique exam seat record
    initial_count = len(combined_df)
    combined_df = combined_df.drop_duplicates(subset=['student_id', 'course_code', 'exam_date'], keep='first')
    removed_count = initial_count - len(combined_df)
    
    if removed_count > 0:
        print(f"Removed {removed_count} duplicate entries.")

    # Reorder columns for consistency
    columns_order = [
        'student_id', 'exam_date', 'exam_time', 'course_code', 'course_name', 
        'section', 'room', 'floor', 'building', 'row', 'seat'
    ]
    # Ensure all columns exist before reordering
    existing_cols = [col for col in columns_order if col in combined_df.columns]
    combined_df = combined_df[existing_cols]
    
    # Save back to Excel
    combined_df.to_excel(filename, index=False)
    print(f"All unique data ({len(combined_df)} entries) saved to {filename}")


if __name__ == "__main__":
    load_dotenv()
    
    parser = argparse.ArgumentParser(description="Exam Seat Data Scraper (Parallel)")
    parser.add_argument("--start", type=int, help="Start Student ID")
    parser.add_argument("--end", type=int, help="End Student ID")
    parser.add_argument("--threshold", type=int, help="Stop Threshold")
    parser.add_argument("--workers", type=int, default=10, help="Number of parallel workers")
    parser.add_argument("--test-id", type=str, help="Specific ID to test")
    
    args = parser.parse_args()
    
    if args.test_id:
        scraper = ExamScraper()
        results = scraper.get_exam_seats(args.test_id)
        if results:
            print(f"Found {len(results)} exams for {args.test_id}")
            save_to_excel(results, f"test_{args.test_id}.xlsx")
        else:
            print(f"No results for {args.test_id}")
    else:
        start_id = args.start
        if start_id is None:
            val = input("Enter Start Student ID (default 6701091610000): ").strip()
            start_id = int(val) if val else 6701091610000
            
        end_id = args.end
        if end_id is None:
            val = input("Enter End Student ID (default 6701091619999): ").strip()
            end_id = int(val) if val else 6701091619999
            
        threshold = args.threshold
        if threshold is None:
            val = input("Enter Stop Threshold (default 5): ").strip()
            threshold = int(val) if val else 5

        results = scan_ids_parallel(start_id, end_id, stop_threshold=threshold, workers=args.workers)
        save_to_excel(results)


