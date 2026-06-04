import fs from 'fs';
import path from 'path';
import { evaluateGoogleClassroomReadiness } from '../lib/googleClassroomReadiness.js';

const userCode = process.argv[2] || '6701091611290';

function loadDotEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;

    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        if (!line || line.trim().startsWith('#')) continue;
        const separator = line.indexOf('=');
        if (separator < 0) continue;
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

async function main() {
    loadDotEnvLocal();
    const readiness = await evaluateGoogleClassroomReadiness(userCode);
    console.log(JSON.stringify(readiness, null, 2));

    if (readiness.status !== 'ready') {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error('[check-classroom-pilot-readiness] Failed:', error);
    process.exitCode = 1;
});
