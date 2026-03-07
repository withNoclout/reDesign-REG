/**
 * Safely extracts a value from the bio data array based on keyword matching.
 */
function extractKeyword(entries, keywords) {
    if (!Array.isArray(entries)) return null;
    const item = entries.find(e => {
        const name = e.bioentryname || '';
        return keywords.some(k => name.includes(k));
    });

    if (!item) return null;

    let value = item.biodefaultvalue;
    if (item.combolist && item.combolist.length > 0) {
        const match = item.combolist.find(c => c.valueid == value);
        if (match) value = match.label;
    }

    // Sanitize string output
    return typeof value === 'string' ? value.trim() : value;
}

/**
 * Parses the raw responses from the University API into a clean Profile object.
 * 
 * SOFT ATOMIC PROMISE:
 * - We REQUIRE a valid studentId (hard fail without it).
 * - cookieStudentId is used as fallback since the ID endpoint may not return studentCode.
 * - Faculty and other fields are optional — we return what we have and mark isPartial=true.
 * 
 * @param {Object} rawData - Object containing { bioResult, acadResult, idResult }
 * @param {string|null} cookieStudentId - Fallback student ID from the std_code cookie
 * @returns {{ profile: import('./types').StudentProfile, isPartial: boolean }}
 */
export function parseProfileData({ bioResult, acadResult, idResult }, cookieStudentId = null) {
    // University API returns the bio entries array at the top level of .data
    // (i.e. bioResult.value.data IS the array, not bioResult.value.data.data)
    // We also defensively check .data.data in case the shape ever changes.
    const rawBioData = bioResult.value.data;
    const entries = Array.isArray(rawBioData)
        ? rawBioData                       // top-level array (current behaviour)
        : Array.isArray(rawBioData?.data)
            ? rawBioData.data              // nested under .data (future-proofing)
            : null;

    if (!entries) {
        throw new Error(`Parser Error: Bio data is not an array. Got: ${typeof rawBioData}. Keys: ${Object.keys(rawBioData || {}).slice(0, 10).join(', ')}`);
    }

    const acadData = (acadResult.status === 'fulfilled' && acadResult.value?.status === 200)
        ? acadResult.value.data
        : {};

    const idData = (idResult.status === 'fulfilled' && idResult.value?.status === 200)
        ? idResult.value.data
        : {};

    // Try to get student ID from API response first, then fall back to cookie.
    // NOTE: The university Getacadstd endpoint currently returns acadyear/semester fields
    // but NOT studentCode/usercode — so the cookie fallback is usually what is used.
    const studentId = idData.studentCode || idData.usercode || cookieStudentId || null;

    // ATOMIC UPDATE REQUIREMENT: If we cannot establish the ID, the parsing fails
    // entirely, preventing us from saving anonymous data.
    if (!studentId) {
        throw new Error("Parser Error: Could not determine student ID from University Response.");
    }

    const faculty = extractKeyword(entries, ['คณะ', 'Faculty']);

    // SOFT REQUIREMENT: Log a warning if Faculty is missing, but don't throw.
    // This prevents 503 errors when the University API is temporarily slow or partial.
    if (!faculty) {
        console.warn(`[profileParser] Faculty not found for ${studentId}. Returning partial profile.`);
    }

    return {
        profile: {
            studentId,
            faculty: faculty || null,
            department: extractKeyword(entries, ['สาขา', 'Department', 'ภาควิชา']),
            major: extractKeyword(entries, ['หลักสูตร', 'Curriculum']),
            advisor1: extractKeyword(entries, ['ที่ปรึกษาคนที่ 1', 'Advisor 1']),
            advisor2: extractKeyword(entries, ['ที่ปรึกษาคนที่ 2', 'Advisor 2']),
            advisor3: extractKeyword(entries, ['ที่ปรึกษาคนที่ 3', 'Advisor 3']),
            admitYear: idData?.admitacadyear || null,
            currentYear: acadData?.currentacadyear || idData?.currentacadyear || null,
            currentSemester: acadData?.currentsemester || idData?.currentsemester || null,
            enrollYear: idData?.enrollacadyear || null,
            enrollSemester: idData?.enrollsemester || null,
        },
        isPartial: !faculty
    };
}
