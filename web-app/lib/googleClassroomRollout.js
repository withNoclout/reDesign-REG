function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeGoogleClassroomUserCode(value) {
    const normalized = readString(value);
    return normalized ? normalized.replace(/^s/i, '') : null;
}

export function getGoogleClassroomRolloutConfig() {
    const mode = readString(process.env.GOOGLE_CLASSROOM_ROLLOUT_MODE)?.toLowerCase() || 'pilot';
    const allowedUsers = new Set(
        (readString(process.env.GOOGLE_CLASSROOM_ROLLOUT_USERS) || '6701091611290')
            .split(',')
            .map((item) => normalizeGoogleClassroomUserCode(item))
            .filter(Boolean)
    );

    return {
        mode: ['all', 'pilot', 'off'].includes(mode) ? mode : 'pilot',
        allowedUsers,
    };
}

export function getGoogleClassroomRolloutState(userCode) {
    const normalizedUserCode = normalizeGoogleClassroomUserCode(userCode);
    const config = getGoogleClassroomRolloutConfig();

    if (config.mode === 'off') {
        return {
            mode: 'off',
            enabled: false,
            reason: 'disabled',
            userCode: normalizedUserCode,
        };
    }

    if (config.mode === 'all') {
        return {
            mode: 'all',
            enabled: true,
            reason: 'global',
            userCode: normalizedUserCode,
        };
    }

    if (!normalizedUserCode) {
        return {
            mode: 'pilot',
            enabled: false,
            reason: 'login_required',
            userCode: null,
        };
    }

    return {
        mode: 'pilot',
        enabled: config.allowedUsers.has(normalizedUserCode),
        reason: config.allowedUsers.has(normalizedUserCode) ? 'pilot_allowlist' : 'pilot_restricted',
        userCode: normalizedUserCode,
    };
}
