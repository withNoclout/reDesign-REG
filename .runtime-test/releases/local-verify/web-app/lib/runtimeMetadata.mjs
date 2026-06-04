import fs from 'node:fs';
import path from 'node:path';

import { getAgentMemoryRoot, getAppRoot, getDataDir, getLogDir, getTempDir } from './runtimePaths.mjs';

function readEnvPath(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? path.resolve(value.trim()) : null;
}

export function readRuntimeMetadata() {
  const appRoot = getAppRoot();
  const buildIdPath = path.join(appRoot, '.next', 'BUILD_ID');
  let buildId = typeof process.env.REDESIGN_REG_BUILD_ID === 'string' ? process.env.REDESIGN_REG_BUILD_ID.trim() : '';

  if (!buildId && fs.existsSync(buildIdPath)) {
    buildId = fs.readFileSync(buildIdPath, 'utf8').trim();
  }

  return {
    appRoot,
    releaseId: typeof process.env.REDESIGN_REG_RELEASE_ID === 'string' ? process.env.REDESIGN_REG_RELEASE_ID.trim() || null : null,
    buildId: buildId || null,
    commitSha: typeof process.env.REDESIGN_REG_COMMIT_SHA === 'string' ? process.env.REDESIGN_REG_COMMIT_SHA.trim() || null : null,
    sharedRoot: readEnvPath('REDESIGN_REG_SHARED_ROOT'),
    tempDir: getTempDir(),
    logDir: getLogDir(),
    agentMemoryDir: getAgentMemoryRoot(),
    dataDir: getDataDir(),
  };
}
