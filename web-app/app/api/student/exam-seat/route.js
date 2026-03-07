import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/lib/auth';
import * as cheerio from 'cheerio';

/**
 * API Route: /api/student/exam-seat
 * 
 * วัตถุประสงค์: ดึงข้อมูลที่นั่งสอบของนักศึกษา จาก CSV (exam_seats_kmutnb.csv)
 * 
 * Query Params:
 * - courseCode (optional): ถ้าส่งมา จะดึงข้อมูลเพื่อนร่วมห้องทุกคนในวิชานั้น (เพื่อนำไปทำ Seat Map Grid)
 * 
 * Logic:
 * 1. อ่าน studentId จาก profile cookie
 * 2. ค้นหาใน CSV ว่านักศึกษาคนนี้สอบวิชาอะไรบ้าง (ถ้าไม่ส่ง courseCode)
 * 3. ถ้าส่ง courseCode จะดึง *ทุกคน* ที่สอบวิชานั้นใน section/ห้อง/เวลาเดียวกัน ออกมาให้หมดเพื่อจัดผังที่นั่ง
 */

function parseCsvLine(line) {
    // Csv parser that handles commas inside quotes
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    const cols = line.split(regex).map(col => col.replace(/^"|"$/g, '').trim());

    if (cols.length < 12) return null;

    let rowRaw = cols[10];
    let seatRaw = cols[11];
    let parsedRow = parseInt(rowRaw, 10);
    let parsedSeat = parseInt(seatRaw, 10);
    let seatLabel = seatRaw;

    // Detect Engineering format: e.g. "G7(Row → G, Column ↓ 7)"
    if (rowRaw === 'N/A' && typeof seatRaw === 'string') {
        const match = seatRaw.match(/^([a-zA-Z]+)(\d+)/);
        if (match) {
            const rowAlpha = match[1].toUpperCase();
            const seatNum = parseInt(match[2], 10);

            // convert A-Z to number (A=1, B=2, ..., Z=26)
            let rowNum = 0;
            for (let i = 0; i < rowAlpha.length; i++) {
                rowNum = rowNum * 26 + (rowAlpha.charCodeAt(i) - 64);
            }
            parsedRow = rowNum;
            parsedSeat = seatNum;
            seatLabel = match[0]; // e.g. "G7"
        }
    } else {
        seatLabel = `R${rowRaw}-S${seatRaw}`;
    }

    return {
        student_id: cols[0],
        student_name: cols[1],
        exam_date: cols[2],
        exam_time: cols[3],
        course_code: cols[4],
        course_name: cols[5],
        section: cols[6],
        room: cols[7],
        floor: cols[8],
        building: cols[9],
        row: rowRaw,
        seat: seatRaw,
        parsedRow: isNaN(parsedRow) ? 0 : parsedRow,
        parsedSeat: isNaN(parsedSeat) ? 0 : parsedSeat,
        seatLabel: seatLabel
    };
}

export async function GET(request) {
    try {
        const url = new URL(request.url);
        const targetCourseCode = url.searchParams.get('courseCode');

        // 1. ตรวจสอบ Auth จาก lib/auth.js
        const studentId = await getAuthUser();

        if (!studentId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const sanitizedStudentId = studentId.replace(/^s/i, '');

        // 2. Load CSV Data
        const kmutnbPath = path.join(process.cwd(), 'data', 'exam_seats_kmutnb.csv');
        const engPath = path.join(process.cwd(), 'data', 'exam_seats_eng.csv');

        let kmutnbData = '';
        let engData = '';

        try {
            kmutnbData = await fs.readFile(kmutnbPath, 'utf8');
        } catch (err) {
            console.warn('[Exam Seat API] Cannot read KMUTNB CSV file:', err);
        }

        try {
            engData = await fs.readFile(engPath, 'utf8');
        } catch (err) {
            console.warn('[Exam Seat API] Cannot read ENG CSV file:', err);
        }

        if (!kmutnbData && !engData) {
            return NextResponse.json({ error: 'Data source unavailable' }, { status: 500 });
        }

        const lines = [
            ...(kmutnbData ? kmutnbData.split('\n').slice(1) : []),
            ...(engData ? engData.split('\n').slice(1) : [])
        ];

        const records = [];

        // Parsing Process
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const record = parseCsvLine(line);
            if (record) records.push(record);
        }

        // 3. Logic: Find User's Seat OR Generate Exam Room Seat Map
        if (targetCourseCode) {
            // โหมด Seat Map: ดึงผังที่นั่งของรายวิชานั้น (เฉพาะ section และห้องที่ user สอบ)
            // ขั้นแรก: หาสถานที่สอบของ User ในวิชานี้ก่อน
            const userTargetRecord = records.find(r => r.student_id === sanitizedStudentId && r.course_code === targetCourseCode);

            if (!userTargetRecord) {
                return NextResponse.json({ error: 'Student not found in this exam course' }, { status: 404 });
            }

            // ขั้นสอง: ดึงทุกคนที่สอบใน "ตึก + ชั้น + ห้อง + วันที่ + เวลา" เดียวกันเป๊ะๆ (ข้ามวิชา/สาขา)
            // หากสถานที่สอบเป็น N/A ไม่ระบุ จะเปลี่ยนไปดึงเฉพาะคนที่สอบวิชาเดียวกันแทน เพื่อป้องกันการจับกลุ่มรวมกับวิชาอื่นที่ยังไม่จัดห้องสอบ
            const peers = records.filter(r => {
                const sameTime = r.exam_date === userTargetRecord.exam_date && r.exam_time === userTargetRecord.exam_time;
                if (!sameTime) return false;

                if (userTargetRecord.room === 'N/A' || userTargetRecord.building === 'N/A') {
                    // หากยังไม่มีห้องที่แน่ชัด ให้จำกัดว่าเป็นเพื่อนสอบถ้าเป็นวิชาเดียวกันเท่านั้น (fallback)
                    return r.course_code === userTargetRecord.course_code;
                }

                return r.room === userTargetRecord.room &&
                    r.floor === userTargetRecord.floor &&
                    r.building === userTargetRecord.building;
            });

            // คำนวณขนาดผังห้องสอบ (maxRow, maxSeat)
            let maxRow = 0;
            let maxSeat = 0;
            let fromScraper = false;

            try {
                // Try to fetch true dimensions from the Engineering portal (100% Mirroring)
                const formData = new URLSearchParams();
                formData.append('student_id', sanitizedStudentId);

                const res = await fetch('https://www.eng.kmutnb.ac.th/eservice/exam/seating', {
                    method: 'POST',
                    body: formData,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    signal: AbortSignal.timeout(5000) // 5s timeout
                });

                if (res.ok) {
                    const html = await res.text();
                    const $ = cheerio.load(html);

                    $('.media-body').each((i, el) => {
                        const courseText = $(el).find('strong.text-gray-dark').first().text().trim();
                        if (courseText.includes(targetCourseCode)) {
                            // Found the targeted exam section
                            $(el).find('.seatmap-colnum').each((j, colEl) => {
                                const val = parseInt($(colEl).text().trim(), 10);
                                if (!isNaN(val) && val > maxSeat) maxSeat = val;
                            });

                            $(el).find('.seatmap-rownum').each((j, rowEl) => {
                                const char = $(rowEl).text().trim();
                                if (char && char.match(/[A-Za-z]/)) {
                                    const val = char.toUpperCase().charCodeAt(0) - 64; // A=1
                                    if (val > maxRow) maxRow = val;
                                }
                            });
                            fromScraper = true;
                        }
                    });
                }
            } catch (err) {
                console.warn('[Exam Seat API] Cheerio scrape failed:', err);
            }

            // Fallback to auto-scaling from peers if scraper didn't find specific grid sizes
            if (!fromScraper || maxRow === 0 || maxSeat === 0) {
                maxRow = 0;
                maxSeat = 0;
                peers.forEach(p => {
                    if (p.parsedRow > maxRow) maxRow = p.parsedRow;
                    if (p.parsedSeat > maxSeat) maxSeat = p.parsedSeat;
                });
            }

            return NextResponse.json({
                courseInfo: {
                    courseCode: userTargetRecord.course_code,
                    courseName: userTargetRecord.course_name,
                    examDate: userTargetRecord.exam_date,
                    examTime: userTargetRecord.exam_time,
                    location: `อาคาร ${userTargetRecord.building} ชั้น ${userTargetRecord.floor} ห้อง ${userTargetRecord.room}`,
                },
                currentUserDetails: {
                    studentId: userTargetRecord.student_id,
                    name: userTargetRecord.student_name,
                    row: userTargetRecord.parsedRow,
                    seat: userTargetRecord.parsedSeat,
                    seatLabel: userTargetRecord.seatLabel
                },
                gridDimensions: {
                    rows: maxRow,
                    cols: maxSeat
                },
                isEngineering: fromScraper,
                seats: peers.map(p => ({
                    studentId: p.student_id,
                    name: p.student_name,
                    row: p.parsedRow,
                    seat: p.parsedSeat,
                    seatLabel: p.seatLabel,
                    section: p.section
                }))
            });

        } else {
            // โหมด Overview: ดูว่า User คนนี้สอบวิชาอะไรบ้าง (ตารางสอบของฉัน)
            const userRecords = records.filter(r => r.student_id === sanitizedStudentId);

            const userExams = userRecords.map(r => ({
                courseCode: r.course_code,
                courseName: r.course_name,
                examDate: r.exam_date,
                examTime: r.exam_time,
                location: `อาคาร ${r.building} ชั้น ${r.floor} ห้อง ${r.room}`,
                mySeat: `ที่นั่ง ${r.seatLabel}`
            }));

            return NextResponse.json({
                studentId: studentId,
                exams: userExams
            });
        }

    } catch (error) {
        console.error('[Exam Seat API] Error:', error);
        return NextResponse.json({ error: 'Internal server error', details: error.message, stack: error.stack }, { status: 500 });
    }
}
