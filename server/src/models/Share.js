import mongoose from 'mongoose';

const shareSchema = new mongoose.Schema(
  {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    resourceType: {
      type: String,
      enum: ['file', 'folder'],
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // set for user-to-user shares
    },
    token: {
      type: String,
      default: null, // set for public links
      index: true,
    },
    role: {
      type: String,
      enum: ['viewer', 'editor'],
      default: 'viewer',
    },
    expiresAt: {
      type: Date,
      default: null, // null = never
    },
    revoked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

shareSchema.index({ recipientId: 1, revoked: 1 });
shareSchema.index({ resourceId: 1, resourceType: 1 });

/** True when the share is still usable right now. */
shareSchema.methods.isActive = function isActive() {
  if (this.revoked) return false;
  if (this.expiresAt && this.expiresAt.getTime() < Date.now()) return false;
  return true;
};

export default mongoose.model('Share', shareSchema);
