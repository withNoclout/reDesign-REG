import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const IPV4_PARTS = 4;
const IPV4_BITS = 32;

function readEnv(name) {
    const value = process.env[name];
    return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readBoolEnv(name) {
    return ['1', 'true', 'yes', 'on'].includes(readEnv(name).toLowerCase());
}

function normalizeUserCode(value) {
    return String(value || '').trim().replace(/^s/i, '');
}

function splitList(value) {
    return String(value || '')
        .split(/[\s,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function readFirstHeaderValue(value) {
    if (!value) return '';
    const commaIndex = value.indexOf(',');
    return (commaIndex === -1 ? value : value.slice(0, commaIndex)).trim();
}

function stripPort(host) {
    if (!host) return '';
    if (host.startsWith('[')) {
        const closingBracket = host.indexOf(']');
        return closingBracket === -1 ? host : host.slice(1, closingBracket);
    }
    const colonIndex = host.lastIndexOf(':');
    return colonIndex === -1 ? host : host.slice(0, colonIndex);
}

function getRequestHost(request) {
    return stripPort(
        readFirstHeaderValue(
            request?.headers?.get('x-forwarded-host')
            || request?.headers?.get('host')
            || request?.nextUrl?.host
            || request?.nextUrl?.hostname
            || ''
        ).toLowerCase()
    );
}

function parseIpv4(value) {
    const parts = String(value || '').trim().split('.');
    if (parts.length !== IPV4_PARTS) return null;

    let result = 0;
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return null;
        const octet = Number(part);
        if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
        result = ((result << 8) | octet) >>> 0;
    }

    return result >>> 0;
}

function parseCidr(entry) {
    const [ipPart, prefixPart = '32'] = String(entry || '').trim().split('/');
    const ip = parseIpv4(ipPart);
    const prefix = Number(prefixPart);

    if (ip === null || !Number.isInteger(prefix) || prefix < 0 || prefix > IPV4_BITS) {
        return null;
    }

    const mask = prefix === 0 ? 0 : (0xffffffff << (IPV4_BITS - prefix)) >>> 0;
    return { network: ip & mask, mask };
}

function ipMatchesAnyCidr(ipValue, cidrEntries) {
    const ip = parseIpv4(readFirstHeaderValue(ipValue));
    if (ip === null) return false;

    return cidrEntries.some((entry) => {
        const cidr = parseCidr(entry);
        return cidr ? (ip & cidr.mask) === cidr.network : false;
    });
}

function hashForAudit(value) {
    return crypto
        .createHash('sha256')
        .update(String(value || ''))
        .digest('hex')
        .slice(0, 16);
}

function buildAliasAudit({ request, clientIp, reason, allowed }) {
    return {
        allowed,
        reason,
        clientIp: readFirstHeaderValue(clientIp) || 'unknown',
        forwardedHost: getRequestHost(request) || 'unknown',
        userAgentHash: hashForAudit(request?.headers?.get('user-agent') || ''),
    };
}

function denyAlias(input, reason) {
    return {
        matched: true,
        allowed: false,
        username: input.username,
        password: input.password,
        targetUserCode: null,
        audit: buildAliasAudit({ ...input, reason, allowed: false }),
    };
}

export function isLoginAliasEnabled() {
    return readBoolEnv('REG_LOGIN_ALIAS_ENABLED');
}

export function normalizeAliasTargetUserCode(value) {
    return normalizeUserCode(value);
}

export async function resolveLoginAlias({ username, password, request, clientIp }) {
    const aliasUser = readEnv('REG_LOGIN_ALIAS_USER');
    const input = { username, password, request, clientIp };

    if (!isLoginAliasEnabled() || !aliasUser || String(username || '').trim() !== aliasUser) {
        return { matched: false, allowed: false, username, password, targetUserCode: null, audit: null };
    }

    const allowedHosts = splitList(readEnv('REG_LOGIN_ALIAS_ALLOWED_HOSTS')).map((host) => stripPort(host.toLowerCase()));
    const requestHost = getRequestHost(request);
    if (!allowedHosts.length || !allowedHosts.includes(requestHost)) {
        return denyAlias(input, 'host_not_allowlisted');
    }

    const allowedCidrs = splitList(readEnv('REG_LOGIN_ALIAS_ALLOWED_CIDRS'));
    if (!allowedCidrs.length || !ipMatchesAnyCidr(clientIp, allowedCidrs)) {
        return denyAlias(input, 'ip_not_allowlisted');
    }

    const passwordHash = readEnv('REG_LOGIN_ALIAS_PASSWORD_HASH');
    if (!passwordHash) {
        return denyAlias(input, 'password_hash_missing');
    }

    const passwordMatches = await bcrypt.compare(String(password || ''), passwordHash);
    if (!passwordMatches) {
        return denyAlias(input, 'password_mismatch');
    }

    const targetUsername = readEnv('REG_LOGIN_ALIAS_TARGET_USER');
    const targetPassword = readEnv('REG_LOGIN_ALIAS_TARGET_PASSWORD');
    const targetUserCode = normalizeUserCode(readEnv('REG_LOGIN_ALIAS_TARGET_USERCODE'));

    if (!targetUsername || !targetPassword || !targetUserCode) {
        return denyAlias(input, 'target_config_missing');
    }

    return {
        matched: true,
        allowed: true,
        username: targetUsername,
        password: targetPassword,
        targetUserCode,
        audit: buildAliasAudit({ ...input, reason: 'allowed', allowed: true }),
    };
}

export function assertLoginAliasTarget(aliasResult, upstreamUserCode) {
    if (!aliasResult?.matched || !aliasResult.allowed) return true;
    return normalizeUserCode(upstreamUserCode) === aliasResult.targetUserCode;
}

export function logLoginAliasAudit(aliasResult) {
    if (!aliasResult?.matched || !aliasResult.audit) return;

    const level = aliasResult.allowed ? 'info' : 'warn';
    console[level]('[LoginAlias]', aliasResult.audit);
}
