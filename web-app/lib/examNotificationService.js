import fs from 'fs/promises';
import { getDataPath } from './runtimePaths.mjs';

function parseCsvLine(line) {
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    const cols = line.split(regex).map((col) => col.replace(/^"|"$/g, '').trim());

    if (cols.length < 12) return null;

    let rowRaw = cols[10];
    let seatRaw = cols[11];
    let parsedRow = parseInt(rowRaw, 10);
    let parsedSeat = parseInt(seatRaw, 10);
    let seatLabel = seatRaw;

    if (rowRaw === 'N/A' && typeof seatRaw === 'string') {
        const match = seatRaw.match(/^([a-zA-Z]+)(\d+)/);
        if (match) {
            const rowAlpha = match[1].toUpperCase();
            const seatNum = parseInt(match[2], 10);
            let rowNum = 0;
            for (let index = 0; index < rowAlpha.length; index += 1) {
                rowNum = rowNum * 26 + (rowAlpha.charCodeAt(index) - 64);
            }
            parsedRow = rowNum;
            parsedSeat = seatNum;
            seatLabel = match[0];
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
        parsedRow: Number.isNaN(parsedRow) ? 0 : parsedRow,
        parsedSeat: Number.isNaN(parsedSeat) ? 0 : parsedSeat,
        seatLabel,
    };
}

async function readSeatCsv(path) {
    try {
        return await fs.readFile(path, 'utf8');
    } catch {
        return '';
    }
}

export async function listStudentExamNotifications(userCode) {
    const normalizedUserCode = String(userCode || '').trim().replace(/^s/i, '');
    if (!normalizedUserCode) return [];

    const kmutnbPath = getDataPath('exam_seats_kmutnb.csv');
    const engPath = getDataPath('exam_seats_eng.csv');
    const [kmutnbData, engData] = await Promise.all([
        readSeatCsv(kmutnbPath),
        readSeatCsv(engPath),
    ]);

    if (!kmutnbData && !engData) return [];

    const lines = [
        ...(kmutnbData ? kmutnbData.split('\n').slice(1) : []),
        ...(engData ? engData.split('\n').slice(1) : []),
    ];

    const exams = [];
    for (const sourceLine of lines) {
        const line = sourceLine.trim();
        if (!line) continue;
        const record = parseCsvLine(line);
        if (!record || record.student_id !== normalizedUserCode) continue;
        exams.push({
            id: `exam-seat:${record.course_code}:${record.exam_date}:${record.exam_time}`,
            courseCode: record.course_code,
            courseName: record.course_name,
            examDate: record.exam_date,
            examTime: record.exam_time,
            location: `อาคาร ${record.building} ชั้น ${record.floor} ห้อง ${record.room}`,
            mySeat: `ที่นั่ง ${record.seatLabel}`,
        });
    }

    return exams;
}
