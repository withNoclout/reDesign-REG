import { getServiceSupabase } from './supabase.js';

export const PORTFOLIO_CONFIG_DEFAULTS = {
    columnCount: 3,
    gapSize: 'normal',
};

export const STUDENT_LOAN_NAMESPACE = 'studentLoan';

const BORROWER_TYPES = new Set(['new', 'continuing']);
const EDUCATION_LEVELS = new Set(['vocational', 'bachelor']);

function normalizeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeIsoString(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeBorrowerType(value) {
    return BORROWER_TYPES.has(value) ? value : null;
}

function normalizeEducationLevel(value) {
    return EDUCATION_LEVELS.has(value) ? value : null;
}

export function normalizeBorrowerProfile(value) {
    const source = normalizeObject(value);
    const borrowerType = normalizeBorrowerType(source.borrowerType);
    const educationLevel = normalizeEducationLevel(source.educationLevel);

    if (!borrowerType || !educationLevel) {
        return null;
    }

    return {
        borrowerType,
        educationLevel,
        source: source.source === 'manual' ? 'manual' : 'recommended',
        confirmedAt: normalizeIsoString(source.confirmedAt) || new Date().toISOString(),
        updatedAt: normalizeIsoString(source.updatedAt) || new Date().toISOString(),
    };
}

export function normalizeNotificationClicks(value) {
    const source = normalizeObject(value);
    const entries = Object.entries(source)
        .map(([notificationId, clickedAt]) => [notificationId, normalizeIsoString(clickedAt)])
        .filter(([, clickedAt]) => Boolean(clickedAt));

    return Object.fromEntries(entries);
}

export function extractStudentLoanSettings(config) {
    const source = normalizeObject(config);
    const rawLoanSettings = normalizeObject(source[STUDENT_LOAN_NAMESPACE]);

    return {
        borrowerProfile: normalizeBorrowerProfile(rawLoanSettings.borrowerProfile),
        notificationClicks: normalizeNotificationClicks(rawLoanSettings.notificationClicks),
    };
}

export function mergePortfolioConfigPreservingStudentLoan(existingConfig, nextConfig) {
    const previous = normalizeObject(existingConfig);
    const incoming = normalizeObject(nextConfig);
    const merged = { ...previous, ...incoming };

    if (!(STUDENT_LOAN_NAMESPACE in incoming) && previous[STUDENT_LOAN_NAMESPACE] !== undefined) {
        merged[STUDENT_LOAN_NAMESPACE] = previous[STUDENT_LOAN_NAMESPACE];
    }

    return merged;
}

async function getUserSettingsRow(userId) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from('user_settings')
        .select('portfolio_config')
        .eq('user_id', String(userId))
        .single();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    return data || null;
}

export async function getStoredPortfolioConfig(userId) {
    const row = await getUserSettingsRow(userId);
    return normalizeObject(row?.portfolio_config);
}

export async function saveStoredPortfolioConfig(userId, config) {
    const supabase = getServiceSupabase();
    const { error } = await supabase
        .from('user_settings')
        .upsert({
            user_id: String(userId),
            portfolio_config: normalizeObject(config),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

    if (error) {
        throw error;
    }
}

export async function saveBorrowerProfile(userId, profile) {
    const existingConfig = await getStoredPortfolioConfig(userId);
    const existingLoanSettings = extractStudentLoanSettings(existingConfig);
    const now = new Date().toISOString();
    const normalizedProfile = normalizeBorrowerProfile({
        ...profile,
        source: 'manual',
        confirmedAt: existingLoanSettings.borrowerProfile?.confirmedAt || now,
        updatedAt: now,
    });

    const nextConfig = {
        ...existingConfig,
        [STUDENT_LOAN_NAMESPACE]: {
            borrowerProfile: normalizedProfile,
            notificationClicks: existingLoanSettings.notificationClicks,
        },
    };

    await saveStoredPortfolioConfig(userId, nextConfig);
    return normalizedProfile;
}

export async function recordLoanNotificationClick(userId, notificationId) {
    if (!notificationId) return;

    const existingConfig = await getStoredPortfolioConfig(userId);
    const existingLoanSettings = extractStudentLoanSettings(existingConfig);
    const nextConfig = {
        ...existingConfig,
        [STUDENT_LOAN_NAMESPACE]: {
            borrowerProfile: existingLoanSettings.borrowerProfile,
            notificationClicks: {
                ...existingLoanSettings.notificationClicks,
                [notificationId]: new Date().toISOString(),
            },
        },
    };

    await saveStoredPortfolioConfig(userId, nextConfig);
}
