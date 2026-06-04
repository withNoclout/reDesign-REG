import axios from 'axios';

const GOOGLE_CLASSROOM_MAIL_SCOPES = Object.freeze([
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
]);

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseGoogleApiError(data, fallbackMessage) {
    const apiError = data?.error;
    if (typeof apiError === 'string' && apiError.trim()) return apiError.trim();
    if (typeof apiError?.message === 'string' && apiError.message.trim()) return apiError.message.trim();
    if (typeof data?.error_description === 'string' && data.error_description.trim()) return data.error_description.trim();
    return fallbackMessage;
}


function getMessageHeaders(payload) {
    const headers = payload?.headers || [];
    const output = {};
    for (const header of headers) {
        if (!header?.name) continue;
        output[header.name.toLowerCase()] = header.value || '';
    }
    return output;
}

function decodeBase64Url(value) {
    if (!value) return '';
    try {
        return Buffer.from(String(value), 'base64url').toString('utf8');
    } catch {
        return '';
    }
}

function collectMessageBodyText(part, buckets) {
    if (!part) return;

    const mimeType = part.mimeType || '';
    const data = part.body?.data;
    if (data) {
        const decoded = decodeBase64Url(data);
        if (decoded) {
            if (mimeType.startsWith('text/plain')) buckets.text.push(decoded);
            else if (mimeType.startsWith('text/html')) buckets.html.push(decoded);
        }
    }

    if (Array.isArray(part.parts)) {
        part.parts.forEach((child) => collectMessageBodyText(child, buckets));
    }
}

export function getGoogleClassroomMailScopes() {
    return [...GOOGLE_CLASSROOM_MAIL_SCOPES];
}

export function buildGoogleClassroomMailQuery() {
    return readString(process.env.GOOGLE_CLASSROOM_GMAIL_QUERY)
        || 'newer_than:30d ("Google Classroom" OR classroom OR assignment OR announcement)';
}

export async function listGoogleClassroomMailMessages(accessToken, { query = buildGoogleClassroomMailQuery(), maxResults = 25 } = {}) {
    const response = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { q: query, maxResults },
        timeout: 15000,
        validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data) {
        const error = new Error(parseGoogleApiError(response.data, 'Failed to list Gmail messages'));
        error.status = response.status >= 400 ? response.status : 502;
        error.code = response.data?.error?.status || 'GOOGLE_GMAIL_LIST_FAILED';
        throw error;
    }

    return Array.isArray(response.data.messages) ? response.data.messages : [];
}

export async function getGoogleClassroomMailMessage(accessToken, messageId, { format = 'full' } = {}) {
    const response = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { format },
        timeout: 15000,
        validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data) {
        const error = new Error(parseGoogleApiError(response.data, `Failed to fetch Gmail message ${messageId}`));
        error.status = response.status >= 400 ? response.status : 502;
        error.code = response.data?.error?.status || 'GOOGLE_GMAIL_MESSAGE_FAILED';
        throw error;
    }

    const payload = response.data.payload || {};
    const buckets = { text: [], html: [] };
    collectMessageBodyText(payload, buckets);

    return {
        id: response.data.id,
        threadId: response.data.threadId,
        internalDate: response.data.internalDate,
        snippet: response.data.snippet || '',
        labelIds: Array.isArray(response.data.labelIds) ? response.data.labelIds : [],
        headers: getMessageHeaders(payload),
        textBody: buckets.text.join('\n\n'),
        htmlBody: buckets.html.join('\n\n'),
        historyId: response.data.historyId || null,
        raw: response.data,
    };
}
