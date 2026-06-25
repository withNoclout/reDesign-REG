import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { verifyRelease } from './verify-release.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceAppRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(sourceAppRoot, '..');

function parseArgs(argv) {
  const options = {
    activate: false,
    skipInstall: false,
    releaseRoot: path.join(repoRoot, '.runtime'),
    envFile: '/etc/redesign-reg/redesign-reg-web.env',
    serviceName: 'redesign-reg-web.service',
    keepReleases: 3,
    releaseId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--activate':
        options.activate = true;
        break;
      case '--skip-install':
        options.skipInstall = true;
        break;
      case '--release-root':
        options.releaseRoot = path.resolve(argv[++index]);
        break;
      case '--env-file':
        options.envFile = path.resolve(argv[++index]);
        break;
      case '--service-name':
        options.serviceName = argv[++index];
        break;
      case '--keep-releases':
        options.keepReleases = Number(argv[++index]);
        break;
      case '--release-id':
        options.releaseId = argv[++index];
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.keepReleases) || options.keepReleases < 1) {
    throw new Error('--keep-releases must be an integer greater than 0');
  }

  if (!options.releaseId) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', 'T');
    options.releaseId = stamp;
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

function topLevelSegment(relativePath) {
  return relativePath.split(path.sep)[0];
}

function shouldCopySource(relativePath) {
  if (!relativePath) {
    return true;
  }

  const topLevel = topLevelSegment(relativePath);
  if (topLevel === 'node_modules' || topLevel === '.next' || topLevel === 'logs') {
    return false;
  }

  if (relativePath === 'public/temp' || relativePath.startsWith(`public${path.sep}temp${path.sep}`)) {
    return false;
  }

  return true;
}

async function copySourceTree(destinationAppRoot) {
  await fs.cp(sourceAppRoot, destinationAppRoot, {
    recursive: true,
    force: true,
    filter: (sourcePath) => {
      const relativePath = path.relative(sourceAppRoot, sourcePath);
      return shouldCopySource(relativePath);
    },
  });
}

async function ensureSymlink(targetPath, linkPath) {
  await fs.rm(linkPath, { recursive: true, force: true });
  await fs.mkdir(path.dirname(linkPath), { recursive: true });
  await fs.symlink(targetPath, linkPath, 'dir');
}

async function runCommand(command, args, { cwd, env } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

async function runCommandCapture(command, args, { cwd, env } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || `${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

async function readBuildId(appDir) {
  const buildIdPath = path.join(appDir, '.next', 'BUILD_ID');
  return (await fs.readFile(buildIdPath, 'utf8')).trim();
}

async function writeReleaseMetadata({ appDir, releaseId, releaseRoot, commitSha }) {
  const buildId = await readBuildId(appDir);
  const sharedRoot = path.join(releaseRoot, 'shared');
  const metadata = {
    REDESIGN_REG_RELEASE_ID: releaseId,
    REDESIGN_REG_BUILD_ID: buildId,
    REDESIGN_REG_COMMIT_SHA: commitSha,
    REDESIGN_REG_SHARED_ROOT: sharedRoot,
    REDESIGN_REG_LOG_DIR: path.join(sharedRoot, 'logs'),
    REDESIGN_REG_TEMP_DIR: path.join(sharedRoot, 'temp'),
    REDESIGN_REG_AGENT_MEMORY_DIR: path.join(sharedRoot, 'agent-memory'),
    REDESIGN_REG_DATA_DIR: path.join(appDir, 'data'),
  };

  const lines = Object.entries(metadata).map(([key, value]) => `${key}=${value}`);
  await fs.writeFile(path.join(appDir, '.release-meta.env'), `${lines.join('\n')}\n`, 'utf8');
  return metadata;
}

async function prepareReleaseDirectories(releaseRoot, releaseDir, releaseAppRoot) {
  const sharedRoot = path.join(releaseRoot, 'shared');
  await fs.mkdir(path.join(releaseRoot, 'releases'), { recursive: true });
  await fs.mkdir(path.join(sharedRoot, 'logs'), { recursive: true });
  await fs.mkdir(path.join(sharedRoot, 'temp'), { recursive: true });
  await fs.mkdir(path.join(sharedRoot, 'agent-memory'), { recursive: true });
  await fs.rm(releaseDir, { recursive: true, force: true });
  await fs.mkdir(releaseDir, { recursive: true });
  await copySourceTree(releaseAppRoot);
  await ensureSymlink(path.join(sharedRoot, 'logs'), path.join(releaseAppRoot, 'logs'));
  await ensureSymlink(path.join(sharedRoot, 'temp'), path.join(releaseAppRoot, 'public', 'temp'));
  await ensureSymlink(path.join(sharedRoot, 'agent-memory'), path.join(releaseAppRoot, '.agent-memory'));
}

async function installDependencies(destinationAppRoot, skipInstall, env) {
  if (skipInstall) {
    await runCommand('cp', ['-al', path.join(sourceAppRoot, 'node_modules'), path.join(destinationAppRoot, 'node_modules')], {
      cwd: repoRoot,
      env,
    });
    return;
  }

  await runCommand('/usr/local/bin/npm', ['ci'], {
    cwd: destinationAppRoot,
    env,
  });
}

async function buildRelease(destinationAppRoot, env) {
  await runCommand(process.execPath, ['deploy/check-env.mjs'], {
    cwd: destinationAppRoot,
    env,
  });
  await runCommand('/usr/local/bin/npm', ['run', 'build'], {
    cwd: destinationAppRoot,
    env,
  });
}
async function stageStandaloneRuntime(destinationAppRoot) {
  const standaloneRoot = path.join(destinationAppRoot, '.next', 'standalone');
  const standaloneStaticRoot = path.join(standaloneRoot, '.next', 'static');
  const standalonePublicRoot = path.join(standaloneRoot, 'public');

  await fs.mkdir(path.dirname(standaloneStaticRoot), { recursive: true });
  await fs.rm(standaloneStaticRoot, { recursive: true, force: true });
  await fs.rm(standalonePublicRoot, { recursive: true, force: true });
  await fs.cp(path.join(destinationAppRoot, '.next', 'static'), standaloneStaticRoot, { recursive: true, force: true });
  await fs.cp(path.join(destinationAppRoot, 'public'), standalonePublicRoot, { recursive: true, force: true });
}


async function updateCurrentSymlink(currentLink, targetReleaseDir) {
  const tempLink = `${currentLink}.tmp-${process.pid}`;
  await fs.rm(tempLink, { recursive: true, force: true });
  await fs.symlink(targetReleaseDir, tempLink, 'dir');
  await fs.rename(tempLink, currentLink);
}

async function readCurrentTarget(currentLink) {
  try {
    const linkTarget = await fs.readlink(currentLink);
    return path.resolve(path.dirname(currentLink), linkTarget);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function pruneOldReleases(releaseRoot, keepReleases, protectedDirs = []) {
  const releasesDir = path.join(releaseRoot, 'releases');
  const entries = await fs.readdir(releasesDir, { withFileTypes: true });
  const releaseDirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fullPath = path.join(releasesDir, entry.name);
    const stats = await fs.stat(fullPath);
    releaseDirs.push({ fullPath, mtimeMs: stats.mtimeMs });
  }

  releaseDirs.sort((left, right) => right.mtimeMs - left.mtimeMs);
  const protectedSet = new Set(protectedDirs.map((dirPath) => path.resolve(dirPath)));

  let kept = 0;
  for (const releaseDir of releaseDirs) {
    if (protectedSet.has(path.resolve(releaseDir.fullPath))) {
      kept += 1;
      continue;
    }

    if (kept < keepReleases) {
      kept += 1;
      continue;
    }

    await fs.rm(releaseDir.fullPath, { recursive: true, force: true });
  }
}

export async function releaseWeb({
  activate = false,
  skipInstall = false,
  releaseRoot = path.join(repoRoot, '.runtime'),
  envFile = '/etc/redesign-reg/redesign-reg-web.env',
  serviceName = 'redesign-reg-web.service',
  keepReleases = 3,
  releaseId,
} = {}) {
  const resolvedReleaseRoot = path.resolve(releaseRoot);
  const releaseDir = path.join(resolvedReleaseRoot, 'releases', releaseId);
  const releaseAppRoot = path.join(releaseDir, 'web-app');
  const currentLink = path.join(resolvedReleaseRoot, 'current');
  const deploymentEnv = await readOptionalEnvFile(envFile);
  const commitSha = await runCommandCapture('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, env: process.env });
  Object.assign(process.env, deploymentEnv);

  const buildEnv = {
    ...process.env,
    ...deploymentEnv,
    NODE_ENV: 'production',
  };

  await prepareReleaseDirectories(resolvedReleaseRoot, releaseDir, releaseAppRoot);
  await installDependencies(releaseAppRoot, skipInstall, buildEnv);
  await buildRelease(releaseAppRoot, buildEnv);
  await stageStandaloneRuntime(releaseAppRoot);
  const metadata = await writeReleaseMetadata({
    appDir: releaseAppRoot,
    releaseId,
    releaseRoot: resolvedReleaseRoot,
    commitSha,
  });
  const verification = await verifyRelease({ appDir: releaseAppRoot });

  let previousCurrent = null;
  if (activate) {
    previousCurrent = await readCurrentTarget(currentLink);

    try {
      await updateCurrentSymlink(currentLink, releaseDir);
      await runCommand('systemctl', ['restart', serviceName], {
        cwd: repoRoot,
        env: buildEnv,
      });
      await verifyRelease({ baseUrl: 'http://127.0.0.1:3333' });
    } catch (error) {
      if (previousCurrent) {
        await updateCurrentSymlink(currentLink, previousCurrent);
        await runCommand('systemctl', ['restart', serviceName], {
          cwd: repoRoot,
          env: buildEnv,
        });
      }
      throw error;
    }

    await pruneOldReleases(resolvedReleaseRoot, keepReleases, [releaseDir, previousCurrent].filter(Boolean));
  }

  return {
    releaseId,
    releaseDir,
    appDir: releaseAppRoot,
    metadata,
    verification,
    activated: activate,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await releaseWeb(options);
  console.log(JSON.stringify(result, null, 2));
}

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exit(1);
  });
}
