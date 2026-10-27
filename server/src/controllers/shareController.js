import crypto from 'crypto';
import Share from '../models/Share.js';
import File from '../models/File.js';
import Folder from '../models/Folder.js';
import User from '../models/User.js';
import { HttpError } from '../middleware/error.js';
import { loadOwned } from '../utils/asyncOwnership.js';

/**
 * POST /api/shares
 * { resourceId, resourceType, recipientEmail?, role?, expiresInHours? }
 * - recipientEmail -> user-to-user share (404 if no such user)
 * - otherwise -> public link with a crypto-random token
 * Only the owner may share.
 */
export async function createShare(req, res) {
  const { resourceId, resourceType, recipientEmail, role, expiresInHours } = req.body || {};

  if (!resourceId || !['file', 'folder'].includes(resourceType)) {
    throw new HttpError(400, 'resourceId and a valid resourceType are required');
  }

  // Ownership check - only the owner can share.
  await loadOwned(resourceType, resourceId, req.user._id);

  const shareRole = role === 'editor' ? 'editor' : 'viewer';
  let expiresAt = null;
  if (expiresInHours !== undefined && expiresInHours !== null && expiresInHours !== '') {
    const hours = Number(expiresInHours);
    if (Number.isNaN(hours) || hours <= 0) {
      throw new HttpError(400, 'expiresInHours must be a positive number');
    }
    expiresAt = new Date(Date.now() + hours * 3600 * 1000);
  }

  // user-to-user share
  if (recipientEmail) {
    const recipient = await User.findOne({
      email: String(recipientEmail).toLowerCase().trim(),
    });
    if (!recipient) {
      throw new HttpError(404, 'No user with that email');
    }
    if (String(recipient._id) === String(req.user._id)) {
      throw new HttpError(400, 'You cannot share a resource with yourself');
    }

    const share = await Share.create({
      resourceId,
      resourceType,
      ownerId: req.user._id,
      recipientId: recipient._id,
      role: shareRole,
      expiresAt,
    });
    return res.status(201).json({ share });
  }

  // public link
  const token = crypto.randomBytes(24).toString('base64url');
  const share = await Share.create({
    resourceId,
    resourceType,
    ownerId: req.user._id,
    token,
    role: shareRole,
    expiresAt,
  });

  const base = process.env.CLIENT_URL || '';
  const url = `${base.replace(/\/$/, '')}/s/${token}`;
  res.status(201).json({ share, url });
}

/**
 * GET /api/shares/:token -> resolve a public link.
 * 404 if not found, 410 if revoked/expired, else 200 with resource metadata.
 */
export async function resolvePublic(req, res) {
  const share = await Share.findOne({ token: req.params.token });
  if (!share) throw new HttpError(404, 'Link not found');
  if (!share.isActive()) throw new HttpError(410, 'This link has expired or been revoked');

  const Model = share.resourceType === 'file' ? File : Folder;
  const resource = await Model.findById(share.resourceId);
  if (!resource) throw new HttpError(404, 'The shared resource no longer exists');

  res.json({
    resourceType: share.resourceType,
    role: share.role,
    [share.resourceType]: resource,
  });
}

/**
 * GET /api/shares/shared-with-me -> files/folders shared with the caller.
 */
export async function sharedWithMe(req, res) {
  const shares = await Share.find({
    recipientId: req.user._id,
    revoked: false,
  }).sort({ createdAt: -1 });

  const active = shares.filter((s) => s.isActive());

  const items = [];
  for (const s of active) {
    const Model = s.resourceType === 'file' ? File : Folder;
    const resource = await Model.findById(s.resourceId);
    if (!resource) continue;
    const owner = await User.findById(s.ownerId).select('email');
    items.push({
      shareId: s._id,
      resourceType: s.resourceType,
      role: s.role,
      sharedBy: owner ? owner.email : 'unknown',
      resource,
    });
  }

  res.json({ items });
}

/** POST /api/shares/:id/revoke -> revoked=true (owner only). */
export async function revokeShare(req, res) {
  const share = await Share.findById(req.params.id);
  if (!share) throw new HttpError(404, 'Share not found');
  if (String(share.ownerId) !== String(req.user._id)) {
    throw new HttpError(403, 'Only the owner can revoke this share');
  }
  share.revoked = true;
  await share.save();
  res.json({ message: 'Share revoked' });
}

/** GET /api/shares/mine -> shares the caller has created (for management UI). */
export async function myShares(req, res) {
  const shares = await Share.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
  res.json({ shares });
}
