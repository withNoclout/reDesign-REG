import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const KMUTNB_SSO_FLOW_COOKIE_NAME = 'reg_sso_flow';
export const KMUTNB_SSO_SESSION_COOKIE_NAME = 'reg_sso_session';
export const KMUTNB_SSO_FLOW_MAX_AGE_SECONDS = 10 * 60;
export const KMUTNB_SSO_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

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
        throw new Error('JWT_SECRET is required for KMUTNB SSO cookies');
    }
    return process.env.JWT_SECRET;
}

function base64UrlEncode(buffer) {
    return Buffer.from(buffer)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function buildCodeChallenge(codeVerifier) {
    return base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());
}

function computeExpiry(expiresInSeconds) {
    if (!expiresInSeconds || Number.isNaN(Number(expiresInSeconds))) return null;
    return new Date(Date.now() + Number(expiresInSeconds) * 1000).toISOString();
}

function readString(candidate) {
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function normalizeUserCode(candidate) {
    const value = readString(candidate);
    if (!value) return null;
    const normalized = value.replace(/^s/i, '');
    return /^\d{6,15}$/.test(normalized) ? normalized : null;
}

function findUserCode(userInfo) {
    const studentInfo = userInfo?.kmutnb_student_info || userInfo?.student_info || userInfo?.studentInfo || null;

    return normalizeUserCode(
        studentInfo?.student_code
        || studentInfo?.studentCode
        || studentInfo?.student_id
        || studentInfo?.studentId
        || studentInfo?.usercode
        || userInfo?.preferred_username
        || userInfo?.username
        || userInfo?.sub
    );
}

function normalizeAccountType(userInfo) {
    return readString(
        userInfo?.kmutnb_account_type
        || userInfo?.account_type
        || userInfo?.accountType
    );
}

export function getKmutnbSsoConfig() {
    const baseUrl = readString(process.env.KMUTNB_SSO_BASE_URL) || 'https://sso.kmutnb.ac.th';
    return {
        baseUrl,
        clientId: readString(process.env.KMUTNB_SSO_CLIENT_ID),
        clientSecret: readString(process.env.KMUTNB_SSO_CLIENT_SECRET),
        redirectUri: readString(process.env.KMUTNB_SSO_REDIRECT_URI),
        scopes: readString(process.env.KMUTNB_SSO_SCOPES) || 'openid profile email student_info',
        accessType: readString(process.env.KMUTNB_SSO_ACCESS_TYPE) || 'offline',
        prompt: readString(process.env.KMUTNB_SSO_PROMPT),
        authorizationEndpoint: `${baseUrl}/auth/authorize`,
        tokenEndpoint: `${baseUrl}/auth/token`,
        userInfoEndpoint: `${baseUrl}/resources/userinfo`,
        introspectionEndpoint: `${baseUrl}/introspect`,
    };
}

export function isKmutnbSsoLoginEnabled() {
    return readString(process.env.KMUTNB_SSO_LOGIN_ENABLED)?.toLowerCase() === 'true';
}

export function getMissingKmutnbSsoConfig() {
    const config = getKmutnbSsoConfig();
    const missing = [];

    if (!config.clientId) missing.push('KMUTNB_SSO_CLIENT_ID');
    if (!config.clientSecret) missing.push('KMUTNB_SSO_CLIENT_SECRET');
    if (!config.redirectUri) missing.push('KMUTNB_SSO_REDIRECT_URI');
    if (!process.env.KMUTNB_SSO_TOKEN_ENCRYPTION_KEY) missing.push('KMUTNB_SSO_TOKEN_ENCRYPTION_KEY');
    if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');

    return missing;
}

export function isKmutnbSsoConfigured() {
    return getMissingKmutnbSsoConfig().length === 0;
}

export function sanitizeReturnTo(rawReturnTo) {
    const value = readString(rawReturnTo);
    if (!value) return process.env.NEXT_PUBLIC_LANDING_PATH || '/main';
    if (!value.startsWith('/') || value.startsWith('//')) return process.env.NEXT_PUBLIC_LANDING_PATH || '/main';
    if (value.startsWith('/api/')) return process.env.NEXT_PUBLIC_LANDING_PATH || '/main';
    return value;
}

export function createKmutnbSsoFlow(returnTo) {
    const state = base64UrlEncode(crypto.randomBytes(24));
    const nonce = base64UrlEncode(crypto.randomBytes(24));
    const codeVerifier = base64UrlEncode(crypto.randomBytes(48));
    const codeChallenge = buildCodeChallenge(codeVerifier);
    const sanitizedReturnTo = sanitizeReturnTo(returnTo);

    const cookieValue = jwt.sign(
        { state, nonce, codeVerifier, returnTo: sanitizedReturnTo },
        getJwtSigningSecret(),
        { expiresIn: KMUTNB_SSO_FLOW_MAX_AGE_SECONDS }
    );

    return { state, nonce, codeVerifier, codeChallenge, returnTo: sanitizedReturnTo, cookieValue };
}

export function verifyKmutnbSsoFlowCookie(cookieValue, state) {
    const payload = jwt.verify(cookieValue, getJwtSigningSecret());
    if (!payload?.state || payload.state !== state) {
        throw new Error('Invalid KMUTNB SSO state');
    }
    if (!payload?.codeVerifier || !payload?.nonce) {
        throw new Error('Incomplete KMUTNB SSO flow state');
    }
    return payload;
}

export function createKmutnbSsoSessionCookie(session) {
    return jwt.sign(
        {
            sessionId: session.sessionId,
            subject: session.subject,
            userCode: session.userCode || null,
            provider: session.provider || 'kmutnb_sso',
        },
        getJwtSigningSecret(),
        { expiresIn: KMUTNB_SSO_SESSION_MAX_AGE_SECONDS }
    );
}

export function verifyKmutnbSsoSessionCookie(cookieValue) {
    return jwt.verify(cookieValue, getJwtSigningSecret());
}

export function applyKmutnbSsoFlowCookie(response, cookieValue) {
    response.cookies.set(KMUTNB_SSO_FLOW_COOKIE_NAME, cookieValue, getCookieSecurityOptions(KMUTNB_SSO_FLOW_MAX_AGE_SECONDS));
}

export function applyKmutnbSsoSessionCookie(response, cookieValue) {
    response.cookies.set(KMUTNB_SSO_SESSION_COOKIE_NAME, cookieValue, getCookieSecurityOptions(KMUTNB_SSO_SESSION_MAX_AGE_SECONDS));
}

export function clearKmutnbSsoCookies(response) {
    response.cookies.set(KMUTNB_SSO_FLOW_COOKIE_NAME, '', getCookieSecurityOptions(0));
    response.cookies.set(KMUTNB_SSO_SESSION_COOKIE_NAME, '', getCookieSecurityOptions(0));
}

export function buildKmutnbSsoAuthorizeUrl(flow) {
    const config = getKmutnbSsoConfig();
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scopes,
        state: flow.state,
        nonce: flow.nonce,
        code_challenge: flow.codeChallenge,
        code_challenge_method: 'S256',
    });

    if (config.accessType) params.set('access_type', config.accessType);
    if (config.prompt) params.set('prompt', config.prompt);

    return `${config.authorizationEndpoint}?${params.toString()}`;
}

async function tokenRequest(body) {
    const config = getKmutnbSsoConfig();
    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const response = await axios.post(
        config.tokenEndpoint,
        body.toString(),
        {
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 15000,
            validateStatus: () => true,
        }
    );

    if (response.status !== 200 || !response.data?.access_token) {
        const message = response.data?.error_description || response.data?.error || 'KMUTNB SSO token exchange failed';
        const error = new Error(message);
        error.status = response.status >= 400 ? response.status : 502;
        throw error;
    }

    return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || null,
        idToken: response.data.id_token || null,
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope || config.scopes,
        accessTokenExpiresAt: computeExpiry(response.data.expires_in),
        userInfoFromToken: response.data.user_info || null,
    };
}

export async function exchangeKmutnbSsoAuthorizationCode(code, codeVerifier) {
    const config = getKmutnbSsoConfig();
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
    });

    if (config.accessType) body.set('access_type', config.accessType);
    return tokenRequest(body);
}

export async function refreshKmutnbSsoTokenBundle(refreshToken) {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });
    return tokenRequest(body);
}

export async function fetchKmutnbSsoUserInfo(accessToken) {
    const config = getKmutnbSsoConfig();
    const response = await axios.get(config.userInfoEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
        validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data) {
        const error = new Error('Failed to fetch KMUTNB SSO user info');
        error.status = response.status >= 400 ? response.status : 502;
        throw error;
    }

    return response.data;
}

export async function introspectKmutnbSsoAccessToken(accessToken) {
    const config = getKmutnbSsoConfig();
    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const body = new URLSearchParams({ token: accessToken, token_type_hint: 'access_token' });
    const response = await axios.post(config.introspectionEndpoint, body.toString(), {
        headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
        validateStatus: () => true,
    });

    if (response.status !== 200) {
        const error = new Error('Failed to introspect KMUTNB SSO access token');
        error.status = response.status >= 400 ? response.status : 502;
        throw error;
    }

    return response.data;
}

export function normalizeKmutnbSsoUserInfo(userInfo) {
    return {
        subject: readString(userInfo?.sub) || readString(userInfo?.preferred_username) || readString(userInfo?.username),
        username: readString(userInfo?.preferred_username) || readString(userInfo?.username),
        displayName: readString(userInfo?.name) || readString(userInfo?.display_name),
        nameEn: readString(userInfo?.name_en),
        email: readString(userInfo?.email),
        emailVerified: Boolean(userInfo?.email_verified),
        accountType: normalizeAccountType(userInfo),
        userCode: findUserCode(userInfo),
        studentInfo: userInfo?.kmutnb_student_info || userInfo?.student_info || userInfo?.studentInfo || null,
        personnelInfo: userInfo?.kmutnb_personnel_info || userInfo?.personnel_info || userInfo?.personnelInfo || null,
        raw: userInfo,
    };
}
