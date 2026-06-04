import axios from 'axios';
import https from 'https';
import zlib from 'zlib';
import { promisify } from 'util';
import { getServiceSupabase } from './supabase.js';

const gunzip = promisify(zlib.gunzip);
const BASE_URL = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
const agent = new https.Agent({ rejectUnauthorized: true });
const evaluationCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function normalizeAuthContext(authContext) {
    return {
        token: typeof authContext?.token === 'string' ? authContext.token.trim() : '',
        userId: typeof authContext?.userId === 'string' || typeof authContext?.userId === 'number'
            ? String(authContext.userId).trim()
            : '',
    };
}

export function clearStudentEvaluationCache(userId) {
    if (userId) {
        evaluationCache.delete(String(userId).trim());
    }
}

async function listCachedEvaluationSubmissions(userId) {
    if (!userId) return [];

    try {
        const supabase = getServiceSupabase();
        const { data } = await supabase
            .from('evaluation_submissions')
            .select('evaluate_id, officer_id, class_id')
            .eq('user_code', String(userId).trim());

        return (data || []).map((row) => ({
            evaluate_id: String(row.evaluate_id).trim(),
            officer_id: String(row.officer_id).trim(),
            class_id: String(row.class_id).trim(),
        }));
    } catch (error) {
        console.warn('[StudentEvaluation] Failed to fetch local cache:', error.message);
        return [];
    }
}

export async function getStudentEvaluationList(authContext) {
    const { token, userId } = normalizeAuthContext(authContext);
    if (!token) {
        throw new Error('Authenticated evaluation token is required');
    }

    if (userId) {
        const cached = evaluationCache.get(userId);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return cached.data;
        }
    }

    const response = await axios.get(`${BASE_URL}/Evaluateofficer/Class`, {
        headers: { Authorization: `Bearer ${token}` },
        httpsAgent: agent,
        timeout: 5000,
        validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data?.result) {
        const error = new Error('Failed to fetch evaluation list');
        error.status = response.status >= 400 ? response.status : 502;
        throw error;
    }

    const compressedBuffer = Buffer.from(response.data.result, 'base64');
    const decompressed = await gunzip(compressedBuffer);
    const courses = JSON.parse(decompressed.toString('utf-8'));
    const localCacheRecords = await listCachedEvaluationSubmissions(userId);
    const evaluations = [];

    courses.forEach((course) => {
        if (!Array.isArray(course.instructor)) return;

        course.instructor.forEach((instructor) => {
            let isEvaluated = instructor.evaluatestatus === 1;

            if (!isEvaluated && localCacheRecords.length > 0) {
                const currentEvalId = String(instructor.evaluateid).trim();
                const currentOfficerId = String(instructor.officerid).trim();
                const currentClassId = String(course.classid).trim();
                isEvaluated = localCacheRecords.some((row) => (
                    row.evaluate_id === currentEvalId
                    && row.officer_id === currentOfficerId
                    && row.class_id === currentClassId
                ));
            }

            evaluations.push({
                course_id: course.courseid,
                course_code: course.coursecode,
                course_name: course.coursename,
                section: course.sectioncode,
                class_id: course.classid,
                evaluate_id: instructor.evaluateid,
                officer_id: instructor.officerid,
                officer_name: `${instructor.prefixname}${instructor.officername} ${instructor.officersurname}`,
                eva_date: course.evadate,
                is_evaluated: isEvaluated,
            });
        });
    });

    if (userId) {
        evaluationCache.set(userId, { timestamp: Date.now(), data: evaluations });
    }

    return evaluations;
}
