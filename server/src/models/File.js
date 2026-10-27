import mongoose from 'mongoose';

const versionSchema = new mongoose.Schema(
  {
    objectKey: { type: String, required: true },
    size: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const fileSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    objectKey: {
      type: String,
      required: true, // server UUID; the on-disk filename
    },
    size: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    trashed: {
      type: Boolean,
      default: false,
    },
    versions: {
      type: [versionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

fileSchema.index({ ownerId: 1, parentId: 1, trashed: 1 });
fileSchema.index({ name: 'text' });

export default mongoose.model('File', fileSchema);
