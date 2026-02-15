import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import https from 'https';
import axios from 'axios';

/**
 * API Route: /api/student/courses
 * 
 * วัตถุประสงค์: ดึงข้อมูลวิชาที่ลงเรียนในเทอมปัจจุบัน
 * 
 * External API ที่ใช้:
 * 1. Grade/Showgrade - ดึงประวัติเกรดทั้งหมดของนักศึกษา
 *    - URL: https://reg4.kmutnb.ac.th/regapiweb2/api/th/Grade/Showgrade
 *    - Method: GET
 *    - Authentication: Bearer token (จาก login)
 *    - Response: Array of { acadyear, semester, coursecode, coursename, creditattempt, grade, ... }
 * 
 * 2. Schg/Getacadstd - ดึงข้อมูลเทอมปัจจุบันของนักศึกษา
 *    - URL: https://reg4.kmutnb.ac.th/regapiweb2/api/th/Schg/Getacadstd
 *    - Method: GET
 *    - Response: { enrollsemester, enrollacadyear, ... }
 * 
 * Logic:
 * - กรองวิชาจาก Grade/Showgrade ที่ตรงกับเทอมปัจจุบัน (enrollsemester, enrollacadyear)
 * - วิชาที่ลงเรียนปัจจุบันจะมี grade = null หรือยังไม่ได้เกรด
 * - Return: รายการวิชาพร้อมข้อมูล coursecode, coursename, creditattempt, section
 */

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';
const agent = new https.Agent({ rejectUnauthorized: false });

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('reg_token')?.value;

    // Mock data fallback
    if (process.env.MOCK_AUTH === 'true' || !token) {
        return NextResponse.json({
            success: true,
            data: [{
                coursecode: '010123102',
                coursename: 'การเขียนโปรแกรมคอมพิวเตอร์',
                creditattempt: 3,
                sectioncode: '1',
                acadyear: 2568,
                semester: 2
            }],
            semester: '2/2568'
        });
    }

    const apiConfig = {
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        httpsAgent: agent,
        validateStatus: () => true,
        timeout: 10000
    };

    try {
        // Call both APIs in parallel
        const [acadRes, gradeRes] = await Promise.allSettled([
            axios.get(`${BASE_URL}/Schg/Getacadstd`, apiConfig),      // ข้อมูลเทอมปัจจุบัน
            axios.get(`${BASE_URL}/Grade/Showgrade`, apiConfig)       // ประวัติเกรดทั้งหมด
        ]);

        // Extract current semester info
        let currentSemester = null;
        let currentAcadYear = null;
        let semesterDisplay = '2/2568';

        if (acadRes.status === 'fulfilled' && acadRes.value?.status === 200) {
            const acad = acadRes.value.data;
            currentSemester = acad.enrollsemester;
            currentAcadYear = acad.enrollacadyear;
            if (currentSemester && currentAcadYear) {
                semesterDisplay = `${currentSemester}/${currentAcadYear}`;
            }
        }

        // Process grade data
        if (gradeRes.status !== 'fulfilled' || gradeRes.value?.status !== 200) {
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch course data',
                statusCode: gradeRes.value?.status || 502
            }, { status: gradeRes.value?.status || 502 });
        }

        const allCourses = gradeRes.value.data;
        if (!Array.isArray(allCourses)) {
            return NextResponse.json({ success: true, data: [], semester: semesterDisplay });
        }

        // Filter courses for current semester
        // วิชาที่ลงเรียนปัจจุบัน = semester + acadyear ตรงกับเทอมปัจจุบัน
        const enrolledCourses = allCourses
            .filter(course => {
                // กรอง summary rows (coursecode ว่าง หรือ coursename มี "TOTAL")
                if (!course.coursecode || course.coursecode.trim() === '') return false;
                if (course.coursename && course.coursename.includes('TOTAL')) return false;
                
                // ถ้ารู้เทอมปัจจุบัน ให้กรองตามเทอม
                if (currentSemester && currentAcadYear) {
                    return course.semester === currentSemester && 
                           course.acadyear === currentAcadYear;
                }
                // ถ้าไม่รู้ ให้เอาวิชาที่ยังไม่มีเกรดล่าสุด
                return !course.grade || course.grade === '';
            })
            .map(course => ({
                coursecode: course.coursecode,
                coursename: course.coursename,
                creditattempt: course.creditattempt,
                sectioncode: course.sectioncode,
                acadyear: course.acadyear,
                semester: course.semester,
                grade: course.grade || null,  // null = ยังไม่มีเกรด (กำลังเรียนอยู่)
                courseid: course.courseid
            }));

        return NextResponse.json({
            success: true,
            data: enrolledCourses,
            semester: semesterDisplay,
            currentAcadYear,
            currentSemester
        });

    } catch (error) {
        console.error('[Courses API] Error:', error.message);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch enrolled courses',
            details: error.message
        }, { status: 500 });
    }
}
