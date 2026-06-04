import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sanitizeReturnTo as sanitizeSafeReturnTo } from './kmutnbSso.js';

export const GOOGLE_CLASSROOM_FLOW_COOKIE_NAME = 'reg_google_classroom_flow';
export const GOOGLE_CLASSROOM_FLOW_MAX_AGE_SECONDS = 10 * 60;

export const sanitizeReturnTo = sanitizeSafeReturnTo;

function getCookieSecurityOptions(maxAge) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge,
    };
}

function getJwtSigningSecret() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required for Google Classroom OAuth cookies');
    }
    return process.env.JWT_SECRET;
}

function base64UrlEncode(buffer) {
    return buffer.toString('base64url');
}

function buildCodeChallenge(codeVerifier) {
    return base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());
}

function computeExpiry(expiresInSeconds) {
    const seconds = Number(expiresInSeconds || 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return new Date(Date.now() + (seconds * 1000)).toISOString();
}

const GOOGLE_CLASSROOM_BASE_SCOPES = Object.freeze([
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.announcements.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
]);

const GOOGLE_CLASSROOM_PUSH_SCOPES = Object.freeze([
    'https://www.googleapis.com/auth/classroom.push-notifications',
]);

function readString(candidate) {
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function buildQueryParams(params = {}) {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            value.filter((item) => item !== undefined && item !== null && String(item).trim() !== '')
                .forEach((item) => searchParams.append(key, String(item)));
            continue;
        }

        if (value === undefined || value === null || String(value).trim() === '') continue;
        searchParams.set(key, String(value));
    }

    return searchParams;
}

function parseGoogleApiError(data, fallbackMessage) {
    const apiError = data?.error;
    if (typeof apiError === 'string' && apiError.trim()) return apiError.trim();
    if (typeof apiError?.message === 'string' && apiError.message.trim()) return apiError.message.trim();
    if (typeof apiError?.error_description === 'string' && apiError.error_description.trim()) return apiError.error_description.trim();
    if (typeof data?.error_description === 'string' && data.error_description.trim()) return data.error_description.trim();
    return fallbackMessage;
}

async function requestGoogleClassroomCollection(pathname, accessToken, params, itemKey, { maxPages = 1 } = {}) {
    const items = [];
    let pageToken = null;
    let pageCount = 0;

    do {
        const query = buildQueryParams({ ...params, pageToken });
        const response = await axios.get(`https://classroom.googleapis.com/v1${pathname}?${query.toString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 15000,
            validateStatus: () => true,
        });

        if (response.status !== 200 || !response.data) {
            const error = new Error(parseGoogleApiError(response.data, `Google Classroom request failed for ${pathname}`));
            error.status = response.status >= 400 ? response.status : 502;
            error.code = response.data?.error?.status || 'GOOGLE_CLASSROOM_API_FAILED';
            throw error;
        }

        const pageItems = Array.isArray(response.data?.[itemKey]) ? response.data[itemKey] : [];
        items.push(...pageItems);
        pageToken = readString(response.data?.nextPageToken);
        pageCount += 1;
    } while (pageToken && pageCount < Math.max(1, maxPages));

    return items;
}

export function getGoogleClassroomBaseScopes() {
    return [...GOOGLE_CLASSROOM_BASE_SCOPES];
}

export function resolveGoogleClassroomScopes(selectedFeatures = {}, { pushConfigured = false } = {}) {
    const scopes = new Set(GOOGLE_CLASSROOM_BASE_SCOPES);
    if (selectedFeatures?.pushSync && pushConfigured) {
        GOOGLE_CLASSROOM_PUSH_SCOPES.forEach((scope) => scopes.add(scope));
    }
    return [...scopes];
}

export function getGoogleClassroomConfig() {
    return {
        clientId: readString(process.env.GOOGLE_CLASSROOM_CLIENT_ID),
        clientSecret: readString(process.env.GOOGLE_CLASSROOM_CLIENT_SECRET),
        redirectUri: readString(process.env.GOOGLE_CLASSROOM_REDIRECT_URI),
        scopes: readString(process.env.GOOGLE_CLASSROOM_SCOPES)
            || getGoogleClassroomBaseScopes().join(' '),
        accessType: readString(process.env.GOOGLE_CLASSROOM_ACCESS_TYPE) || 'offline',
        prompt: readString(process.env.GOOGLE_CLASSROOM_PROMPT) || 'consent',
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    };
}

export function getMissingGoogleClassroomConfig() {
    const config = getGoogleClassroomConfig();
    const missing = [];

    if (!config.clientId) missing.push('GOOGLE_CLASSROOM_CLIENT_ID');
    if (!config.clientSecret) missing.push('GOOGLE_CLASSROOM_CLIENT_SECRET');
    if (!config.redirectUri) missing.push('GOOGLE_CLASSROOM_REDIRECT_URI');
    if (!process.env.GOOGLE_CLASSROOM_TOKEN_ENCRYPTION_KEY) missing.push('GOOGLE_CLASSROOM_TOKEN_ENCRYPTION_KEY');
    if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');

    return missing;
}

export function isGoogleClassroomConfigured() {
    return getMissingGoogleClassroomConfig().length === 0;
}

export function getGoogleClassroomPushConfig() {
    return {
        topicName: readString(process.env.GOOGLE_CLASSROOM_PUBSUB_TOPIC),
        pushToken: readString(process.env.GOOGLE_CLASSROOM_PUSH_TOKEN),
    };
}

export function isGoogleClassroomPushConfigured() {
    const config = getGoogleClassroomPushConfig();
    return Boolean(config.topicName && config.pushToken);
}

export function createGoogleClassroomFlow(userCode, returnTo) {
    const state = base64UrlEncode(crypto.randomBytes(24));
    const codeVerifier = base64UrlEncode(crypto.randomBytes(48));
    const codeChallenge = buildCodeChallenge(codeVerifier);
    const sanitizedReturnTo = sanitizeReturnTo(returnTo);

    const cookieValue = jwt.sign(
        { state, codeVerifier, returnTo: sanitizedReturnTo, userCode: String(userCode) },
        getJwtSigningSecret(),
        { expiresIn: GOOGLE_CLASSROOM_FLOW_MAX_AGE_SECONDS }
    );

    return { state, codeVerifier, codeChallenge, returnTo: sanitizedReturnTo, cookieValue };
}

export function verifyGoogleClassroomFlowCookie(cookieValue, state) {
    const payload = jwt.verify(cookieValue, getJwtSigningSecret());
    if (!payload?.state || payload.state !== state) {
        throw new Error('Invalid Google Classroom OAuth state');
    }
    if (!payload?.codeVerifier || !payload?.userCode) {
        throw new Error('Incomplete Google Classroom OAuth flow state');
    }
    return payload;
}

export function applyGoogleClassroomFlowCookie(response, cookieValue) {
    response.cookies.set(
        GOOGLE_CLASSROOM_FLOW_COOKIE_NAME,
        cookieValue,
        getCookieSecurityOptions(GOOGLE_CLASSROOM_FLOW_MAX_AGE_SECONDS)
    );
}

export function clearGoogleClassroomFlowCookie(response) {
    response.cookies.set(GOOGLE_CLASSROOM_FLOW_COOKIE_NAME, '', { ...getCookieSecurityOptions(0), maxAge: 0 });
}

export function buildGoogleClassroomAuthorizeUrl(flow, options = {}) {
    const config = getGoogleClassroomConfig();
    const resolvedScopes = Array.isArray(options.scopes) && options.scopes.length > 0
        ? options.scopes.join(' ')
        : config.scopes;
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: resolvedScopes,
        state: flow.state,
        code_challenge: flow.codeChallenge,
        code_challenge_method: 'S256',
        include_granted_scopes: 'true',
    });

    if (config.accessType) params.set('access_type', config.accessType);
    if (config.prompt) params.set('prompt', config.prompt);

    return `${config.authorizationEndpoint}?${params.toString()}`;
}

async function tokenRequest(body) {
    const config = getGoogleClassroomConfig();
    body.set('client_id', config.clientId);
    body.set('client_secret', config.clientSecret);

    const response = await axios.post(config.tokenEndpoint, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
        validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data?.access_token) {
        const message = parseGoogleApiError(response.data, 'Google Classroom token exchange failed');
        const error = new Error(message);
        error.status = response.status >= 400 ? response.status : 502;
        error.code = response.data?.error || 'GOOGLE_CLASSROOM_TOKEN_FAILED';
        throw error;
    }

    return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || null,
        idToken: response.data.id_token || null,
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope || config.scopes,
        accessTokenExpiresAt: computeExpiry(response.data.expires_in),
    };
}

export async function exchangeGoogleClassroomAuthorizationCode(code, codeVerifier) {
    const config = getGoogleClassroomConfig();
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
    });

    return tokenRequest(body);
}

export async function refreshGoogleClassroomTokenBundle(refreshToken) {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });
    return tokenRequest(body);
}

export async function fetchGoogleClassroomUserInfo(accessToken) {
    const config = getGoogleClassroomConfig();
    const response = await axios.get(config.userInfoEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
        validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data) {
        const error = new Error(parseGoogleApiError(response.data, 'Failed to fetch Google Classroom user info'));
        error.status = response.status >= 400 ? response.status : 502;
        error.code = response.data?.error?.status || 'GOOGLE_CLASSROOM_USERINFO_FAILED';
        throw error;
    }

    return response.data;
}

export async function revokeGoogleOAuthToken(token) {
    const normalizedToken = readString(token);
    if (!normalizedToken) return;

    const response = await axios.post(
        'https://oauth2.googleapis.com/revoke',
        new URLSearchParams({ token: normalizedToken }).toString(),
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
            validateStatus: () => true,
        }
    );

    if (![200, 400].includes(response.status)) {
        const error = new Error(parseGoogleApiError(response.data, 'Failed to revoke Google OAuth token'));
        error.status = response.status >= 400 ? response.status : 502;
        error.code = response.data?.error || 'GOOGLE_CLASSROOM_REVOKE_FAILED';
        throw error;
    }
}

export function normalizeGoogleClassroomUserInfo(userInfo) {
    return {
        subject: readString(userInfo?.sub),
        email: readString(userInfo?.email),
        emailVerified: Boolean(userInfo?.email_verified),
        displayName: readString(userInfo?.name),
        givenName: readString(userInfo?.given_name),
        familyName: readString(userInfo?.family_name),
        pictureUrl: readString(userInfo?.picture),
        raw: userInfo || {},
    };
}

export async function listGoogleClassroomCourses(accessToken, { maxPages = 2, pageSize = 100 } = {}) {
    return requestGoogleClassroomCollection(
        '/courses',
        accessToken,
        {
            studentId: 'me',
            courseStates: ['ACTIVE'],
            pageSize,
        },
        'courses',
        { maxPages }
    );
}

export async function listGoogleClassroomAnnouncements(accessToken, courseId, { maxPages = 2, pageSize = 20 } = {}) {
    return requestGoogleClassroomCollection(
        `/courses/${encodeURIComponent(courseId)}/announcements`,
        accessToken,
        {
            announcementStates: ['PUBLISHED'],
            orderBy: 'updateTime desc',
            pageSize,
        },
        'announcements',
        { maxPages }
    );
}

export async function listGoogleClassroomCourseWork(accessToken, courseId, { maxPages = 2, pageSize = 20 } = {}) {
    return requestGoogleClassroomCollection(
        `/courses/${encodeURIComponent(courseId)}/courseWork`,
        accessToken,
        {
            courseWorkStates: ['PUBLISHED'],
            orderBy: 'updateTime desc',
            pageSize,
        },
        'courseWork',
        { maxPages }
    );
}

export async function listGoogleClassroomStudentSubmissions(accessToken, courseId, { courseWorkId = '-', maxPages = 2, pageSize = 50 } = {}) {
    return requestGoogleClassroomCollection(
        `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions`,
        accessToken,
        {
            userId: 'me',
            pageSize,
        },
        'studentSubmissions',
        { maxPages }
    );
}

export async function createGoogleClassroomCourseWorkRegistration(accessToken, courseId) {
    const pushConfig = getGoogleClassroomPushConfig();
    if (!pushConfig.topicName) {
        const error = new Error('GOOGLE_CLASSROOM_PUBSUB_TOPIC is required for Classroom push registrations');
        error.code = 'GOOGLE_CLASSROOM_PUSH_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }

    const response = await axios.post(
        'https://classroom.googleapis.com/v1/registrations',
        {
            feed: {
                feedType: 'COURSE_WORK_CHANGES',
                courseWorkChangesInfo: {
                    courseId: String(courseId),
                },
            },
            cloudPubsubTopic: {
                topicName: pushConfig.topicName,
            },
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
            validateStatus: () => true,
        }
    );

    if (response.status !== 200 || !response.data?.registrationId) {
        const error = new Error(parseGoogleApiError(response.data, `Failed to create Google Classroom registration for course ${courseId}`));
        error.status = response.status >= 400 ? response.status : 502;
        error.code = response.data?.error?.status || 'GOOGLE_CLASSROOM_REGISTRATION_FAILED';
        throw error;
    }

    return {
        registrationId: String(response.data.registrationId),
        expiryTime: readString(response.data.expiryTime),
        courseId: String(courseId),
        topicName: pushConfig.topicName,
        feedType: readString(response.data?.feed?.feedType) || 'COURSE_WORK_CHANGES',
    };
}

export async function deleteGoogleClassroomRegistration(accessToken, registrationId) {
    const response = await axios.delete(`https://classroom.googleapis.com/v1/registrations/${encodeURIComponent(registrationId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
        validateStatus: () => true,
    });

    if (![200, 204, 404].includes(response.status)) {
        const error = new Error(parseGoogleApiError(response.data, `Failed to delete Google Classroom registration ${registrationId}`));
        error.status = response.status >= 400 ? response.status : 502;
        error.code = response.data?.error?.status || 'GOOGLE_CLASSROOM_REGISTRATION_DELETE_FAILED';
        throw error;
    }
}
