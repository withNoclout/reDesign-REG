import { success } from '@/lib/apiResponse';
import { getAuthContextStatus } from '@/lib/auth';

function readString(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function buildLegacySessionUser(authContext) {
    const upstream = readObject(authContext?.upstream);
    const tokenPayload = readObject(authContext?.tokenPayload);
    const userCode = readString(authContext?.userId)
        || readString(tokenPayload.usercode)
        || readString(tokenPayload.userid)
        || readString(tokenPayload.studentCode)
        || readString(upstream.usercode)
        || readString(upstream.studentCode)
        || readString(upstream.studentcode)
        || readString(upstream.studentId);
    const role = Array.isArray(tokenPayload.role)
        ? tokenPayload.role
        : (Array.isArray(upstream.role) ? upstream.role : []);

    return {
        username: readString(tokenPayload.username) || readString(upstream.username) || userCode,
        usernameeng: readString(tokenPayload.usernameeng) || readString(upstream.usernameeng),
        name: readString(tokenPayload.name) || readString(upstream.name),
        nameeng: readString(tokenPayload.nameeng) || readString(upstream.nameeng) || readString(upstream.full_name_en),
        email: readString(tokenPayload.email) || readString(upstream.email),
        usercode: userCode,
        userid: readString(tokenPayload.userid) || readString(upstream.userid) || userCode,
        userstatus: readString(tokenPayload.userstatus) || readString(upstream.userstatus),
        userstatusdes: readString(tokenPayload.userstatusdes) || readString(upstream.userstatusdes),
        statusdes: readString(tokenPayload.statusdes) || readString(upstream.statusdes),
        statusdeseng: readString(tokenPayload.statusdeseng) || readString(upstream.statusdeseng) || 'STUDENT',
        role,
        reportdate: readString(tokenPayload.reportdate) || readString(upstream.reportdate),
        img: readString(upstream.img),
        navimg: readString(upstream.navimg),
        authProvider: 'legacy_reg',
        authMode: 'legacy',
        legacyRegToken: Boolean(authContext?.token),
    };
}

function buildSsoSessionUser(authContext) {
    const ssoUser = authContext?.ssoUser || {};
    const raw = ssoUser.raw || {};
    const studentInfo = raw.studentInfo && typeof raw.studentInfo === 'object' ? raw.studentInfo : {};
    const personnelInfo = raw.personnelInfo && typeof raw.personnelInfo === 'object' ? raw.personnelInfo : {};
    const userCode = readString(authContext?.userId) || readString(ssoUser.userCode);
    const displayName = readString(ssoUser.displayName)
        || readString(studentInfo.full_name_th)
        || readString(studentInfo.full_name)
        || readString(personnelInfo.full_name_th)
        || userCode;
    const displayNameEn = readString(ssoUser.nameEn)
        || readString(studentInfo.full_name_en)
        || readString(personnelInfo.full_name_en)
        || displayName;

    return {
        username: readString(ssoUser.username) || readString(studentInfo.student_code) || userCode,
        usernameeng: displayNameEn,
        name: displayName,
        nameeng: displayNameEn,
        email: readString(ssoUser.email) || readString(studentInfo.email) || readString(personnelInfo.email),
        usercode: userCode,
        userid: userCode,
        userstatus: 'Y',
        userstatusdes: 'SSO',
        statusdes: readString(ssoUser.accountType) || 'sso',
        statusdeseng: (readString(ssoUser.accountType) || 'sso').toUpperCase(),
        role: [readString(ssoUser.accountType) || 'sso'],
        reportdate: '',
        img: null,
        navimg: null,
        authProvider: 'kmutnb_sso',
        authMode: 'sso',
        ssoSubject: readString(authContext?.ssoSession?.subject) || readString(ssoUser.subject),
        legacyRegToken: false,
    };
}

function buildSessionPayload(authContext, reason = 'UNKNOWN') {
    if (!authContext?.userId) {
        return { authenticated: false, reason, session: null, user: null, legacyRegToken: false };
    }

    const isSso = authContext.authProvider === 'kmutnb_sso';
    return {
        authenticated: true,
        reason,
        authProvider: authContext.authProvider,
        userId: authContext.userId,
        legacyRegToken: Boolean(authContext.token),
        session: isSso ? authContext.ssoSession : null,
        user: isSso ? buildSsoSessionUser(authContext) : buildLegacySessionUser(authContext),
    };
}

export async function GET() {
    const { authContext, reason } = await getAuthContextStatus();
    return success(buildSessionPayload(authContext, reason));
}
