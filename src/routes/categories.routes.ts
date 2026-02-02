import { Router, type Request, type Response, type IRouter } from 'express';
import { authenticateToken, requireAdmin, type AuthRequest } from '../middleware/auth.middleware.js';
import { CategoryModel } from '../models/category.model.js';
import { AuditLogModel } from '../models/audit-log.model.js';
import { z } from 'zod';
import { ActionType } from '../types/auth.js';

const router: IRouter = Router();

// Helper to remove undefined keys for exactOptionalPropertyTypes compliance
function cleanData(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

// Get all categories (public)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const categories = await CategoryModel.getAll(includeInactive);
    
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get category by ID (public)
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Category ID is required' });
      return;
    }
    
    const category = await CategoryModel.getById(id);
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get category by slug (public)
router.get('/slug/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    
    if (!slug) {
      res.status(400).json({ error: 'Category slug is required' });
      return;
    }
    
    const category = await CategoryModel.getBySlug(slug);
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Get category by slug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create category (Admin only)
const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  image: z.string().optional(),
  displayOrder: z.string().optional(),
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const data = createCategorySchema.parse(req.body);
    
    // Check if slug already exists
    const existing = await CategoryModel.getBySlug(data.slug);
    if (existing) {
      res.status(400).json({ error: 'Category with this slug already exists' });
      return;
    }
    
    const category = await CategoryModel.create(cleanData(data) as any);
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.CREATE,
      resourceType: 'category',
      resourceId: category.id,
      details: { name: category.name, slug: category.slug },
    });
    
    res.json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.issues });
      return;
    }
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle category active status (Admin only) - MUST BE BEFORE /:id route
router.patch('/:id/toggle', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Category ID is required' });
      return;
    }
    
    const { isActive } = req.body;
    
    const success = await CategoryModel.toggleActive(id, isActive);
    
    if (!success) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.UPDATE,
      resourceType: 'category',
      resourceId: id,
      details: { action: isActive ? 'activated' : 'deactivated' },
    });
    
    res.json({
      success: true,
      message: `Category ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('Toggle category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category (Admin only)
const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  displayOrder: z.string().optional(),
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Category ID is required' });
      return;
    }
    
    const data = updateCategorySchema.parse(req.body);
    
    // Check if slug is being changed and if it already exists
    if (data.slug) {
      const existing = await CategoryModel.getBySlug(data.slug);
      if (existing && existing.id !== id) {
        res.status(400).json({ error: 'Category with this slug already exists' });
        return;
      }
    }
    
    const category = await CategoryModel.update(id, cleanData(data) as any);
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.UPDATE,
      resourceType: 'category',
      resourceId: id,
      details: data,
    });
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.issues });
      return;
    }
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Category ID is required' });
      return;
    }
    
    const category = await CategoryModel.getById(id);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    const success = await CategoryModel.delete(id);
    
    if (!success) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.DELETE,
      resourceType: 'category',
      resourceId: id,
      details: { name: category.name },
    });
    
    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
