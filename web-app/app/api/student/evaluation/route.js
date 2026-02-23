import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import https from 'https';
import zlib from 'zlib';
import { promisify } from 'util';
import { getServiceSupabase } from '@/lib/supabase';

const gunzip = promisify(zlib.gunzip);
const BASE_URL = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';

// Ignore self-signed certs
const agent = new https.Agent({ rejectUnauthorized: false });

const evalCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function clearEvalCache(stdCode) {
    if (stdCode) {
        evalCache.delete(stdCode);
        console.log(`[Evaluation Cache] Cleared for student: ${stdCode}`);
    }
}

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

            // Fetch local cached evaluations from Supabase to counter University API delays
            let localCacheRecords = [];
            if (stdCode) {
                // Normalize stdCode for DB checking (remove 's' prefix if exists)
                const normalizedStdCode = stdCode.startsWith('s') ? stdCode.substring(1) : stdCode;

                try {
                    const supabase = getServiceSupabase();
                    const { data } = await supabase
                        .from('evaluation_submissions')
                        .select('evaluate_id, officer_id, class_id')
                        .eq('user_code', normalizedStdCode);
                    if (data) localCacheRecords = data;
                } catch (dbErr) {
                    console.warn('[Evaluation API] Failed to fetch local cache:', dbErr.message);
                }
            }

            // Map all instructors and determine their true evaluation status
            const allEvaluations = [];
            courses.forEach(course => {
                if (course.instructor && Array.isArray(course.instructor)) {
                    course.instructor.forEach(inst => {
                        // Check if university already knows it's evaluated
                        let isEvaluated = inst.evaluatestatus === 1;

                        // Check if we have a robust local cache saying it's evaluated (to counter university delay)
                        if (!isEvaluated && localCacheRecords.length > 0) {
                            const foundInDB = localCacheRecords.some(row =>
                                row.evaluate_id === String(inst.evaluateid) &&
                                row.officer_id === String(inst.officerid) &&
                                row.class_id === String(course.classid)
                            );
                            if (foundInDB) isEvaluated = true;
                        }

                        allEvaluations.push({
                            course_id: course.courseid,
                            course_code: course.coursecode,
                            course_name: course.coursename,
                            section: course.sectioncode,
                            class_id: course.classid,
                            evaluate_id: inst.evaluateid,
                            officer_id: inst.officerid,
                            officer_name: `${inst.prefixname}${inst.officername} ${inst.officersurname}`,
                            eva_date: course.evadate,
                            is_evaluated: isEvaluated // New property for the frontend
                        });
                    });
                }
            });

            if (stdCode) {
                evalCache.set(stdCode, { timestamp: Date.now(), data: allEvaluations });
            }

            return NextResponse.json({ success: true, data: allEvaluations });
        }

        return NextResponse.json({ success: false, message: 'Failed to fetch evaluation list' }, { status: res.status });

    } catch (error) {
        console.error('[Evaluation API Error]:', error.message);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
