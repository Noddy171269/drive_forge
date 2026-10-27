import fsp from 'fs/promises';
import File from '../models/File.js';
import Folder from '../models/Folder.js';
import User from '../models/User.js';
import Share from '../models/Share.js';
import { HttpError } from '../middleware/error.js';
import { loadOwnedFile, loadOwnedFolder } from '../utils/asyncOwnership.js';
import { buildBreadcrumb } from './folderController.js';
import * as storage from '../utils/storage.js';

/**
 * GET /api/files?parentId=<id|root>&search=&page=&limit=
 * Returns the caller's non-trashed folders+files in that folder, with a
 * breadcrumb and pagination. `search` filters by name (case-insensitive).
 */
export async function listFolder(req, res) {
  const { search = '' } = req.query;
  let { parentId } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

  if (!parentId || parentId === 'root') {
    parentId = null;
  } else {
    // validate the folder exists & is owned before listing inside it
    await loadOwnedFolder(parentId, req.user._id);
  }

  const baseQuery = {
    ownerId: req.user._id,
    parentId: parentId || null,
    trashed: false,
  };

  const nameFilter = search
    ? { name: { $regex: String(search).trim(), $options: 'i' } }
    : {};

  const folderQuery = { ...baseQuery, ...nameFilter };
  const fileQuery = { ...baseQuery, ...nameFilter };

  // Folders always listed first, then paginate the combined view by files.
  const folders = await Folder.find(folderQuery).sort({ name: 1 });

  const total = await File.countDocuments(fileQuery);
  const pages = Math.max(1, Math.ceil(total / limit));
  const files = await File.find(fileQuery)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const breadcrumb = parentId ? await buildBreadcrumb(parentId, req.user._id) : [];

  res.json({ folders, files, breadcrumb, page, pages, total });
}

/**
 * POST /api/files/upload  (multipart: file, parentId?)
 * Quota-checked, atomic $inc accounting, versioning on name collision, and
 * orphaned-byte cleanup on any failure.
 */
export async function uploadFile(req, res) {
  if (!req.file) {
    throw new HttpError(400, 'No file uploaded (field name must be "file")');
  }

  const temp = req.file.path;
  let movedKey = null;

  // Helper to wipe the temp file on any early exit.
  const cleanupTemp = async () => {
    try {
      await fsp.unlink(temp);
    } catch {
      /* already gone */
    }
  };

  try {
    let { parentId } = req.body || {};
    if (!parentId || parentId === 'root') {
      parentId = null;
    } else {
      await loadOwnedFolder(parentId, req.user._id);
    }

    const size = req.file.size;
    const name = req.file.originalname;
    const mimeType = req.file.mimetype || 'application/octet-stream';

    // Quota check against the live user document.
    const fresh = await User.findById(req.user._id).select('storageUsed storageQuota');
    if (fresh.storageUsed + size > fresh.storageQuota) {
      await cleanupTemp();
      throw new HttpError(413, 'Storage quota exceeded');
    }

    // Is there an existing non-trashed file with the same name+parent? -> version it.
    const existing = await File.findOne({
      ownerId: req.user._id,
      parentId: parentId || null,
      name,
      trashed: false,
    });

    const objectKey = storage.newObjectKey();
    await storage.moveIntoStorage(temp, objectKey);
    movedKey = objectKey;

    let fileDoc;
    let quotaDelta = size;

    if (existing) {
      // push the old bytes into versions[] and replace with the new upload
      existing.versions.push({
        objectKey: existing.objectKey,
        size: existing.size,
        createdAt: existing.updatedAt || existing.createdAt,
      });
      quotaDelta = size; // old version bytes are retained, so we still add `size`
      existing.objectKey = objectKey;
      existing.size = size;
      existing.mimeType = mimeType;
      await existing.save();
      fileDoc = existing;
    } else {
      fileDoc = await File.create({
        ownerId: req.user._id,
        parentId: parentId || null,
        name,
        objectKey,
        size,
        mimeType,
      });
    }

    // Atomic quota increment - never read-modify-write.
    await User.findByIdAndUpdate(req.user._id, { $inc: { storageUsed: quotaDelta } });

    res.status(201).json({ file: fileDoc });
  } catch (err) {
    // On any failure after bytes were written, delete the orphaned bytes.
    await cleanupTemp();
    if (movedKey) {
      await storage.remove(movedKey).catch(() => {});
    }
    throw err;
  }
}

/**
 * Resolve whether a request may read a file. Access is granted if:
 *  - a logged-in user owns it, or
 *  - a logged-in user has an active user-to-user share (of the file or an
 *    ancestor folder), or
 *  - a valid public share token (?share=) covers the file (the file itself or
 *    an ancestor folder).
 */
async function canRead(file, user, shareToken) {
  // Owner / user-to-user shares (require a logged-in user).
  if (user) {
    if (String(file.ownerId) === String(user._id)) return true;

    const direct = await Share.findOne({
      resourceId: file._id,
      resourceType: 'file',
      recipientId: user._id,
      revoked: false,
    });
    if (direct && direct.isActive()) return true;

    const folderShares = await Share.find({
      resourceType: 'folder',
      recipientId: user._id,
      revoked: false,
    });
    for (const s of folderShares) {
      if (!s.isActive()) continue;
      if (await isDescendantOfFolder(file.parentId, s.resourceId, file.ownerId)) return true;
    }
  }

  // Public share token (works without any logged-in user).
  if (shareToken) {
    const s = await Share.findOne({ token: shareToken });
    if (s && s.isActive()) {
      if (s.resourceType === 'file' && String(s.resourceId) === String(file._id)) {
        return true;
      }
      if (
        s.resourceType === 'folder' &&
        (await isDescendantOfFolder(file.parentId, s.resourceId, file.ownerId))
      ) {
        return true;
      }
    }
  }

  return false;
}

/** Is folderId within (or equal to) ancestorId, walking up the owner's tree? */
async function isDescendantOfFolder(folderId, ancestorId, ownerId) {
  let current = folderId;
  for (let i = 0; i < 100 && current; i += 1) {
    if (String(current) === String(ancestorId)) return true;
    const f = await Folder.findOne({ _id: current, ownerId }).select('parentId');
    if (!f) break;
    current = f.parentId;
  }
  return false;
}

/**
 * GET /api/files/:id/download
 * Access = owner OR active share. Streams from disk with full HTTP Range
 * support so browsers can seek <video>.
 */
export async function downloadFile(req, res) {
  const file = await File.findById(req.params.id);
  if (!file) throw new HttpError(404, 'File not found');

  const allowed = await canRead(file, req.user, req.query.share);
  if (!allowed) {
    throw new HttpError(req.user ? 403 : 401, 'You do not have access to this file');
  }

  const stat = await storage.stat(file.objectKey);
  if (!stat) throw new HttpError(404, 'File bytes are missing on the server');

  const total = stat.size;
  const range = req.headers.range;

  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(file.name)}"`
  );

  if (range) {
    // e.g. "bytes=0-" or "bytes=500-999"
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.setHeader('Content-Range', `bytes */${total}`);
      throw new HttpError(416, 'Invalid Range header');
    }
    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : total - 1;

    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end)) end = total - 1;
    if (start > end || start >= total) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`);
      return res.end();
    }
    end = Math.min(end, total - 1);

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', chunkSize);

    const stream = storage.createReadStream(file.objectKey, { start, end });
    stream.on('error', () => res.destroy());
    return stream.pipe(res);
  }

  // No range -> full 200 response.
  res.status(200);
  res.setHeader('Content-Length', total);
  const stream = storage.createReadStream(file.objectKey);
  stream.on('error', () => res.destroy());
  return stream.pipe(res);
}

/** PATCH /api/files/:id  { name?, parentId? } -> rename/move, ownership checked. */
export async function updateFile(req, res) {
  const file = await loadOwnedFile(req.params.id, req.user._id);
  const { name } = req.body || {};
  let { parentId } = req.body || {};

  if (parentId !== undefined) {
    if (parentId === 'root' || parentId === '' || parentId === null) {
      parentId = null;
    } else {
      await loadOwnedFolder(parentId, req.user._id);
    }
    file.parentId = parentId;
  }
  if (name !== undefined) {
    if (!String(name).trim()) throw new HttpError(400, 'File name is required');
    file.name = String(name).trim();
  }

  await file.save();
  res.json({ file });
}

/** DELETE /api/files/:id -> soft delete. Does NOT free quota yet. */
export async function trashFile(req, res) {
  const file = await loadOwnedFile(req.params.id, req.user._id);
  file.trashed = true;
  await file.save();
  res.json({ message: 'File moved to trash' });
}

/** POST /api/files/:id/restore -> trashed=false. */
export async function restoreFile(req, res) {
  const file = await loadOwnedFile(req.params.id, req.user._id);
  file.trashed = false;
  await file.save();
  res.json({ file });
}

/** GET /api/trash -> the caller's trashed files and folders. */
export async function listTrash(req, res) {
  const [files, folders] = await Promise.all([
    File.find({ ownerId: req.user._id, trashed: true }).sort({ updatedAt: -1 }),
    Folder.find({ ownerId: req.user._id, trashed: true }).sort({ updatedAt: -1 }),
  ]);
  res.json({ files, folders });
}

/**
 * POST /api/folders/:id/restore -> trashed=false for a folder (and only that
 * folder node; descendants are restored too for a clean UX).
 */
export async function restoreFolder(req, res) {
  const folder = await loadOwnedFolder(req.params.id, req.user._id);

  // collect descendant folder ids
  const ids = [folder._id];
  const queue = [folder._id];
  while (queue.length) {
    const current = queue.shift();
    const children = await Folder.find({ ownerId: req.user._id, parentId: current }).select(
      '_id'
    );
    for (const c of children) {
      ids.push(c._id);
      queue.push(c._id);
    }
  }
  await Folder.updateMany({ _id: { $in: ids }, ownerId: req.user._id }, { trashed: false });
  await File.updateMany(
    { ownerId: req.user._id, parentId: { $in: ids } },
    { trashed: false }
  );
  res.json({ message: 'Folder restored', count: ids.length });
}

/**
 * DELETE /api/trash/:id?type=file|folder -> PERMANENT delete.
 * Removes disk bytes (including all versions), deletes metadata, and frees
 * quota with an atomic $inc. Folders cascade to all contents.
 */
export async function permanentDelete(req, res) {
  const type = req.query.type === 'folder' ? 'folder' : 'file';

  if (type === 'file') {
    const file = await loadOwnedFile(req.params.id, req.user._id);
    const freed = await deleteFileCompletely(file);
    await User.findByIdAndUpdate(req.user._id, { $inc: { storageUsed: -freed } });
    return res.json({ message: 'File permanently deleted', freed });
  }

  // folder: cascade-collect every descendant folder id, delete all their files
  const folder = await loadOwnedFolder(req.params.id, req.user._id);
  const folderIds = [folder._id];
  const queue = [folder._id];
  while (queue.length) {
    const current = queue.shift();
    const children = await Folder.find({ ownerId: req.user._id, parentId: current }).select(
      '_id'
    );
    for (const c of children) {
      folderIds.push(c._id);
      queue.push(c._id);
    }
  }

  const files = await File.find({ ownerId: req.user._id, parentId: { $in: folderIds } });
  let totalFreed = 0;
  for (const f of files) {
    totalFreed += await deleteFileCompletely(f);
  }

  await Folder.deleteMany({ _id: { $in: folderIds }, ownerId: req.user._id });

  // clean up any shares pointing at these resources
  await Share.deleteMany({
    $or: [
      { resourceId: { $in: folderIds }, resourceType: 'folder' },
      { resourceId: { $in: files.map((f) => f._id) }, resourceType: 'file' },
    ],
  });

  if (totalFreed > 0) {
    await User.findByIdAndUpdate(req.user._id, { $inc: { storageUsed: -totalFreed } });
  }

  res.json({ message: 'Folder permanently deleted', freed: totalFreed });
}

/** Remove a file's current bytes + every version's bytes, delete its shares &
 *  metadata, and return the total bytes freed. */
async function deleteFileCompletely(file) {
  let freed = file.size || 0;
  await storage.remove(file.objectKey).catch(() => {});
  for (const v of file.versions || []) {
    freed += v.size || 0;
    await storage.remove(v.objectKey).catch(() => {});
  }
  await Share.deleteMany({ resourceId: file._id, resourceType: 'file' });
  await file.deleteOne();
  return freed;
}
