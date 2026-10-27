import Folder from '../models/Folder.js';
import File from '../models/File.js';
import { HttpError } from '../middleware/error.js';
import { loadOwnedFolder } from '../utils/asyncOwnership.js';

/**
 * Build the breadcrumb trail (root -> ... -> folder) for a folder id.
 * Returns an array of { id, name }, outermost first. Root is [].
 */
async function buildBreadcrumb(folderId, ownerId) {
  const trail = [];
  let current = folderId;
  // Guard against pathological depth / cycles.
  for (let i = 0; i < 100 && current; i += 1) {
    const f = await Folder.findOne({ _id: current, ownerId });
    if (!f) break;
    trail.unshift({ id: f._id, name: f.name });
    current = f.parentId;
  }
  return trail;
}

/** Is `candidateAncestor` an ancestor of (or equal to) `folderId`? */
async function isAncestorOf(candidateAncestor, folderId, ownerId) {
  let current = folderId;
  for (let i = 0; i < 100 && current; i += 1) {
    if (String(current) === String(candidateAncestor)) return true;
    const f = await Folder.findOne({ _id: current, ownerId }).select('parentId');
    if (!f) break;
    current = f.parentId;
  }
  return false;
}

/**
 * POST /api/folders  { name, parentId? } -> 201 folder
 * Validates the parent exists & is owned; rejects duplicate names in a parent.
 */
export async function createFolder(req, res) {
  const { name } = req.body || {};
  let { parentId } = req.body || {};
  if (!name || !String(name).trim()) {
    throw new HttpError(400, 'Folder name is required');
  }
  if (parentId === 'root' || parentId === '' || parentId === undefined) {
    parentId = null;
  }

  if (parentId) {
    // parent must exist and belong to the caller
    await loadOwnedFolder(parentId, req.user._id);
  }

  const dup = await Folder.findOne({
    ownerId: req.user._id,
    parentId: parentId || null,
    name: String(name).trim(),
    trashed: false,
  });
  if (dup) {
    throw new HttpError(409, 'A folder with that name already exists here');
  }

  const folder = await Folder.create({
    ownerId: req.user._id,
    parentId: parentId || null,
    name: String(name).trim(),
  });

  res.status(201).json({ folder });
}

/**
 * PATCH /api/folders/:id  { name?, parentId? } -> rename and/or move.
 * Moving a folder into one of its own descendants is rejected (cycle guard).
 */
export async function updateFolder(req, res) {
  const folder = await loadOwnedFolder(req.params.id, req.user._id);
  const { name } = req.body || {};
  let { parentId } = req.body || {};

  if (parentId !== undefined) {
    if (parentId === 'root' || parentId === '' || parentId === null) {
      parentId = null;
    } else {
      if (String(parentId) === String(folder._id)) {
        throw new HttpError(400, 'A folder cannot be its own parent');
      }
      await loadOwnedFolder(parentId, req.user._id);
      // reject moving into a descendant (would create a cycle)
      const wouldCycle = await isAncestorOf(folder._id, parentId, req.user._id);
      if (wouldCycle) {
        throw new HttpError(400, 'Cannot move a folder into its own descendant');
      }
    }
    folder.parentId = parentId;
  }

  if (name !== undefined) {
    if (!String(name).trim()) throw new HttpError(400, 'Folder name is required');
    folder.name = String(name).trim();
  }

  // enforce unique name within the (possibly new) parent
  const dup = await Folder.findOne({
    _id: { $ne: folder._id },
    ownerId: req.user._id,
    parentId: folder.parentId || null,
    name: folder.name,
    trashed: false,
  });
  if (dup) {
    throw new HttpError(409, 'A folder with that name already exists here');
  }

  await folder.save();
  res.json({ folder });
}

/**
 * DELETE /api/folders/:id -> soft delete this folder AND cascade trashed=true
 * to every descendant folder and file.
 */
export async function trashFolder(req, res) {
  const folder = await loadOwnedFolder(req.params.id, req.user._id);

  // Breadth-first collect all descendant folder ids.
  const toTrash = [folder._id];
  const queue = [folder._id];
  while (queue.length) {
    const current = queue.shift();
    const children = await Folder.find({
      ownerId: req.user._id,
      parentId: current,
    }).select('_id');
    for (const c of children) {
      toTrash.push(c._id);
      queue.push(c._id);
    }
  }

  await Folder.updateMany({ _id: { $in: toTrash }, ownerId: req.user._id }, { trashed: true });
  await File.updateMany(
    { ownerId: req.user._id, parentId: { $in: toTrash } },
    { trashed: true }
  );

  res.json({ message: 'Folder moved to trash', count: toTrash.length });
}

export { buildBreadcrumb };
