import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const unitFiles = [
    'redesign-reg-agent-memory-refresh.service',
    'redesign-reg-agent-memory-refresh.timer',
    'redesign-reg-agent-memory-embeddings.service',
    'redesign-reg-agent-memory-embeddings.timer',
];

function getFlag(name, fallback = null) {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1) return fallback;
    return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'inherit' });
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} exited with code ${code}`));
        });
        child.on('error', reject);
    });
}

async function main() {
    const systemdDir = path.resolve(getFlag('systemd-dir', '/etc/systemd/system'));
    const printOnly = hasFlag('print-only');
    const sourceDir = path.join(__dirname, '../deploy/systemd');

    if (printOnly) {
        const installCommands = unitFiles.map((file) => `install -m 0644 ${path.join(sourceDir, file)} ${path.join(systemdDir, file)}`);
        console.log([...installCommands, 'systemctl daemon-reload', 'systemctl enable --now redesign-reg-agent-memory-refresh.timer', 'systemctl enable --now redesign-reg-agent-memory-embeddings.timer'].join('\n'));
        return;
    }

    await fs.mkdir(systemdDir, { recursive: true });
    for (const file of unitFiles) {
        await fs.copyFile(path.join(sourceDir, file), path.join(systemdDir, file));
    }

    await run('systemctl', ['daemon-reload']);
    await run('systemctl', ['enable', '--now', 'redesign-reg-agent-memory-refresh.timer']);
    await run('systemctl', ['enable', '--now', 'redesign-reg-agent-memory-embeddings.timer']);

    console.log(`Installed agent memory services into ${systemdDir}`);
}

main().catch((error) => {
    console.error('Failed to install agent memory services:', error.message);
    process.exit(1);
});
