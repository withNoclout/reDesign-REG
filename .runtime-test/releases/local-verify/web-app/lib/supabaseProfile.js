import { getServiceSupabase } from './supabase';

/**
 * Retrieves a cached student profile from the Supabase database.
 * Maps DB snake_case columns → camelCase JS object (Boundary Rule).
 * 
 * @param {string} studentId - The unique student code (e.g. s6701091611290).
 * @returns {Promise<import('./types').StudentProfile|null>}
 */
export async function getCachedProfile(studentId) {
    if (!studentId) return null;

    try {
        const supabase = getServiceSupabase();

        const { data, error } = await supabase
            .from('student_profiles')
            .select('*')
            .eq('student_id', studentId)
            .single();

        if (error || !data) return null;

        // ✅ Boundary Rule: DB (snake_case) → JS (camelCase)
        return {
            studentId: data.student_id,        // CRITICAL: include this so callers can identify the record
            faculty: data.faculty,
            department: data.department,
            major: data.major,
            advisor1: data.advisor1 || null,
            advisor2: data.advisor2 || null,
            advisor3: data.advisor3 || null,
            admitYear: data.admit_year,
            currentYear: data.current_year,
            currentSemester: data.current_semester,
            enrollYear: data.enroll_year,
            enrollSemester: data.enroll_semester,
            avatarUrl: data.avatar_url || null,
        };
    } catch (err) {
        console.warn('[Supabase Profile API] Cache retrieval failed:', err.message);
        return null;
    }
}


/**
 * Upserts a cleaned profile object into the Supabase database.
 * 
 * @param {Object} profile - The clean profile data from the parser.
 * @returns {Promise<boolean>} Success status.
 */
export async function cacheProfile(profile) {
    if (!profile || !profile.studentId) return false;

    try {
        const supabase = getServiceSupabase();

        // Atomic Upsert: Only executing this if the parser provided valid data.
        const { error } = await supabase.from('student_profiles').upsert({
            student_id: profile.studentId,
            faculty: profile.faculty,
            department: profile.department,
            major: profile.major,
            advisor1: profile.advisor1,
            advisor2: profile.advisor2,
            advisor3: profile.advisor3,
            admit_year: profile.admitYear,
            current_year: profile.currentYear,
            current_semester: profile.currentSemester,
            enroll_year: profile.enrollYear,
            enroll_semester: profile.enrollSemester,
            updated_at: new Date()
        });

        if (error) {
            console.error('[Supabase Profile API] Upsert Error:', error.message);
            return false;
        }

        return true;
    } catch (err) {
        console.error('[Supabase Profile API] Critical Upsert Failure:', err.message);
        return false;
    }
}

/**
 * Updates a specific column for a student, such as avatar_url.
 */
export async function updateProfileColumn(studentId, updates) {
    if (!studentId || !updates) return false;

    try {
        const supabase = getServiceSupabase();
        const { error } = await supabase
            .from('student_profiles')
            .update({ ...updates, updated_at: new Date() })
            .eq('student_id', studentId);

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('[Supabase Profile API] Update Column Failure:', err.message);
        return false;
    }
}
