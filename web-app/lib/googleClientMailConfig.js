export const CLIENT_CLASSROOM_GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeClientClassroomUserCode(value) {
    const normalized = readString(value);
    return normalized ? normalized.replace(/^s/i, '') : null;
}

export function getClientGoogleMailConfig() {
    const rolloutMode = readString(process.env.NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_ROLLOUT_MODE)?.toLowerCase() || 'pilot';
    const rolloutUsers = new Set(
        (readString(process.env.NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_ROLLOUT_USERS) || '6701091611290')
            .split(',')
            .map((item) => normalizeClientClassroomUserCode(item))
            .filter(Boolean)
    );

    return {
        clientId: readString(process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID),
        query: readString(process.env.NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_QUERY)
            || 'newer_than:30d ("Google Classroom" OR classroom OR assignment OR announcement)',
        rolloutMode: ['all', 'pilot', 'off'].includes(rolloutMode) ? rolloutMode : 'pilot',
        rolloutUsers,
    };
}

export function getClientGoogleMailRollout(userCode) {
    const normalizedUserCode = normalizeClientClassroomUserCode(userCode);
    const config = getClientGoogleMailConfig();

    if (config.rolloutMode === 'off') {
        return { mode: 'off', enabled: false, reason: 'disabled', userCode: normalizedUserCode };
    }
    if (config.rolloutMode === 'all') {
        return { mode: 'all', enabled: true, reason: 'global', userCode: normalizedUserCode };
    }
    if (!normalizedUserCode) {
        return { mode: 'pilot', enabled: false, reason: 'login_required', userCode: null };
    }
    const enabled = config.rolloutUsers.has(normalizedUserCode);
    return {
        mode: 'pilot',
        enabled,
        reason: enabled ? 'pilot_allowlist' : 'pilot_restricted',
        userCode: normalizedUserCode,
    };
}
