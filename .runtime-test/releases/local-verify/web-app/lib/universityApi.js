import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

// How long to wait for each API call before giving up
const TIMEOUT_MS = 10000; // 10 seconds per call

/**
 * Fetches raw bio and academic data from the University API.
 * 
 * Uses allSettled() so secondary API failures (acad, id) don't block the bio data.
 * If the bio endpoint fails entirely (network timeout or non-200/401), throws.
 * 
 * @param {string} token - The user's JWT access token from cookies.
 * @returns {Promise<{bioResult: any, acadResult: any, idResult: any}>}
 */
export async function fetchFromUniversityApi(token) {
    if (!token) {
        throw new Error('No authentication token provided for University API.');
    }

    const apiCallConfig = {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: TIMEOUT_MS,
        validateStatus: () => true // Handle HTTP status codes manually
    };

    console.log('[University API] Fetching 3 endpoints in parallel...');
    const start = Date.now();

    const results = await Promise.allSettled([
        axios.get(`${BASE_URL}/Bioentryconfig/Getbioentryconfig/I`, apiCallConfig),
        axios.get(`${BASE_URL}/Schg/Getacadstrat`, apiCallConfig),
        axios.get(`${BASE_URL}/Schg/Getacadstd`, apiCallConfig)
    ]);

    const elapsed = Date.now() - start;
    console.log(`[University API] All calls settled in ${elapsed}ms`);

    const [bioResult, acadResult, idResult] = results;

    // Log status of each call for debugging
    console.log(`[University API] Bio: ${bioResult.status === 'fulfilled' ? bioResult.value?.status : 'REJECTED: ' + bioResult.reason?.message}`);
    console.log(`[University API] Acad: ${acadResult.status === 'fulfilled' ? acadResult.value?.status : 'REJECTED: ' + acadResult.reason?.message}`);
    console.log(`[University API] ID: ${idResult.status === 'fulfilled' ? idResult.value?.status : 'REJECTED: ' + idResult.reason?.message}`);

    // Reject if the primary bio endpoint entirely fails at network level
    if (bioResult.status === 'rejected') {
        throw new Error(`University Bio API Network Error: ${bioResult.reason?.message}`);
    }

    // Check for explicit 401 Unauthorized from bio endpoint
    if (bioResult.value?.status === 401) {
        const error = new Error('Session Expired (Unauthorized against University API)');
        error.isAuthError = true;
        throw error;
    }

    // If bio endpoint didn't return 200, consider it a failure
    if (bioResult.value?.status !== 200) {
        throw new Error(`University Bio API responded with status ${bioResult.value?.status}. Body: ${JSON.stringify(bioResult.value?.data).substring(0, 200)}`);
    }

    // Sanity check: bio data must be an array of entries (either at top level or under .data)
    const bioData = bioResult.value?.data;
    const bioEntries = Array.isArray(bioData) ? bioData : (Array.isArray(bioData?.data) ? bioData.data : null);
    if (!bioEntries) {
        throw new Error(`University Bio API returned unexpected data shape. Expected array but got: ${typeof bioData}. Keys: ${Object.keys(bioData || {}).slice(0, 10).join(', ')}`);
    }

    return { bioResult, acadResult, idResult };
}
