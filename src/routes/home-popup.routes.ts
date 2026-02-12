
import { Router, type IRouter, type Response } from 'express';
import { db } from '../db/index.js';
import { homePopups } from '../db/schema.js';
import { eq, desc, and, or, isNull, lte, gte } from 'drizzle-orm';
import { z } from 'zod';
import { authenticateToken, requireAdmin, type AuthRequest } from '../middleware/auth.middleware.js';

const router: IRouter = Router();

// Get active popup for homepage
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    
    // Fetch all active popups that match date criteria
    const popups = await db.query.homePopups.findMany({
      where: and(
        eq(homePopups.isActive, true),
        or(isNull(homePopups.startDate), lte(homePopups.startDate, now)),
        or(isNull(homePopups.endDate), gte(homePopups.endDate, now))
      ),
      orderBy: [desc(homePopups.createdAt)],
    });

    res.json({ success: true, data: popups });
  } catch (error) {
    console.error('Error fetching home popup:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Admin: Create new popup
const createPopupSchema = z.object({
  imageUrl: z.string().url(),
  isActive: z.boolean().default(true),
  link: z.string().url().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(), // Expects ISO string
  endDate: z.string().datetime().optional().nullable(),
});

router.post('/admin', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = createPopupSchema.parse(req.body);

    const [newPopup] = await db.insert(homePopups).values({
      imageUrl: body.imageUrl,
      isActive: body.isActive,
      link: body.link || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    }).returning();

    res.status(201).json({ success: true, data: newPopup });
  } catch (error) {
    if (error instanceof z.ZodError) {
       res.status(400).json({ success: false, error: error.issues });
       return;
    }
    console.error('Error creating home popup:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Admin: Delete popup
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
       res.status(400).json({ success: false, error: 'Popup ID is required' });
       return;
    }

    const [deletedPopup] = await db.delete(homePopups)
      .where(eq(homePopups.id, id))
      .returning();

    if (!deletedPopup) {
       res.status(404).json({ success: false, error: 'Popup not found' });
       return;
    }

    res.json({ success: true, message: 'Popup deleted successfully' });
  } catch (error) {
    console.error('Error deleting home popup:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
