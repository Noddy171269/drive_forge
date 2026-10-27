import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { storageDir } from '../utils/storage.js';

/**
 * Multer streams uploads to a temp directory inside storage/. The controller
 * then validates quota and moves the bytes to their final objectKey, or deletes
 * the temp file on failure. Keeping temp files under storage/ guarantees the
 * final move is a cheap same-device rename.
 */
const TMP_DIR = path.join(storageDir, 'tmp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => cb(null, `tmp-${crypto.randomUUID()}`),
});

const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 104857600; // 100 MB

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});
