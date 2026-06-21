import { cookies } from 'next/headers';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import {
    isKmutnbSsoLoginEnabled,
    KMUTNB_SSO_SESSION_COOKIE_NAME,
    normalizeKmutnbSsoUserInfo,
    verifyKmutnbSsoSessionCookie,
} from '@/lib/kmutnbSso';
import { getKmutnbSsoSession } from '@/lib/kmutnbSsoSessionStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

export const AUTH_IDENTITY_COOKIE_NAME = 'reg_identity';
export const AUTH_IDENTITY_COOKIE_MAX_AGE_SECONDS = 60 * 55;

const _authCache = new Map();
const AUTH_CACHE_TTL = 30_000;

function _getCachedAuth(token) {
    const entry = _authCache.get(token);
    if (entry && Date.now() - entry.time < AUTH_CACHE_TTL) return entry.result;
    return undefined;
}

function _setCachedAuth(token, result) {
    _authCache.set(token, { result, time: Date.now() });
    if (_authCache.size > 200) {
        const now = Date.now();
        for (const [key, value] of _authCache) {
            if (now - value.time > AUTH_CACHE_TTL) _authCache.delete(key);
        }
    }
}

function normalizeUserId(value) {
    if (!value) return null;
    const normalized = String(value).trim().replace(/^s/i, '');
    return normalized || null;
}

function decodeJwtPayload(token) {
    if (!token) return null;

    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    } catch {
        return null;
    }
}

function extractUserIdFromUpstream(data) {
    return normalizeUserId(data?.studentCode || data?.studentcode || data?.usercode || data?.studentId);
}

function verifyIdentityCookie(identityCookie, tokenSession) {
    if (!identityCookie || !tokenSession || !process.env.JWT_SECRET) return null;

    try {
        const payload = jwt.verify(identityCookie, process.env.JWT_SECRET);
        if (payload?.session !== tokenSession) return null;
        return normalizeUserId(payload?.userCode);
    } catch {
        return null;
    }
}

function buildSsoAuthContext(session) {
    const ssoUser = normalizeKmutnbSsoUserInfo(session?.userInfo || {});
    const userId = normalizeUserId(ssoUser.userCode);
    if (!userId) {
        console.warn('[Auth] KMUTNB SSO session was missing a usable student code');
        return null;
    }

    return {
        token: null,
        userId,
        tokenPayload: null,
        upstream: ssoUser.raw,
        authProvider: 'kmutnb_sso',
        ssoSession: {
            sessionId: session.sessionId,
            subject: session.subject,
            userCode: session.userCode,
            scope: session.scope,
            accessTokenExpiresAt: session.accessTokenExpiresAt,
        },
        ssoUser,
        providerToken: session.accessToken || null,
    };
}

async function getSsoAuthContext(cookieStore) {
    if (!isKmutnbSsoLoginEnabled()) return null;

    const sessionCookie = cookieStore.get(KMUTNB_SSO_SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return null;

    let cookiePayload;
    try {
        cookiePayload = verifyKmutnbSsoSessionCookie(sessionCookie);
    } catch {
        console.warn('[Auth] KMUTNB SSO session cookie is invalid');
        return null;
    }

    try {
        const session = await getKmutnbSsoSession(cookiePayload.sessionId);
        if (!session) {
            console.warn('[Auth] KMUTNB SSO session row was not found');
            return null;
        }
        return buildSsoAuthContext(session);
    } catch (error) {
        console.error('[Auth] Failed to restore KMUTNB SSO session:', error.message);
        return null;
    }
}

export function createSignedAuthIdentityCookie({ userCode, session }) {
    const normalizedUserId = normalizeUserId(userCode);
    if (!normalizedUserId || !session) {
        throw new Error('Missing user identity claims for session cookie');
    }
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required to sign auth identity cookies');
    }

    return jwt.sign(
        { userCode: normalizedUserId, session },
        process.env.JWT_SECRET,
        { expiresIn: AUTH_IDENTITY_COOKIE_MAX_AGE_SECONDS }
    );
}

export async function getAuthContext() {
    const cookieStore = await cookies();
    const token = cookieStore.get('reg_token')?.value;

    if (!token) {
        const ssoAuthContext = await getSsoAuthContext(cookieStore);
        if (ssoAuthContext) return ssoAuthContext;

        console.log('[Auth] No token found in cookies');
        return null;
    }

    const cached = _getCachedAuth(token);
    if (cached !== undefined) return cached;

    try {
        const authRes = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
            headers: { 'Authorization': `Bearer ${token}` },
            validateStatus: (status) => status < 500,
        });

        if (authRes.status !== 200 || !authRes.data) {
            console.log(`[Auth] External API rejected token. Status: ${authRes.status}`);
            _setCachedAuth(token, null);
            return null;
        }

        const tokenPayload = decodeJwtPayload(token);
        const tokenSession = tokenPayload?.session || null;
        const signedIdentityCookie = cookieStore.get(AUTH_IDENTITY_COOKIE_NAME)?.value;

        const upstreamUserId = extractUserIdFromUpstream(authRes.data);
        const signedUserId = verifyIdentityCookie(signedIdentityCookie, tokenSession);

        if (upstreamUserId && signedUserId && upstreamUserId !== signedUserId) {
            console.warn('[Auth] Identity mismatch between upstream response and signed cookie');
            _setCachedAuth(token, null);
            return null;
        }

        const userId = upstreamUserId || signedUserId;
        if (!userId) {
            console.warn('[Auth] Token validated but no trusted identity was available');
            _setCachedAuth(token, null);
            return null;
        }

        const result = { token, userId, tokenPayload, upstream: authRes.data, authProvider: 'legacy_reg' };
        _setCachedAuth(token, result);
        return result;
    } catch (err) {
        console.error('[Auth] Check failed:', err.message);
        return null;
    }
}

export async function getAuthUser() {
    const authContext = await getAuthContext();
    return authContext?.userId || null;
}
