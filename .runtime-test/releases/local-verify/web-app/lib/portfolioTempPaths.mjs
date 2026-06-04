import fs from 'node:fs';
import path from 'node:path';

import { getAppRoot, getTempDir } from './runtimePaths.mjs';

function getLegacyTempDir() {
  return path.join(getAppRoot(), 'public', 'temp');
}

function extractTempRelativePath(inputPath) {
  const normalized = String(inputPath || '').trim().replaceAll('\\', '/');
  if (!normalized) {
    return null;
  }

  const marker = '/public/temp/';
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return normalized.slice(markerIndex + marker.length);
  }

  if (normalized.startsWith('public/temp/')) {
    return normalized.slice('public/temp/'.length);
  }

  return null;
}

function pushCandidate(candidates, candidatePath) {
  if (!candidatePath) {
    return;
  }

  const normalized = path.normalize(candidatePath);
  if (!candidates.includes(normalized)) {
    candidates.push(normalized);
  }
}

export function resolvePortfolioTempPath(tempPath) {
  const normalizedInput = String(tempPath || '').trim();
  if (!normalizedInput) {
    throw new Error('Missing temp_path in database record');
  }

  const candidates = [];
  const tempRelativePath = extractTempRelativePath(normalizedInput);

  if (path.isAbsolute(normalizedInput)) {
    pushCandidate(candidates, normalizedInput);
  } else {
    pushCandidate(candidates, path.resolve(getAppRoot(), normalizedInput));
  }

  if (tempRelativePath) {
    pushCandidate(candidates, path.join(getTempDir(), tempRelativePath));
    pushCandidate(candidates, path.join(getLegacyTempDir(), tempRelativePath));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}
