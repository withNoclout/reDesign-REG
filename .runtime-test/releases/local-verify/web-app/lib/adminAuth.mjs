import { getAuthUser } from './auth';
import { normalizeComparableUserId } from './agentMemoryConfig.mjs';

export function getConfiguredAdminUserId() {
    return normalizeComparableUserId(process.env.ADMIN_USER_ID || '');
}

export async function requireAdminUser() {
    const userId = await getAuthUser();
    const normalizedUserId = normalizeComparableUserId(userId);
    const adminUserId = getConfiguredAdminUserId();

    return {
        allowed: Boolean(normalizedUserId && adminUserId && normalizedUserId === adminUserId),
        userId: normalizedUserId,
        adminUserId,
    };
}
