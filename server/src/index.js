import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/db.js';
import { notFound, errorHandler } from './middleware/error.js';

import authRoutes from './routes/authRoutes.js';
import folderRoutes from './routes/folderRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import shareRoutes from './routes/shareRoutes.js';
import storageRoutes from './routes/storageRoutes.js';
import { trashRouter } from './routes/fileRoutes.js';

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    // expose range-related headers so the browser video element can seek
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Disposition'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limit the auth endpoints to blunt brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/trash', trashRouter);
app.use('/api/shares', shareRoutes);
app.use('/api/storage', storageRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB(process.env.MONGO_URI);
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] failed to start:', err.message);
  process.exit(1);
});

export default app;
