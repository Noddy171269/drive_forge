import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => EMAIL_RE.test(v),
        message: 'Invalid email address',
      },
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    storageQuota: {
      type: Number,
      default: 1073741824, // 1 GB
    },
    storageUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

/**
 * Virtual setter so controllers can assign `user.password = plain` and the
 * pre-save hook will hash it into passwordHash. The plain value is never stored.
 */
userSchema
  .virtual('password')
  .set(function setPassword(plain) {
    this._plainPassword = plain;
  });

// Hash on 'validate' (which runs before 'save') so the required passwordHash is
// populated before validation checks it.
userSchema.pre('validate', async function hashPassword(next) {
  if (!this._plainPassword) return next();
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this._plainPassword, salt);
  this._plainPassword = undefined;
  next();
});

userSchema.methods.matchPassword = function matchPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/** Shape returned to clients - never expose the hash. */
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    email: this.email,
    storageQuota: this.storageQuota,
    storageUsed: this.storageUsed,
  };
};

export default mongoose.model('User', userSchema);
