import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const options = {
    appDir: null,
    baseUrl: null,
    port: 4010,
    timeoutMs: 30_000,
    keepServer: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--app-dir':
        options.appDir = path.resolve(argv[++index]);
        break;
      case '--base-url':
        options.baseUrl = argv[++index];
        break;
      case '--port':
        options.port = Number(argv[++index]);
        break;
      case '--timeout-ms':
        options.timeoutMs = Number(argv[++index]);
        break;
      case '--keep-server':
        options.keepServer = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.baseUrl && !options.appDir) {
    throw new Error('Provide --base-url or --app-dir');
  }

  return options;
}

async function readOptionalEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

function extractChunkAssets(html) {
  const assets = new Set();
  const pattern = /\/_next\/static\/chunks\/[^"'\s<)]+/g;
  for (const match of html.matchAll(pattern)) {
    assets.add(match[0].replace(/\\$/g, ''));
  }
  return [...assets];
}

function expectContentType(assetPath, contentType) {
  if (assetPath.endsWith('.css')) {
    return /text\/css/i.test(contentType || '');
  }
  return /javascript|ecmascript/i.test(contentType || '');
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function waitForServer(url, timeoutMs, childState = null) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    if (childState?.exited) {
      throw new Error(`Standalone server exited before becoming ready.\nSTDOUT:\n${childState.stdout}\nSTDERR:\n${childState.stderr}`);
    }

    try {
      const response = await fetchWithTimeout(url, 2_000);
      if (response.ok) {
        await response.arrayBuffer();
        return;
      }
      lastError = new Error(`Received HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || 'unknown error'}`);
}

async function readResponseSnippet(response) {
  const text = await response.text();
  return text.slice(0, 300);
}

export async function verifyRelease({ appDir = null, baseUrl = null, port = 4010, timeoutMs = 30_000, keepServer = false } = {}) {
  let child = null;
  const childState = {
    exited: false,
    stdout: '',
    stderr: '',
  };

  let effectiveBaseUrl = baseUrl;

  try {
    if (!effectiveBaseUrl) {
      const releaseEnv = await readOptionalEnvFile(path.join(appDir, '.release-meta.env'));
      child = spawn(process.execPath, ['.next/standalone/server.js'], {
        cwd: appDir,
        env: {
          ...process.env,
          ...releaseEnv,
          NODE_ENV: 'production',
          HOSTNAME: '127.0.0.1',
          PORT: String(port),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (chunk) => {
        childState.stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        childState.stderr += chunk.toString();
      });
      child.on('exit', () => {
        childState.exited = true;
      });
      effectiveBaseUrl = `http://127.0.0.1:${port}`;
      await waitForServer(`${effectiveBaseUrl}/`, timeoutMs, childState);
    } else {
      await waitForServer(`${effectiveBaseUrl}/`, timeoutMs);
    }

    const htmlResponse = await fetchWithTimeout(`${effectiveBaseUrl}/`, timeoutMs);
    if (!htmlResponse.ok) {
      throw new Error(`Root request failed with HTTP ${htmlResponse.status}`);
    }

    const html = await htmlResponse.text();
    const assets = extractChunkAssets(html);
    if (assets.length === 0) {
      throw new Error('No chunk assets were discovered in the root HTML response');
    }

    const verifiedAssets = [];
    for (const assetPath of assets) {
      const assetResponse = await fetchWithTimeout(`${effectiveBaseUrl}${assetPath}`, timeoutMs);
      if (!assetResponse.ok) {
        const snippet = await readResponseSnippet(assetResponse);
        throw new Error(`Asset ${assetPath} failed with HTTP ${assetResponse.status}: ${snippet}`);
      }

      const contentType = assetResponse.headers.get('content-type') || '';
      if (!expectContentType(assetPath, contentType)) {
        throw new Error(`Asset ${assetPath} returned unexpected content type: ${contentType || 'missing'}`);
      }

      await assetResponse.arrayBuffer();
      verifiedAssets.push({ assetPath, contentType });
    }

    const healthResponse = await fetchWithTimeout(`${effectiveBaseUrl}/api/health`, timeoutMs);
    const healthBody = await healthResponse.json();
    if (healthResponse.status !== 200 && healthResponse.status !== 503) {
      throw new Error(`Health endpoint returned unexpected HTTP ${healthResponse.status}`);
    }
    if (!healthBody?.runtime || !Object.prototype.hasOwnProperty.call(healthBody.runtime, 'buildId') || !Object.prototype.hasOwnProperty.call(healthBody.runtime, 'releaseId')) {
      throw new Error('Health endpoint did not expose runtime build metadata');
    }

    return {
      baseUrl: effectiveBaseUrl,
      assetCount: verifiedAssets.length,
      assets: verifiedAssets,
      health: {
        status: healthResponse.status,
        runtime: healthBody.runtime,
      },
    };
  } finally {
    if (child && !keepServer) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await verifyRelease(options);
  console.log(JSON.stringify(result, null, 2));
}

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exit(1);
  });
}