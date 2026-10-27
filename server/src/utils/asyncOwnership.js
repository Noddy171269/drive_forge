import File from '../models/File.js';
import Folder from '../models/Folder.js';
import { HttpError } from '../middleware/error.js';

/**
 * Load a resource by id and assert the requesting user owns it.
 * Throws 404 if the resource does not exist, 403 if it belongs to someone else.
 * This is the single chokepoint for per-resource authorization - ownerId is
 * NEVER taken from the client.
 *
 * @param {'file'|'folder'} type
 * @param {string} id
 * @param {import('mongoose').Types.ObjectId|string} userId
 */
export async function loadOwned(type, id, userId) {
  const Model = type === 'file' ? File : Folder;
  const doc = await Model.findById(id);
  if (!doc) {
    throw new HttpError(404, `${type[0].toUpperCase()}${type.slice(1)} not found`);
  }
  if (String(doc.ownerId) !== String(userId)) {
    // 403 so the caller knows it exists but is forbidden; some apps prefer 404
    // to avoid leaking existence - here the spec asks for 403.
    throw new HttpError(403, 'You do not have access to this resource');
  }
  return doc;
}

export const loadOwnedFile = (id, userId) => loadOwned('file', id, userId);
export const loadOwnedFolder = (id, userId) => loadOwned('folder', id, userId);
