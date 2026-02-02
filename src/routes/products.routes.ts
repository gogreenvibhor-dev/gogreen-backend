import { Router, type Request, type Response, type IRouter } from 'express';
import { authenticateToken, requireAdmin, type AuthRequest } from '../middleware/auth.middleware.js';
import { ProductModel } from '../models/product.model.js';
import { AuditLogModel } from '../models/audit-log.model.js';
import { z } from 'zod';
import { ActionType } from '../types/auth.js';
import logger, { logBusinessOperation } from '../utils/logger.js';

const router: IRouter = Router();

// Helper to remove undefined keys for exactOptionalPropertyTypes compliance
function cleanData(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

// Get all products (public)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const subcategoryId = req.query.subcategoryId as string | undefined;
    const featured = req.query.featured === 'true';
    const searchQuery = req.query.search as string | undefined;
    
    let products;
    if (searchQuery) {
      logBusinessOperation('Searching products', { query: searchQuery, includeInactive });
      products = await ProductModel.search(searchQuery, includeInactive);
    } else if (featured) {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      logBusinessOperation('Fetching featured products', { limit });
      products = await ProductModel.getFeatured(limit);
    } else if (subcategoryId) {
      logBusinessOperation('Fetching products by subcategory', { subcategoryId, includeInactive });
      products = await ProductModel.getBySubcategoryId(subcategoryId, includeInactive);
    } else {
      logBusinessOperation('Fetching all products', { includeInactive });
      products = await ProductModel.getAll(includeInactive);
    }
    
    logger.info(`✅ Retrieved ${products.length} products`);
    
    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    logger.error({ error }, '❌ Get products error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product by ID (public)
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      logger.warn('⚠️  Product ID missing in request');
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }
    
    logBusinessOperation('Fetching product by ID', { id });
    const product = await ProductModel.getById(id);
    
    if (!product) {
      logger.warn(`⚠️  Product not found: ${id}`);
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    logger.info(`✅ Retrieved product: ${product.name}`);
    
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    logger.error({ error }, '❌ Get product error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product by slug (public)
router.get('/slug/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    
    if (!slug) {
      logger.warn('⚠️  Product slug missing in request');
      res.status(400).json({ error: 'Product slug is required' });
      return;
    }
    
    logBusinessOperation('Fetching product by slug', { slug });
    const product = await ProductModel.getBySlug(slug);
    
    if (!product) {
      logger.warn(`⚠️  Product not found with slug: ${slug}`);
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    logger.info(`✅ Retrieved product by slug: ${product.name}`);
    
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    logger.error({ error }, '❌ Get product by slug error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create product (Admin only)
const createProductSchema = z.object({
  subcategoryId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.string().optional(),
  images: z.array(z.string()).optional(),
  pdfUrl: z.string().optional(),
  specifications: z.any().optional(),
  features: z.array(z.string()).optional(),
  seoKeywords: z.array(z.string()).optional(),
  staticPageUrl: z.string().optional(),
  displayOrder: z.string().optional(),
  isFeatured: z.boolean().optional(),
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const data = createProductSchema.parse(req.body);
    
    // Check if slug already exists
    const existing = await ProductModel.getBySlug(data.slug);
    if (existing) {
      res.status(400).json({ error: 'Product with this slug already exists' });
      return;
    }
    
    const product = await ProductModel.create(cleanData(data) as any);
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.CREATE,
      resourceType: 'product',
      resourceId: product.id,
      details: { name: product.name, slug: product.slug, subcategoryId: product.subcategoryId },
    });
    
    res.json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.issues });
      return;
    }
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product (Admin only)
const updateProductSchema = z.object({
  subcategoryId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.string().optional(),
  images: z.array(z.string()).optional(),
  pdfUrl: z.string().optional(),
  specifications: z.any().optional(),
  features: z.array(z.string()).optional(),
  seoKeywords: z.array(z.string()).optional(),
  staticPageUrl: z.string().optional(),
  displayOrder: z.string().optional(),
  isFeatured: z.boolean().optional(),
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }
    
    const data = updateProductSchema.parse(req.body);
    
    // Check if slug is being changed and if it already exists
    if (data.slug) {
      const existing = await ProductModel.getBySlug(data.slug);
      if (existing && existing.id !== id) {
        res.status(400).json({ error: 'Product with this slug already exists' });
        return;
      }
    }
    
    const product = await ProductModel.update(id, cleanData(data) as any);
    
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.UPDATE,
      resourceType: 'product',
      resourceId: id,
      details: data,
    });
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.issues });
      return;
    }
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle product active status (Admin only)
router.patch('/:id/toggle', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }
    
    const { isActive } = req.body;
    
    const success = await ProductModel.toggleActive(id, isActive);
    
    if (!success) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.UPDATE,
      resourceType: 'product',
      resourceId: id,
      details: { action: isActive ? 'activated' : 'deactivated' },
    });
    
    res.json({
      success: true,
      message: `Product ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('Toggle product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle product featured status (Admin only)
router.patch('/:id/featured', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }
    
    const { isFeatured } = req.body;
    
    const success = await ProductModel.toggleFeatured(id, isFeatured);
    
    if (!success) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.UPDATE,
      resourceType: 'product',
      resourceId: id,
      details: { action: isFeatured ? 'featured' : 'unfeatured' },
    });
    
    res.json({
      success: true,
      message: `Product ${isFeatured ? 'featured' : 'unfeatured'} successfully`,
    });
  } catch (error) {
    console.error('Toggle product featured error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete product (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }
    
    const product = await ProductModel.getById(id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const success = await ProductModel.delete(id);
    
    if (!success) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.DELETE,
      resourceType: 'product',
      resourceId: id,
      details: { name: product.name },
    });
    
    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
