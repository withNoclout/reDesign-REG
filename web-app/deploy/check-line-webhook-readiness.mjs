import fs from 'node:fs/promises';

function parseArgs(argv) {
  const options = {
    envFile: '/etc/redesign-reg/redesign-reg-web.env',
    recentEventLimit: 5,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--env-file':
        options.envFile = argv[++index];
        break;
      case '--recent-event-limit':
        options.recentEventLimit = Number(argv[++index]);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function loadEnvFile(envFile) {
  const raw = await fs.readFile(envFile, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await loadEnvFile(options.envFile);

  const { createLineWebhookStore } = await import('../lib/lineWebhookStore.js');
  const { getLineWebhookReadiness } = await import('../lib/lineWebhookReadiness.js');

  const store = createLineWebhookStore();
  const recentEvents = typeof store.listRecentEvents === 'function'
    ? await store.listRecentEvents(options.recentEventLimit)
    : [];
  const readiness = await getLineWebhookReadiness({ recentEvents });
  console.log(JSON.stringify(readiness, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
