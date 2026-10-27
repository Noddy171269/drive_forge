import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null, // null = root
    },
    name: {
      type: String,
      required: [true, 'Folder name is required'],
      trim: true,
    },
    trashed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

folderSchema.index({ ownerId: 1, parentId: 1, trashed: 1 });

export default mongoose.model('Folder', folderSchema);
