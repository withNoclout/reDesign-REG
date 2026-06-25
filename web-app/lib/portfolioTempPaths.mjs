import fs from 'node:fs';
import path from 'node:path';

import { getAppRoot, getTempDir } from './runtimePaths.mjs';

function getLegacyTempDir() {
  return path.join(getAppRoot(), 'public', 'temp');
}

function normalizePathForMatch(inputPath) {
  return String(inputPath || '').trim().replaceAll('\\', '/');
}

function extractTempRelativePath(inputPath) {
  const normalized = normalizePathForMatch(inputPath);
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

  return normalized.startsWith('/') ? null : normalized;
}

function isPathInside(rootPath, candidatePath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveInside(rootPath, relativePath) {
  if (!relativePath) {
    return null;
  }

  const candidate = path.resolve(rootPath, relativePath);
  return isPathInside(rootPath, candidate) ? candidate : null;
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
  const tempDir = getTempDir();
  const legacyTempDir = getLegacyTempDir();
  const tempRelativePath = extractTempRelativePath(normalizedInput);

  if (path.isAbsolute(normalizedInput)) {
    const absoluteCandidate = path.normalize(normalizedInput);
    if (isPathInside(tempDir, absoluteCandidate) || isPathInside(legacyTempDir, absoluteCandidate)) {
      pushCandidate(candidates, absoluteCandidate);
    }
  }

  if (tempRelativePath) {
    pushCandidate(candidates, resolveInside(tempDir, tempRelativePath));
    pushCandidate(candidates, resolveInside(legacyTempDir, tempRelativePath));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  if (candidates.length) {
    return candidates[0];
  }

  throw new Error('Temp file path is outside allowed temp directories');
}
