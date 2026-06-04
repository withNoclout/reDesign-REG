import { getStoredPortfolioConfig, saveStoredPortfolioConfig } from './studentLoanSettings.js';

export const GOOGLE_CLASSROOM_SETTINGS_NAMESPACE = 'googleClassroom';

export const GOOGLE_CLASSROOM_FEATURE_DEFAULTS = Object.freeze({
    announcements: true,
    coursework: true,
    returnedWork: true,
    pushSync: false,
});

export const GOOGLE_CLASSROOM_FEATURE_CATALOG = Object.freeze([
    {
        key: 'announcements',
        label: 'ประกาศจาก Google Classroom',
        description: 'อ่านข้อความอีเมลแจ้งเตือนจาก Google Classroom แล้วนำประกาศใหม่มาแสดงในกระดิ่งแจ้งเตือน',
        required: true,
        scopeGroup: 'core',
    },
    {
        key: 'coursework',
        label: 'งานหรือ assignment ใหม่',
        description: 'อ่านข้อความอีเมลแจ้งเตือนเมื่อมี coursework ใหม่หรือมีการอัปเดตรายละเอียดของงาน',
        required: true,
        scopeGroup: 'core',
    },
    {
        key: 'returnedWork',
        label: 'งานที่ถูกส่งคืนและคะแนน',
        description: 'อ่านข้อความอีเมลแจ้งเตือนเมื่ออาจารย์ส่งคืนงานหรือมีการอัปเดตคะแนนของคุณ',
        required: true,
        scopeGroup: 'core',
    },
    {
        key: 'pushSync',
        label: 'ซิงก์ใกล้เคียงเวลาจริง',
        description: 'สำรองไว้สำหรับโหมด sync ที่ถี่ขึ้นในอนาคต POC ระยะแรกยังใช้การอ่านอีเมลแบบ polling',
        required: false,
        scopeGroup: 'push',
    },
]);

function normalizeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeBoolean(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
}

export function normalizeGoogleClassroomFeatureSelection(value, { pushAvailable = true } = {}) {
    const source = normalizeObject(value);
    const next = {
        announcements: true,
        coursework: true,
        returnedWork: true,
        pushSync: normalizeBoolean(source.pushSync, GOOGLE_CLASSROOM_FEATURE_DEFAULTS.pushSync),
    };

    if (!pushAvailable) {
        next.pushSync = false;
    }

    return next;
}

export function extractGoogleClassroomSettings(config, { pushAvailable = true } = {}) {
    const source = normalizeObject(config);
    const rawSettings = normalizeObject(source[GOOGLE_CLASSROOM_SETTINGS_NAMESPACE]);

    return {
        selectedFeatures: normalizeGoogleClassroomFeatureSelection(rawSettings.selectedFeatures, { pushAvailable }),
    };
}

export async function getStoredGoogleClassroomSettings(userCode, { pushAvailable = true } = {}) {
    const config = await getStoredPortfolioConfig(userCode);
    return extractGoogleClassroomSettings(config, { pushAvailable });
}

export async function saveStoredGoogleClassroomSettings(userCode, settings, { pushAvailable = true } = {}) {
    const config = await getStoredPortfolioConfig(userCode);
    const source = normalizeObject(config);
    const nextConfig = {
        ...source,
        [GOOGLE_CLASSROOM_SETTINGS_NAMESPACE]: {
            ...normalizeObject(source[GOOGLE_CLASSROOM_SETTINGS_NAMESPACE]),
            selectedFeatures: normalizeGoogleClassroomFeatureSelection(settings?.selectedFeatures, { pushAvailable }),
            updatedAt: new Date().toISOString(),
        },
    };

    await saveStoredPortfolioConfig(userCode, nextConfig);
    return extractGoogleClassroomSettings(nextConfig, { pushAvailable });
}

export function buildGoogleClassroomFeatureCatalog({ pushAvailable = false } = {}) {
    return GOOGLE_CLASSROOM_FEATURE_CATALOG.map((item) => ({
        ...item,
        available: item.scopeGroup !== 'push' || pushAvailable,
    }));
}
