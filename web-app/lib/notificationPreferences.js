import { getServiceSupabase } from './supabase.js';

const NOTIFICATION_CENTER_NAMESPACE = 'notificationCenter';

function normalizeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeIsoString(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeDismissedPromptMap(value) {
    const source = normalizeObject(value);
    const entries = Object.entries(source)
        .map(([promptId, dismissedAt]) => [String(promptId).trim(), normalizeIsoString(dismissedAt)])
        .filter(([promptId, dismissedAt]) => Boolean(promptId && dismissedAt));

    return Object.fromEntries(entries);
}

export function extractNotificationCenterPreferences(config) {
    const source = normalizeObject(config);
    const rawCenter = normalizeObject(source[NOTIFICATION_CENTER_NAMESPACE]);

    return {
        dismissedPromptIds: normalizeDismissedPromptMap(rawCenter.dismissedPromptIds),
    };
}

async function getUserSettingsRow(userCode) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from('user_settings')
        .select('portfolio_config')
        .eq('user_id', String(userCode))
        .single();

    if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to load notification preferences: ${error.message}`);
    }

    return data || null;
}

export async function getNotificationCenterPreferences(userCode) {
    if (!userCode) {
        return { dismissedPromptIds: {} };
    }

    const row = await getUserSettingsRow(userCode);
    return extractNotificationCenterPreferences(row?.portfolio_config);
}

export async function dismissNotificationPrompt(userCode, promptId) {
    const normalizedUserCode = String(userCode || '').trim();
    const normalizedPromptId = String(promptId || '').trim();

    if (!normalizedUserCode) {
        throw new Error('User code is required to dismiss a notification prompt');
    }

    if (!normalizedPromptId) {
        throw new Error('Prompt ID is required to dismiss a notification prompt');
    }

    const existingRow = await getUserSettingsRow(normalizedUserCode);
    const existingConfig = normalizeObject(existingRow?.portfolio_config);
    const existingPreferences = extractNotificationCenterPreferences(existingConfig);
    const nextConfig = {
        ...existingConfig,
        [NOTIFICATION_CENTER_NAMESPACE]: {
            ...normalizeObject(existingConfig[NOTIFICATION_CENTER_NAMESPACE]),
            dismissedPromptIds: {
                ...existingPreferences.dismissedPromptIds,
                [normalizedPromptId]: new Date().toISOString(),
            },
        },
    };

    const supabase = getServiceSupabase();
    const { error } = await supabase
        .from('user_settings')
        .upsert({
            user_id: normalizedUserCode,
            portfolio_config: nextConfig,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

    if (error) {
        throw new Error(`Failed to save notification preferences: ${error.message}`);
    }

    return extractNotificationCenterPreferences(nextConfig);
}
