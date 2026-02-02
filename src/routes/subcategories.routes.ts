import { Router, type Request, type Response, type IRouter } from 'express';
import { authenticateToken, requireAdmin, type AuthRequest } from '../middleware/auth.middleware.js';
import { SubcategoryModel } from '../models/subcategory.model.js';
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

// Get all subcategories (public)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const categoryId = req.query.categoryId as string | undefined;
    
    let subcategories;
    if (categoryId) {
      subcategories = await SubcategoryModel.getByCategoryId(categoryId, includeInactive);
    } else {
      subcategories = await SubcategoryModel.getAll(includeInactive);
    }
    
    res.json({
      success: true,
      data: subcategories,
    });
  } catch (error) {
    console.error('Get subcategories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get subcategory by ID (public)
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Subcategory ID is required' });
      return;
    }
    
    const subcategory = await SubcategoryModel.getById(id);
    
    if (!subcategory) {
      res.status(404).json({ error: 'Subcategory not found' });
      return;
    }
    
    res.json({
      success: true,
      data: subcategory,
    });
  } catch (error) {
    console.error('Get subcategory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get subcategory by slug (public)
router.get('/slug/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    
    if (!slug) {
      res.status(400).json({ error: 'Subcategory slug is required' });
      return;
    }
    
    const subcategory = await SubcategoryModel.getBySlug(slug);
    
    if (!subcategory) {
      res.status(404).json({ error: 'Subcategory not found' });
      return;
    }
    
    res.json({
      success: true,
      data: subcategory,
    });
  } catch (error) {
    console.error('Get subcategory by slug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create subcategory (Admin only)
const createSubcategorySchema = z.object({
  categoryId: z.string().min(1),
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
    
    const data = createSubcategorySchema.parse(req.body);
    
    // Check if slug already exists
    const existing = await SubcategoryModel.getBySlug(data.slug);
    if (existing) {
      res.status(400).json({ error: 'Subcategory with this slug already exists' });
      return;
    }
    
    const subcategory = await SubcategoryModel.create(cleanData(data) as any);
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.CREATE,
      resourceType: 'subcategory',
      resourceId: subcategory.id,
      details: { name: subcategory.name, slug: subcategory.slug, categoryId: subcategory.categoryId },
    });
    
    res.json({
      success: true,
      message: 'Subcategory created successfully',
      data: subcategory,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.issues });
      return;
    }
    console.error('Create subcategory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle subcategory active status (Admin only) - MUST BE BEFORE /:id route
router.patch('/:id/toggle', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Subcategory ID is required' });
      return;
    }
    
    const { isActive } = req.body;
    
    const success = await SubcategoryModel.toggleActive(id, isActive);
    
    if (!success) {
      res.status(404).json({ error: 'Subcategory not found' });
      return;
    }
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.UPDATE,
      resourceType: 'subcategory',
      resourceId: id,
      details: { action: isActive ? 'activated' : 'deactivated' },
    });
    
    res.json({
      success: true,
      message: `Subcategory ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('Toggle subcategory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update subcategory (Admin only)
const updateSubcategorySchema = z.object({
  categoryId: z.string().min(1).optional(),
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
      res.status(400).json({ error: 'Subcategory ID is required' });
      return;
    }
    
    const data = updateSubcategorySchema.parse(req.body);
    
    // Check if slug is being changed and if it already exists
    if (data.slug) {
      const existing = await SubcategoryModel.getBySlug(data.slug);
      if (existing && existing.id !== id) {
        res.status(400).json({ error: 'Subcategory with this slug already exists' });
        return;
      }
    }
    
    const subcategory = await SubcategoryModel.update(id, cleanData(data) as any);
    
    if (!subcategory) {
      res.status(404).json({ error: 'Subcategory not found' });
      return;
    }
    
    // Log the action   
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.UPDATE,
      resourceType: 'subcategory',
      resourceId: id,
      details: data,
    });
    
    res.json({
      success: true,
      message: 'Subcategory updated successfully',
      data: subcategory,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.issues });
      return;
    }
    console.error('Update subcategory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete subcategory (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Subcategory ID is required' });
      return;
    }
    
    const subcategory = await SubcategoryModel.getById(id);
    if (!subcategory) {
      res.status(404).json({ error: 'Subcategory not found' });
      return;
    }
    
    const success = await SubcategoryModel.delete(id);
    
    if (!success) {
      res.status(404).json({ error: 'Subcategory not found' });
      return;
    }
    
    // Log the action
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.DELETE,
      resourceType: 'subcategory',
      resourceId: id,
      details: { name: subcategory.name },
    });
    
    res.json({
      success: true,
      message: 'Subcategory deleted successfully',
    });
  } catch (error) {
    console.error('Delete subcategory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
