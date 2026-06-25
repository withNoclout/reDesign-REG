import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getStoredPortfolioConfig, saveStoredPortfolioConfig } from './studentLoanSettings.js';
import { sanitizeReturnTo } from './kmutnbSso.js';

const INSTAGRAM_POC_NAMESPACE = 'instagramPoc';
export const INSTAGRAM_POC_FLOW_COOKIE_NAME = 'reg_instagram_poc_flow';
const INSTAGRAM_POC_FLOW_MAX_AGE_SECONDS = 10 * 60;
const INSTAGRAM_POC_DEFAULT_RETURN_TO = '/settings/classroom';
const INSTAGRAM_POC_DEFAULT_SCOPE = 'instagram_business_basic';

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getJwtSigningSecret() {
    const secret = readString(process.env.JWT_SECRET);
    if (!secret) {
        throw new Error('JWT_SECRET is required for Instagram OAuth state protection');
    }
    return secret;
}

function getCookieSecurityOptions(maxAge) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
    };
}

function sanitizeInstagramUsername(value) {
    const normalized = readString(value)?.replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '');
    return normalized ? normalized.toLowerCase() : null;
}

function normalizeIsoString(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getInstagramRedirectUri(origin = null) {
    const explicit = readString(process.env.INSTAGRAM_REDIRECT_URI);
    if (explicit) return explicit;
    const normalizedOrigin = readString(origin) || readString(process.env.NEXT_PUBLIC_APP_URL);
    if (!normalizedOrigin) return null;
    return `${normalizedOrigin.replace(/\/$/, '')}/api/instagram/link/callback`;
}

function getInstagramScopes() {
    const raw = readString(process.env.INSTAGRAM_SCOPES) || INSTAGRAM_POC_DEFAULT_SCOPE;
    return raw.split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean);
}

export function getInstagramPocMissingConfig(origin = null) {
    const missing = [];
    if (!readString(process.env.INSTAGRAM_CLIENT_ID)) missing.push('INSTAGRAM_CLIENT_ID');
    if (!readString(process.env.INSTAGRAM_CLIENT_SECRET)) missing.push('INSTAGRAM_CLIENT_SECRET');
    if (!getInstagramRedirectUri(origin)) missing.push('INSTAGRAM_REDIRECT_URI');
    return missing;
}

export function isInstagramPocConfigured(origin = null) {
    return getInstagramPocMissingConfig(origin).length === 0;
}

export function buildInstagramPocConnectUrl(returnTo = INSTAGRAM_POC_DEFAULT_RETURN_TO) {
    return `/api/instagram/link/start?returnTo=${encodeURIComponent(sanitizeReturnTo(returnTo || INSTAGRAM_POC_DEFAULT_RETURN_TO))}`;
}

export function createInstagramPocFlow(userCode, returnTo = INSTAGRAM_POC_DEFAULT_RETURN_TO) {
    const state = crypto.randomBytes(24).toString('base64url');
    const sanitizedReturnTo = sanitizeReturnTo(returnTo || INSTAGRAM_POC_DEFAULT_RETURN_TO);
    const cookieValue = jwt.sign(
        { state, userCode: String(userCode), returnTo: sanitizedReturnTo },
        getJwtSigningSecret(),
        { expiresIn: INSTAGRAM_POC_FLOW_MAX_AGE_SECONDS }
    );

    return { state, userCode: String(userCode), returnTo: sanitizedReturnTo, cookieValue };
}

export function verifyInstagramPocFlowCookie(cookieValue, state) {
    const payload = jwt.verify(cookieValue, getJwtSigningSecret());
    if (!payload?.state || payload.state !== state) {
        throw new Error('Invalid Instagram OAuth state');
    }
    return payload;
}

export function applyInstagramPocFlowCookie(response, cookieValue) {
    response.cookies.set(
        INSTAGRAM_POC_FLOW_COOKIE_NAME,
        cookieValue,
        getCookieSecurityOptions(INSTAGRAM_POC_FLOW_MAX_AGE_SECONDS)
    );
}

export function clearInstagramPocFlowCookie(response) {
    response.cookies.set(INSTAGRAM_POC_FLOW_COOKIE_NAME, '', {
        ...getCookieSecurityOptions(0),
        expires: new Date(0),
    });
}

export function buildInstagramAuthorizeUrl(flow, origin = null) {
    const clientId = readString(process.env.INSTAGRAM_CLIENT_ID);
    const redirectUri = getInstagramRedirectUri(origin);
    const scopes = getInstagramScopes();
    if (!clientId || !redirectUri || scopes.length === 0) {
        throw new Error('Instagram professional sync is not configured');
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(','),
        state: flow.state,
        force_authentication: '1',
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

function extractInstagramConnection(config) {
    const source = normalizeObject(config);
    const raw = normalizeObject(source[INSTAGRAM_POC_NAMESPACE]);
    const username = sanitizeInstagramUsername(raw.username);
    const profileUrl = readString(raw.profileUrl) || (username ? `https://www.instagram.com/${username}/` : null);
    const connectedAt = normalizeIsoString(raw.connectedAt);
    const disconnectedAt = normalizeIsoString(raw.disconnectedAt);
    const connected = Boolean(username && connectedAt && !disconnectedAt);

    return {
        connected,
        connection: connected ? {
            providerUserId: readString(raw.providerUserId),
            username,
            displayName: readString(raw.displayName) || (username ? `@${username}` : null),
            profileUrl,
            profilePictureUrl: readString(raw.profilePictureUrl),
            accountType: readString(raw.accountType) || 'professional',
            connectedAt,
            updatedAt: normalizeIsoString(raw.updatedAt) || connectedAt,
            lastAuthorizationAt: normalizeIsoString(raw.lastAuthorizationAt) || connectedAt,
            scope: Array.isArray(raw.scope) ? raw.scope.filter(Boolean) : getInstagramScopes(),
        } : null,
        disconnectedAt,
    };
}

async function saveInstagramConnection(userCode, payload) {
    const config = await getStoredPortfolioConfig(userCode);
    const nextConfig = {
        ...normalizeObject(config),
        [INSTAGRAM_POC_NAMESPACE]: {
            ...normalizeObject(config?.[INSTAGRAM_POC_NAMESPACE]),
            ...payload,
            updatedAt: new Date().toISOString(),
        },
    };
    await saveStoredPortfolioConfig(userCode, nextConfig);
    return extractInstagramConnection(nextConfig);
}

async function exchangeInstagramCode(code, origin = null) {
    const redirectUri = getInstagramRedirectUri(origin);
    const clientId = readString(process.env.INSTAGRAM_CLIENT_ID);
    const clientSecret = readString(process.env.INSTAGRAM_CLIENT_SECRET);
    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('Instagram professional sync is not configured');
    }

    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: String(code),
    });
    const response = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.access_token) {
        throw new Error(payload?.error_message || payload?.error?.message || 'Instagram authorization failed');
    }
    return payload;
}

async function fetchInstagramProfile(accessToken) {
    const params = new URLSearchParams({
        fields: 'user_id,username,name,profile_picture_url',
        access_token: String(accessToken),
    });
    const response = await fetch(`https://graph.instagram.com/me?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.username) {
        throw new Error(payload?.error?.message || 'Instagram profile lookup failed');
    }
    return payload;
}

export async function completeInstagramPocAuthorization({ userCode, code, origin = null }) {
    const tokenBundle = await exchangeInstagramCode(code, origin);
    const profile = await fetchInstagramProfile(tokenBundle.access_token);
    const username = sanitizeInstagramUsername(profile.username);
    if (!username) {
        throw new Error('Instagram profile did not return a valid username');
    }

    return saveInstagramConnection(userCode, {
        providerUserId: readString(profile.user_id) || readString(profile.id),
        username,
        displayName: readString(profile.name) || `@${username}`,
        profileUrl: `https://www.instagram.com/${username}/`,
        profilePictureUrl: readString(profile.profile_picture_url),
        accountType: 'professional',
        scope: getInstagramScopes(),
        connectedAt: new Date().toISOString(),
        disconnectedAt: null,
        lastAuthorizationAt: new Date().toISOString(),
    });
}

export async function disconnectInstagramPoc(userCode) {
    return saveInstagramConnection(userCode, {
        disconnectedAt: new Date().toISOString(),
    });
}

export async function getInstagramPocSettingsSummary(userCode, { returnTo = INSTAGRAM_POC_DEFAULT_RETURN_TO, origin = null } = {}) {
    const normalizedUserCode = readString(userCode);
    const configured = isInstagramPocConfigured(origin);
    if (!normalizedUserCode) {
        return {
            configured,
            missingConfig: getInstagramPocMissingConfig(origin),
            connected: false,
            connectUrl: buildInstagramPocConnectUrl(returnTo),
            connection: null,
            mode: 'oauth-profile-poc',
        };
    }

    const config = await getStoredPortfolioConfig(normalizedUserCode);
    const current = extractInstagramConnection(config);
    return {
        configured,
        missingConfig: getInstagramPocMissingConfig(origin),
        connected: current.connected,
        connectUrl: buildInstagramPocConnectUrl(returnTo),
        connection: current.connection,
        disconnectedAt: current.disconnectedAt,
        mode: 'oauth-profile-poc',
    };
}
