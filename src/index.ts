import './env.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import auditRoutes from './routes/audit.routes.js';
import pendingChangesRoutes from './routes/pending-changes.routes.js';
import usersRoutes from './routes/users.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import subcategoriesRoutes from './routes/subcategories.routes.js';
import productsRoutes from './routes/products.routes.js';
import specificationsRoutes from './routes/specifications.routes.js';
import postsRoutes from './routes/posts.js';
import uploadRoutes from './routes/upload.js';
import settingsRoutes from './routes/settings.routes.js';
import contactRoutes from './routes/contact.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import youtubeRoutes from './routes/youtube.routes.js';
import { authenticateToken, requireAdmin, requireEditor } from './middleware/auth.middleware.js';
import logger, { requestLogger, errorLogger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cookieParser());

// Logging middleware
app.use(requestLogger);
// app.use('/uploads', express.static('uploads')); // Serve uploaded images (Disabled: migrated to S3)

// CORS configuration (adjust for your frontend URL)
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'https://gogreen-frontend.vercel.app'
  ].filter(Boolean).map(origin => origin?.replace(/\/$/, '')); // Remove trailing slashes
  
  const origin = req.headers.origin?.replace(/\/$/, ''); // Remove trailing slash from request origin
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!req.headers.origin) {
    // Allow requests with no origin (e.g., mobile apps, Postman)
    res.header('Access-Control-Allow-Origin', allowedOrigins[0] || 'http://localhost:3000');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/pending-changes', pendingChangesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/subcategories', subcategoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/specifications', specificationsRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/youtube-videos', youtubeRoutes);

// Protected routes examples
app.get('/api/admin/dashboard', authenticateToken, requireAdmin, (req, res) => {
  res.json({ message: 'Admin dashboard data', role: 'admin' });
});

app.get('/api/editor/content', authenticateToken, requireEditor, (req, res) => {
  res.json({ message: 'Editor content data', role: 'editor' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error logging middleware (must be after routes)
app.use(errorLogger);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// Start server
app.listen(PORT, () => {
  logger.info('🚀 Server starting...');
  logger.info(`🌐 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  logger.info('👤 Default credentials:');
  logger.info('   Admin - email: admin@gogreen.com, password: admin123');
  logger.info('   Editor - email: editor@gogreen.com, password: editor123');
  logger.info('✅ Server ready to accept connections');
});
