import { Router, type Request, type Response, type IRouter } from 'express';
import { authenticateToken, requireEditor, type AuthRequest } from '../middleware/auth.middleware.js';
import { db } from '../db/index.js';
import { youtubeVideos } from '../db/schema.js';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { AuditLogModel } from '../models/audit-log.model.js';
import { ActionType } from '../types/auth.js';
import axios from 'axios';

const router: IRouter = Router();

// Helper to revalidate frontend cache
async function revalidateFrontend(tag: string) {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const secret = process.env.REVALIDATION_SECRET || 'gogreen_revalidation_secret';
    
    await axios.post(`${frontendUrl}/api/revalidate`, null, {
      params: { tag, secret }
    });
    console.log(`Revalidated tag: ${tag}`);
  } catch (error) {
    console.error('Revalidation failed:', error);
  }
}

// Helper to extract YouTube video ID from URL
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

// Get all active YouTube videos (public)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const videos = await db
      .select()
      .from(youtubeVideos)
      .where(eq(youtubeVideos.isActive, true))
      .orderBy(asc(youtubeVideos.displayOrder));

    // Add embed URL for convenience
    const videosWithEmbed = videos.map(video => {
      const videoId = extractYouTubeVideoId(video.youtubeUrl);
      return {
        ...video,
        embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
        videoId,
      };
    });

    res.json({
      success: true,
      data: videosWithEmbed,
    });
  } catch (error) {
    console.error('Get YouTube videos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all YouTube videos for admin (includes inactive)
router.get('/admin', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const videos = await db
      .select()
      .from(youtubeVideos)
      .orderBy(asc(youtubeVideos.displayOrder));

    const videosWithEmbed = videos.map(video => {
      const videoId = extractYouTubeVideoId(video.youtubeUrl);
      return {
        ...video,
        embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
        videoId,
      };
    });

    res.json({
      success: true,
      data: videosWithEmbed,
    });
  } catch (error) {
    console.error('Get YouTube videos (admin) error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create YouTube video schema - only URL required
const createVideoSchema = z.object({
  youtubeUrl: z.string().url('Invalid YouTube URL'),
  displayOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

// Create a new YouTube video
router.post('/', authenticateToken, requireEditor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const data = createVideoSchema.parse(req.body);

    // Validate that it's a valid YouTube URL
    const videoId = extractYouTubeVideoId(data.youtubeUrl);
    if (!videoId) {
      res.status(400).json({ error: 'Invalid YouTube URL. Please provide a valid YouTube video link.' });
      return;
    }

    const [newVideo] = await db.insert(youtubeVideos)
      .values({
        youtubeUrl: data.youtubeUrl,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
      })
      .returning();

    if (!newVideo) {
      res.status(500).json({ error: 'Failed to create YouTube video' });
      return;
    }

    // Revalidate homepage
    await revalidateFrontend('youtube-videos');

    // Log audit
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.CREATE,
      resourceType: 'youtube_video',
      resourceId: newVideo.id,
      details: { youtubeUrl: data.youtubeUrl },
    });

    res.status(201).json({
      success: true,
      message: 'YouTube video added successfully',
      data: {
        ...newVideo,
        embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
        videoId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
      return;
    }
    console.error('Create YouTube video error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update YouTube video schema
const updateVideoSchema = z.object({
  youtubeUrl: z.string().url('Invalid YouTube URL').optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// Update a YouTube video
router.patch('/:id', authenticateToken, requireEditor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Video ID is required' });
      return;
    }
    const data = updateVideoSchema.parse(req.body);

    // If URL is being updated, validate it
    if (data.youtubeUrl) {
      const videoId = extractYouTubeVideoId(data.youtubeUrl);
      if (!videoId) {
        res.status(400).json({ error: 'Invalid YouTube URL. Please provide a valid YouTube video link.' });
        return;
      }
    }

    const [updatedVideo] = await db.update(youtubeVideos)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(youtubeVideos.id, id))
      .returning();

    if (!updatedVideo) {
      res.status(404).json({ error: 'YouTube video not found' });
      return;
    }

    // Revalidate homepage
    await revalidateFrontend('youtube-videos');

    // Log audit
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.UPDATE,
      resourceType: 'youtube_video',
      resourceId: id,
      details: { updatedFields: Object.keys(data) },
    });

    res.json({
      success: true,
      message: 'YouTube video updated successfully',
      data: {
        ...updatedVideo,
        embedUrl: `https://www.youtube.com/embed/${extractYouTubeVideoId(updatedVideo.youtubeUrl)}?rel=0&modestbranding=1`,
        videoId: extractYouTubeVideoId(updatedVideo.youtubeUrl),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
      return;
    }
    console.error('Update YouTube video error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a YouTube video
router.delete('/:id', authenticateToken, requireEditor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Video ID is required' });
      return;
    }

    const [deletedVideo] = await db.delete(youtubeVideos)
      .where(eq(youtubeVideos.id, id))
      .returning();

    if (!deletedVideo) {
      res.status(404).json({ error: 'YouTube video not found' });
      return;
    }

    // Revalidate homepage
    await revalidateFrontend('youtube-videos');

    // Log audit
    await AuditLogModel.create({
      userId: req.user.userId,
      action: ActionType.DELETE,
      resourceType: 'youtube_video',
      resourceId: id,
      details: { youtubeUrl: deletedVideo.youtubeUrl },
    });

    res.json({
      success: true,
      message: 'YouTube video deleted successfully',
    });
  } catch (error) {
    console.error('Delete YouTube video error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder videos
const reorderSchema = z.object({
  videoOrders: z.array(z.object({
    id: z.string().uuid(),
    displayOrder: z.number().int(),
  })),
});

router.post('/reorder', authenticateToken, requireEditor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const data = reorderSchema.parse(req.body);

    // Update each video's display order
    for (const item of data.videoOrders) {
      await db.update(youtubeVideos)
        .set({ displayOrder: item.displayOrder, updatedAt: new Date() })
        .where(eq(youtubeVideos.id, item.id));
    }

    // Revalidate homepage
    await revalidateFrontend('youtube-videos');

    res.json({
      success: true,
      message: 'Video order updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
      return;
    }
    console.error('Reorder videos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
