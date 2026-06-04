import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function read(relPath) {
    return fs.readFile(path.join(root, relPath), 'utf8');
}

const [
    clientSource,
    lineSettingsService,
    instagramService,
    startRoute,
    callbackRoute,
    unlinkRoute,
    envExample,
] = await Promise.all([
    read('app/settings/line/LineSettingsPageClient.js'),
    read('lib/lineSettingsService.js'),
    read('lib/instagramPocService.js'),
    read('app/api/instagram/link/start/route.js'),
    read('app/api/instagram/link/callback/route.js'),
    read('app/api/instagram/link/unlink/route.js'),
    read('deploy/redesign-reg-web.env.example'),
]);

assert.match(clientSource, /Instagram POC/);
assert.match(clientSource, /เชื่อมบัญชี Instagram/);
assert.match(clientSource, /\/api\/instagram\/link\/unlink/);
assert.match(lineSettingsService, /instagram,/);
assert.match(instagramService, /buildInstagramPocConnectUrl/);
assert.match(instagramService, /completeInstagramPocAuthorization/);
assert.match(startRoute, /createInstagramPocFlow/);
assert.match(callbackRoute, /instagramConnected/);
assert.match(unlinkRoute, /disconnectInstagramPoc/);
assert.match(envExample, /INSTAGRAM_CLIENT_ID=/);
assert.match(envExample, /INSTAGRAM_CLIENT_SECRET=/);

console.log('PASS: test-instagram-line-settings');
