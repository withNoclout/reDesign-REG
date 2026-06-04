import fs from 'fs/promises';
import path from 'path';

const MARKER_START = '# >>> agent-memory-hook >>>';
const MARKER_END = '# <<< agent-memory-hook <<<' ;

function buildHookScript(repoRoot) {
    const relativeWebApp = path.relative(path.join(repoRoot, '.git', 'hooks'), path.join(repoRoot, 'web-app')).replace(/\\/g, '/');
    return `${MARKER_START}\nif [ -z "$AGENT_MEMORY_DISABLE_HOOK" ]; then\n  WEB_APP_DIR="$(cd "$(dirname \"$0\")/${relativeWebApp}" && pwd)"\n  (cd "$WEB_APP_DIR" && npm run graphify:refresh)\nfi\n${MARKER_END}`;
}

async function main() {
    const repoRoot = path.resolve(process.cwd(), '..');
    const hookPath = path.join(repoRoot, '.git', 'hooks', 'post-commit');
    const hookBody = buildHookScript(repoRoot);

    let existing = '';
    try {
        existing = await fs.readFile(hookPath, 'utf8');
    } catch {
        existing = '#!/bin/sh\n';
    }

    const withoutExistingHook = existing
        .replace(new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, 'g'), '')
        .trimEnd();
    const nextContent = `${withoutExistingHook}\n\n${hookBody}\n`;

    await fs.writeFile(hookPath, nextContent, { mode: 0o755 });
    console.log(`Installed agent memory post-commit hook at ${hookPath}`);
  }

main().catch((error) => {
    console.error('Failed to install agent memory hook:', error.message);
    process.exit(1);
});
