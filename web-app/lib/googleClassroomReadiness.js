import { getClientGoogleMailConfig, getClientGoogleMailRollout, normalizeClientClassroomUserCode } from './googleClientMailConfig.js';

function buildChecklistItem(id, label, ready, detail = null) {
    return { id, label, ready, detail };
}

function buildBlocker(id, severity, message) {
    return { id, severity, message };
}

function buildStatus(blockers) {
    if (blockers.some((item) => item.severity === 'critical')) return 'blocked';
    if (blockers.some((item) => item.severity === 'warning')) return 'attention';
    return 'ready';
}

function buildNextSteps({ configured, rollout }) {
    const steps = [];
    if (!configured) {
        steps.push('ตั้งค่า NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ใน environment ของ frontend ก่อน');
    }
    if (rollout.mode === 'pilot' && !rollout.enabled) {
        steps.push('เพิ่ม user นี้ใน NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_ROLLOUT_USERS หรือสลับ rollout mode เป็น all');
    }
    if (rollout.mode === 'off') {
        steps.push('เปลี่ยน NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_ROLLOUT_MODE จาก off เป็น pilot หรือ all เมื่อพร้อมเปิดใช้');
    }
    if (configured && rollout.enabled) {
        steps.push('เปิด /settings/classroom ใน browser ของ user เป้าหมาย แล้วกด Apply + Connect เพื่อให้ Google popup ขอ Gmail readonly');
        steps.push('หลังอนุญาตแล้วกด Sync now และยืนยันว่ามีอีเมล Classroom ถูก parse มาแสดงใน Notification Bell ของ browser นั้น');
    }
    return steps;
}

export async function evaluateGoogleClassroomReadiness(userCode) {
    const normalizedUserCode = normalizeClientClassroomUserCode(userCode);
    const config = getClientGoogleMailConfig();
    const configured = Boolean(config.clientId);
    const rollout = getClientGoogleMailRollout(normalizedUserCode);
    const missingConfig = configured ? [] : ['NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID'];

    const checklist = [
        buildChecklistItem('public-client-id', 'Public Google OAuth Client ID พร้อมใช้งาน', configured, configured ? 'Client-only GIS flow can initialize popup consent.' : 'Missing NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID'),
        buildChecklistItem('rollout', 'Rollout อนุญาตให้ user นี้ใช้งาน', rollout.enabled, `mode=${rollout.mode}; reason=${rollout.reason}`),
        buildChecklistItem('browser-local-session', 'ยอมรับข้อจำกัดว่า session/notifications เก็บใน browser-local storage', true, 'Server-side readiness ไม่สามารถยืนยันการเชื่อมต่อหรือ notification ของ browser ใด browser หนึ่งได้ ต้องทดสอบใน browser จริงของผู้ใช้'),
    ];

    const blockers = [];
    if (!configured) blockers.push(buildBlocker('missing-public-client-id', 'critical', 'ยังขาด NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID')); 
    if (rollout.mode === 'off') blockers.push(buildBlocker('rollout-off', 'critical', 'Google Mail Classroom POC ถูกปิดใช้งานชั่วคราว')); 
    else if (!rollout.enabled) blockers.push(buildBlocker('pilot-restricted', 'warning', 'ผู้ใช้นี้ยังไม่อยู่ใน pilot rollout')); 

    return {
        checkedAt: new Date().toISOString(),
        userCode: normalizedUserCode,
        status: buildStatus(blockers),
        configured,
        pushConfigured: false,
        missingConfig,
        rollout,
        connected: null,
        reconnectRequired: false,
        mode: 'gmail-client-poc',
        browserLocalOnly: true,
        connection: null,
        checklist,
        blockers,
        nextSteps: buildNextSteps({ configured, rollout }),
    };
}
