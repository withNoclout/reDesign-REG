import crypto from 'crypto';
import { getServiceSupabase } from '@/lib/supabase';
import { decryptKmutnbSsoToken, encryptKmutnbSsoToken } from '@/lib/kmutnbSsoCrypto';

const KMUTNB_SSO_SESSIONS_TABLE = 'kmutnb_sso_sessions';

function buildStorageError(error) {
    const tableMissing = error?.code === '42P01'
        || error?.message?.includes(KMUTNB_SSO_SESSIONS_TABLE)
        || error?.details?.includes?.(KMUTNB_SSO_SESSIONS_TABLE);

    if (tableMissing) {
        const wrapped = new Error('KMUTNB SSO session storage is not provisioned. Create the kmutnb_sso_sessions table first.');
        wrapped.code = 'SSO_SESSION_STORE_NOT_READY';
        wrapped.status = 503;
        return wrapped;
    }

    const wrapped = new Error(error?.message || 'KMUTNB SSO session storage failed');
    wrapped.code = error?.code || 'SSO_SESSION_STORE_ERROR';
    wrapped.status = 500;
    return wrapped;
}

function decodeRow(row) {
    if (!row) return null;

    return {
        sessionId: row.session_id,
        provider: row.provider,
        subject: row.sso_subject,
        userCode: row.user_code,
        accessToken: decryptKmutnbSsoToken(row.access_token_encrypted),
        refreshToken: decryptKmutnbSsoToken(row.refresh_token_encrypted),
        idToken: decryptKmutnbSsoToken(row.id_token_encrypted),
        scope: row.scope,
        tokenType: row.token_type,
        accessTokenExpiresAt: row.access_token_expires_at,
        userInfo: row.user_info || {},
        lastRefreshedAt: row.last_refreshed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        revokedAt: row.revoked_at,
    };
}

function encodeRow(session) {
    return {
        session_id: session.sessionId || crypto.randomUUID(),
        provider: session.provider || 'kmutnb_sso',
        sso_subject: session.subject,
        user_code: session.userCode || null,
        access_token_encrypted: encryptKmutnbSsoToken(session.accessToken),
        refresh_token_encrypted: encryptKmutnbSsoToken(session.refreshToken),
        id_token_encrypted: encryptKmutnbSsoToken(session.idToken),
        scope: session.scope || '',
        token_type: session.tokenType || 'Bearer',
        access_token_expires_at: session.accessTokenExpiresAt || null,
        user_info: session.userInfo || {},
        last_refreshed_at: session.lastRefreshedAt || null,
        updated_at: new Date().toISOString(),
        revoked_at: session.revokedAt || null,
    };
}

export async function createKmutnbSsoSession(session) {
    const supabase = getServiceSupabase();
    const row = {
        ...encodeRow(session),
        created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from(KMUTNB_SSO_SESSIONS_TABLE)
        .insert(row)
        .select('*')
        .single();

    if (error) throw buildStorageError(error);
    return decodeRow(data);
}

export async function getKmutnbSsoSession(sessionId) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(KMUTNB_SSO_SESSIONS_TABLE)
        .select('*')
        .eq('session_id', sessionId)
        .is('revoked_at', null)
        .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw buildStorageError(error);
    return decodeRow(data);
}

export async function refreshKmutnbSsoSession(sessionId, sessionPatch) {
    const supabase = getServiceSupabase();
    const updateRow = {
        ...encodeRow({ sessionId, ...sessionPatch }),
        last_refreshed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from(KMUTNB_SSO_SESSIONS_TABLE)
        .update(updateRow)
        .eq('session_id', sessionId)
        .is('revoked_at', null)
        .select('*')
        .single();

    if (error) throw buildStorageError(error);
    return decodeRow(data);
}

export async function revokeKmutnbSsoSession(sessionId) {
    const supabase = getServiceSupabase();
    const { error } = await supabase
        .from(KMUTNB_SSO_SESSIONS_TABLE)
        .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .is('revoked_at', null);

    if (error) throw buildStorageError(error);
}
