import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

/**
 * ALL disk I/O for file bytes is isolated in this module. To move to S3 later,
 * only this file changes - controllers never touch the filesystem directly.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/utils -> server/storage
const STORAGE_DIR = path.resolve(__dirname, '..', '..', 'storage');

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}
ensureStorageDir();

/** Generate a fresh, collision-free object key (the on-disk filename). */
export function newObjectKey() {
  return crypto.randomUUID();
}

/**
 * Resolve an object key to an absolute path INSIDE the storage dir. Guards
 * against path traversal: the key must be a bare UUID-like token.
 */
function resolveKey(objectKey) {
  if (!objectKey || /[\\/]|\.\./.test(objectKey)) {
    throw new Error('Invalid object key');
  }
  const abs = path.join(STORAGE_DIR, objectKey);
  if (path.dirname(abs) !== STORAGE_DIR) {
    throw new Error('Resolved path escapes storage directory');
  }
  return abs;
}

/** Move an uploaded temp file into permanent storage under objectKey. */
export async function moveIntoStorage(tempPath, objectKey) {
  const dest = resolveKey(objectKey);
  try {
    await fsp.rename(tempPath, dest);
  } catch (err) {
    // rename fails across devices/partitions - fall back to copy + unlink
    if (err.code === 'EXDEV') {
      await fsp.copyFile(tempPath, dest);
      await fsp.unlink(tempPath);
    } else {
      throw err;
    }
  }
  return dest;
}

/** Absolute path for an object key (for streaming). */
export function pathForKey(objectKey) {
  return resolveKey(objectKey);
}

/** Does the byte blob exist on disk? */
export async function exists(objectKey) {
  try {
    await fsp.access(resolveKey(objectKey));
    return true;
  } catch {
    return false;
  }
}

/** Stat an object (size, etc.). Returns null if missing. */
export async function stat(objectKey) {
  try {
    return await fsp.stat(resolveKey(objectKey));
  } catch {
    return null;
  }
}

/** Create a read stream, optionally for a byte range (for HTTP Range support). */
export function createReadStream(objectKey, { start, end } = {}) {
  const opts = {};
  if (typeof start === 'number') opts.start = start;
  if (typeof end === 'number') opts.end = end;
  return fs.createReadStream(resolveKey(objectKey), opts);
}

/** Delete a byte blob. Swallows ENOENT so cleanup is idempotent. */
export async function remove(objectKey) {
  try {
    await fsp.unlink(resolveKey(objectKey));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

/** Write a Buffer directly to storage under a new key (used by the seeder). */
export async function writeBuffer(objectKey, buffer) {
  const dest = resolveKey(objectKey);
  await fsp.writeFile(dest, buffer);
  return dest;
}

export const storageDir = STORAGE_DIR;
