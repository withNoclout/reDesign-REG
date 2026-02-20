import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import https from 'https';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);
const BASE_URL = 'https://reg1.kmutnb.ac.th/regapiweb3/api/th';

// Ignore self-signed certs
const agent = new https.Agent({ rejectUnauthorized: false });

const evalCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('reg_token')?.value;
        const stdCode = cookieStore.get('std_code')?.value;

        if (!token) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Cache check
        if (stdCode) {
            const cached = evalCache.get(stdCode);
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
                return NextResponse.json({ success: true, data: cached.data });
            }
        }

        const config = {
            headers: { 'Authorization': `Bearer ${token}` },
            httpsAgent: agent,
            timeout: 5000,
            validateStatus: () => true
        };

        const res = await axios.get(`${BASE_URL}/Evaluateofficer/Class`, config);

        if (res.status === 200 && res.data?.result) {
            const compressedBuffer = Buffer.from(res.data.result, 'base64');
            const decompressed = await gunzip(compressedBuffer);
            const courses = JSON.parse(decompressed.toString('utf-8'));

            // Filter for unevaluated instructors across all courses
            const unevaluated = [];
            courses.forEach(course => {
                if (course.instructor && Array.isArray(course.instructor)) {
                    course.instructor.forEach(inst => {
                        if (inst.evaluatestatus === 0) {
                            unevaluated.push({
                                course_id: course.courseid,
                                course_code: course.coursecode,
                                course_name: course.coursename,
                                section: course.sectioncode,
                                class_id: course.classid,
                                evaluate_id: inst.evaluateid,
                                officer_id: inst.officerid,
                                officer_name: `${inst.prefixname}${inst.officername} ${inst.officersurname}`,
                                eva_date: course.evadate
                            });
                        }
                    });
                }
            });

            if (stdCode) {
                evalCache.set(stdCode, { timestamp: Date.now(), data: unevaluated });
            }

            return NextResponse.json({ success: true, data: unevaluated });
        }

        return NextResponse.json({ success: false, message: 'Failed to fetch evaluation list' }, { status: res.status });

    } catch (error) {
        console.error('[Evaluation API Error]:', error.message);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
