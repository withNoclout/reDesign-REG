import path from 'node:path';

function readEnvPath(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? path.resolve(value.trim()) : null;
}

export function getAppRoot() {
  return process.cwd();
}

export function getLogDir() {
  return readEnvPath('REDESIGN_REG_LOG_DIR') ?? path.join(getAppRoot(), 'logs');
}

export function getLogFilePath(filename = 'app.log') {
  return path.join(getLogDir(), filename);
}

export function getTempDir() {
  return readEnvPath('REDESIGN_REG_TEMP_DIR') ?? path.join(getAppRoot(), 'public', 'temp');
}

export function getAgentMemoryRoot() {
  return readEnvPath('REDESIGN_REG_AGENT_MEMORY_DIR') ?? path.join(getAppRoot(), '.agent-memory');
}

export function getDataDir() {
  return readEnvPath('REDESIGN_REG_DATA_DIR') ?? path.join(getAppRoot(), 'data');
}

export function getDataPath(filename) {
  return path.join(getDataDir(), filename);
}
