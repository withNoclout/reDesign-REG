import path from 'node:path';

function readEnvPath(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? path.resolve(value.trim()) : null;
}

export function getAppRoot() {
  return /* turbopackIgnore: true */ process.cwd();
}

export function getLogDir() {
  return readEnvPath('REDESIGN_REG_LOG_DIR') ?? path.join(/* turbopackIgnore: true */ process.cwd(), 'logs');
}

export function getLogFilePath(filename = 'app.log') {
  const configuredLogDir = readEnvPath('REDESIGN_REG_LOG_DIR');
  return configuredLogDir
    ? path.join(configuredLogDir, filename)
    : path.join(/* turbopackIgnore: true */ process.cwd(), 'logs', filename);
}

export function getTempDir() {
  return readEnvPath('REDESIGN_REG_TEMP_DIR') ?? path.join(/* turbopackIgnore: true */ process.cwd(), 'public', 'temp');
}

export function getAgentMemoryRoot() {
  return readEnvPath('REDESIGN_REG_AGENT_MEMORY_DIR') ?? path.join(/* turbopackIgnore: true */ process.cwd(), '.agent-memory');
}

export function getDataDir() {
  return readEnvPath('REDESIGN_REG_DATA_DIR') ?? path.join(/* turbopackIgnore: true */ process.cwd(), 'data');
}

export function getDataPath(filename) {
  const configuredDataDir = readEnvPath('REDESIGN_REG_DATA_DIR');
  return configuredDataDir
    ? path.join(configuredDataDir, filename)
    : path.join(/* turbopackIgnore: true */ process.cwd(), 'data', filename);
}
