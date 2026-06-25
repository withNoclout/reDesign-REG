import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const previewPhase = process.argv[2] || process.env.STUDENT_LOAN_PILOT_PREVIEW_PHASE || 'open';
const allowedPhases = new Set(['open', 'closingSoon', 'live']);

if (!allowedPhases.has(previewPhase)) {
    console.error(`Unsupported preview phase '${previewPhase}'. Use open, closingSoon, or live.`);
    process.exit(1);
}

async function loadCentralService() {
    return import('../lib/studentLoanCentralService.js');
}

function resolveSyncOptions(phase, service) {
    if (phase === 'live') {
        return {
            seedPilot: true,
            pilotMode: 'live',
            pilotPreviewNow: null,
            userCodes: ['6701091611290'],
            resetNotificationState: true,
        };
    }

    return {
        seedPilot: true,
        pilotMode: 'preview',
        pilotPreviewNow: phase === 'closingSoon'
            ? service.STUDENT_LOAN_PILOT_CLOSING_PREVIEW_NOW
            : service.STUDENT_LOAN_PILOT_OPEN_PREVIEW_NOW,
        userCodes: ['6701091611290'],
        resetNotificationState: true,
    };
}

async function main() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    }

    const service = await loadCentralService();
    const result = await service.syncStudentLoanCentralState(resolveSyncOptions(previewPhase, service));
    console.log(JSON.stringify({
        phase: previewPhase,
        result,
    }, null, 2));
}

main().catch((error) => {
    console.error('Failed to activate student loan pilot:', error.message);
    process.exit(1);
});
