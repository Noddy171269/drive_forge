import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Folder from '../models/Folder.js';
import File from '../models/File.js';
import Share from '../models/Share.js';
import * as storage from './storage.js';

/**
 * Seed script: wipes all collections, creates demo users with nested folders
 * and a few small sample files written to disk with matching metadata and a
 * correct storageUsed total. Prints the demo credentials at the end.
 *
 * Run with:  npm run seed
 */

const PASSWORD = 'password123';

async function makeFile({ ownerId, parentId, name, mimeType, content }) {
  const buffer = Buffer.from(content);
  const objectKey = storage.newObjectKey();
  await storage.writeBuffer(objectKey, buffer);
  const file = await File.create({
    ownerId,
    parentId: parentId || null,
    name,
    objectKey,
    size: buffer.length,
    mimeType,
  });
  return file;
}

async function run() {
  await connectDB(process.env.MONGO_URI);

  console.log('[seed] wiping collections...');
  await Promise.all([
    User.deleteMany({}),
    Folder.deleteMany({}),
    File.deleteMany({}),
    Share.deleteMany({}),
  ]);

  // --- Users ---
  const alice = new User({ email: 'alice@example.com', password: PASSWORD });
  await alice.save();
  const bob = new User({ email: 'bob@example.com', password: PASSWORD });
  await bob.save();
  const carol = new User({ email: 'carol@example.com', password: PASSWORD });
  await carol.save();

  // --- Alice's folders (nested) ---
  const documents = await Folder.create({ ownerId: alice._id, parentId: null, name: 'Documents' });
  const photos = await Folder.create({ ownerId: alice._id, parentId: null, name: 'Photos' });
  const invoices = await Folder.create({
    ownerId: alice._id,
    parentId: documents._id,
    name: 'Invoices',
  });

  // --- Alice's files ---
  const seededFiles = [];
  seededFiles.push(
    await makeFile({
      ownerId: alice._id,
      parentId: null,
      name: 'welcome.txt',
      mimeType: 'text/plain',
      content:
        'Welcome to your Drive!\n\nThis is a seeded sample file. Upload, share, and organize your files.\n',
    })
  );
  seededFiles.push(
    await makeFile({
      ownerId: alice._id,
      parentId: documents._id,
      name: 'notes.md',
      mimeType: 'text/markdown',
      content: '# Notes\n\n- Backend-heavy MERN project\n- JWT auth, quotas, sharing, streaming\n',
    })
  );
  seededFiles.push(
    await makeFile({
      ownerId: alice._id,
      parentId: invoices._id,
      name: 'invoice-001.txt',
      mimeType: 'text/plain',
      content: 'Invoice #001\nAmount: $42.00\nStatus: PAID\n',
    })
  );
  seededFiles.push(
    await makeFile({
      ownerId: alice._id,
      parentId: photos._id,
      name: 'readme-photos.txt',
      mimeType: 'text/plain',
      content: 'Drop your photos here. Image previews are supported in the UI.\n',
    })
  );

  // --- Bob gets one file so shared-with-me demos have two accounts ---
  await makeFile({
    ownerId: bob._id,
    parentId: null,
    name: 'bob-plan.txt',
    mimeType: 'text/plain',
    content: "Bob's private plan.\n",
  });

  // Fix up storageUsed for each user via an aggregate of their files.
  for (const user of [alice, bob, carol]) {
    const files = await File.find({ ownerId: user._id });
    const used = files.reduce((sum, f) => sum + f.size, 0);
    await User.findByIdAndUpdate(user._id, { storageUsed: used });
  }

  // --- A user-to-user share: Alice shares Documents with Bob ---
  await Share.create({
    resourceId: documents._id,
    resourceType: 'folder',
    ownerId: alice._id,
    recipientId: bob._id,
    role: 'viewer',
  });

  // --- A public link to welcome.txt (never expires) ---
  const { default: crypto } = await import('crypto');
  await Share.create({
    resourceId: seededFiles[0]._id,
    resourceType: 'file',
    ownerId: alice._id,
    token: crypto.randomBytes(24).toString('base64url'),
    role: 'viewer',
  });

  console.log('\n[seed] done. Demo accounts (password for all: ' + PASSWORD + '):');
  console.log('  - alice@example.com   (has folders, files, and a share to Bob)');
  console.log('  - bob@example.com     (Documents shared with him by Alice)');
  console.log('  - carol@example.com   (empty account)');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
