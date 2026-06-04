import { parseGoogleClassroomMailNotification } from './googleClassroomMailParser.js';
import {
    clearClientGoogleMailConnection,
    getClientGoogleMailConnection,
    saveClientGoogleMailConnection,
    saveClientGoogleMailNotifications,
} from './googleClientMailState.js';
import { CLIENT_CLASSROOM_GMAIL_SCOPE, getClientGoogleMailConfig, normalizeClientClassroomUserCode } from './googleClientMailConfig.js';

let scriptPromise = null;

function loadGoogleIdentityScript() {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Google Identity Services is only available in the browser'));
    }
    if (window.google?.accounts?.oauth2) {
        return Promise.resolve(window.google);
    }
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-google-identity]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.google));
            existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleIdentity = 'true';
        script.onload = () => resolve(window.google);
        script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.head.appendChild(script);
    });

    return scriptPromise;
}

async function fetchGmailProfile(accessToken) {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Failed to load Gmail profile');
    return response.json();
}

function doesEmailMatchUser(userCode, email) {
    const normalizedUserCode = normalizeClientClassroomUserCode(userCode);
    if (!normalizedUserCode) return false;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const localPart = normalizedEmail.split('@')[0] || '';
    const match = localPart.match(/s?(\d{6,15})$/i);
    return Boolean(match && match[1] === normalizedUserCode);
}

function createTokenRequest(clientId, callback) {
    return window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: CLIENT_CLASSROOM_GMAIL_SCOPE,
        callback,
        prompt: 'consent',
    });
}

function decodeBase64Url(value) {
    if (!value) return '';
    try {
        const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        return decodeURIComponent(Array.prototype.map.call(window.atob(padded), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
    } catch {
        return '';
    }
}

function getHeaders(payload) {
    const headers = payload?.headers || [];
    const output = {};
    for (const header of headers) {
        if (!header?.name) continue;
        output[header.name.toLowerCase()] = header.value || '';
    }
    return output;
}

function collectMessageBody(part, buckets) {
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
        part.parts.forEach((child) => collectMessageBody(child, buckets));
    }
}

async function listGmailMessages(accessToken, query) {
    const params = new URLSearchParams({ q: query, maxResults: '25' });
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Failed to list Gmail messages');
    const data = await response.json();
    return Array.isArray(data.messages) ? data.messages : [];
}

async function getGmailMessage(accessToken, messageId) {
    const params = new URLSearchParams({ format: 'full' });
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`Failed to fetch Gmail message ${messageId}`);
    const data = await response.json();
    const buckets = { text: [], html: [] };
    collectMessageBody(data.payload || {}, buckets);
    return {
        id: data.id,
        threadId: data.threadId,
        internalDate: data.internalDate,
        snippet: data.snippet || '',
        labelIds: Array.isArray(data.labelIds) ? data.labelIds : [],
        headers: getHeaders(data.payload),
        textBody: buckets.text.join('\n\n'),
        htmlBody: buckets.html.join('\n\n'),
        historyId: data.historyId || null,
        raw: data,
    };
}

export async function connectClientGoogleMail(userCode) {
    const normalizedUserCode = normalizeClientClassroomUserCode(userCode);
    const { clientId } = getClientGoogleMailConfig();
    if (!clientId) throw new Error('NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID is required for client-side Gmail POC');
    if (!normalizedUserCode) throw new Error('Authenticated user code is required');

    await loadGoogleIdentityScript();

    const tokenResponse = await new Promise((resolve, reject) => {
        const tokenClient = createTokenRequest(clientId, (response) => {
            if (response?.error) {
                reject(new Error(response.error));
                return;
            }
            resolve(response);
        });
        tokenClient.requestAccessToken();
    });

    const profile = await fetchGmailProfile(tokenResponse.access_token);
    const email = profile.emailAddress || '';
    if (!doesEmailMatchUser(normalizedUserCode, email)) {
        throw new Error('Google account does not match the currently signed-in student');
    }

    return saveClientGoogleMailConnection(normalizedUserCode, {
        email,
        displayName: email,
        accessToken: tokenResponse.access_token,
        scope: tokenResponse.scope || CLIENT_CLASSROOM_GMAIL_SCOPE,
        tokenType: tokenResponse.token_type || 'Bearer',
        expiresAt: tokenResponse.expires_in ? new Date(Date.now() + (Number(tokenResponse.expires_in) * 1000)).toISOString() : null,
        lastSyncedAt: null,
        lastSyncError: null,
    });
}

export async function syncClientGoogleMailNotifications(userCode) {
    const normalizedUserCode = normalizeClientClassroomUserCode(userCode);
    const connection = getClientGoogleMailConnection(normalizedUserCode);
    if (!connection?.accessToken) {
        throw new Error('Google Mail is not connected in this browser session');
    }

    const messageRefs = await listGmailMessages(connection.accessToken, getClientGoogleMailConfig().query);
    const results = await Promise.allSettled(messageRefs.map((item) => getGmailMessage(connection.accessToken, item.id)));
    const notifications = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => parseGoogleClassroomMailNotification(result.value))
        .filter(Boolean)
        .sort((left, right) => Date.parse(right.sortAt) - Date.parse(left.sortAt));

    saveClientGoogleMailNotifications(normalizedUserCode, notifications);
    saveClientGoogleMailConnection(normalizedUserCode, {
        ...connection,
        lastSyncedAt: new Date().toISOString(),
        lastSyncError: null,
    });
    return notifications;
}

export function disconnectClientGoogleMail(userCode) {
    clearClientGoogleMailConnection(userCode);
}
