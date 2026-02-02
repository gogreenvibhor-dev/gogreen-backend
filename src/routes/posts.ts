
import { Router, type IRouter} from 'express';
import { db } from '../db/index.js';
import { posts } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, requireEditor } from '../middleware/auth.middleware.js';
import { z } from 'zod';

const router: IRouter = Router();

// Validation Schemas
const createPostSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  content: z.object({}).passthrough(), // Accept any valid JSON object for Tiptap
  coverImage: z.string().optional(),
  seoKeywords: z.array(z.string()).optional(),
  published: z.boolean().optional(),
});

const updatePostSchema = createPostSchema.partial();

// GET all posts (Public or Admin)
// If public, only show published. If admin/editor, show all.
router.get('/', async (req, res) => {
  try {
    // Basic implementation: fetch all. 
    // In a real app, you might filter by published status based on auth.
    // For now, let's just return all and let frontend decide or refactor later for public view.
    // Actually, distinct public view is usually a different endpoint or query param.
    // Let's assume this is the Administration list for now unless ?public=true
    
    // Check if public request
    const isPublic = req.query.public === 'true';
    
    let query = db.select().from(posts).orderBy(desc(posts.createdAt));
    
    if (isPublic) {
       // @ts-ignore - simple filter
       query = db.select().from(posts).where(eq(posts.published, true)).orderBy(desc(posts.publishedAt));
    }
    
    const allPosts = await query;
    res.json(allPosts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// GET single post by slug or ID
router.get('/:identifier', async (req, res) => {
  try {
    const identifier = req.params.identifier!;
    let post;
    
    // Check if identifier is numeric (ID) or string (slug)
    if (/^\d+$/.test(identifier)) {
      // It's an ID
      const id = parseInt(identifier);
      post = await db.query.posts.findFirst({
        where: eq(posts.id, id),
      });
    } else {
      // It's a slug
      post = await db.query.posts.findFirst({
        where: eq(posts.slug, identifier),
      });
    }
    
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// POST create post (Protected)
router.post('/', authenticateToken, requireEditor, async (req, res) => {
  try {
    const body = createPostSchema.parse(req.body);
    
    // Check slug uniqueness
    const existing = await db.query.posts.findFirst({
      where: eq(posts.slug, body.slug),
    });
    
    if (existing) {
      res.status(400).json({ error: 'Slug already exists' });
      return;
    }

    const [newPost] = await db.insert(posts).values({
      title: body.title,
      slug: body.slug,
      content: body.content,
      coverImage: body.coverImage || null,
      seoKeywords: body.seoKeywords || null,
      published: body.published || false,
      publishedAt: body.published ? new Date() : null,
    }).returning();
    
    res.status(201).json(newPost);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      res.status(500).json({ error: 'Failed to create post' });
    }
  }
});

// PUT update post (supports both ID and slug)
router.put('/:identifier', authenticateToken, requireEditor, async (req, res) => {
  try {
    const identifier = req.params.identifier!;
    const body = updatePostSchema.parse(req.body);
    
    // Find the post first by ID or slug
    let existingPost;
    if (/^\d+$/.test(identifier)) {
      // It's an ID
      const id = parseInt(identifier);
      existingPost = await db.query.posts.findFirst({
        where: eq(posts.id, id),
      });
    } else {
      // It's a slug
      existingPost = await db.query.posts.findFirst({
        where: eq(posts.slug, identifier),
      });
    }
    
    if (!existingPost) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    
    // Check slug uniqueness if slug is being changed
    if (body.slug && body.slug !== existingPost.slug) {
       const slugExists = await db.query.posts.findFirst({
        where: eq(posts.slug, body.slug),
      });
      if (slugExists) {
        res.status(400).json({ error: 'Slug already exists' });
        return;
      }
    }

    const [updatedPost] = await db.update(posts)
      .set({
        ...body,
        updatedAt: new Date(),
        publishedAt: body.published === true ? new Date() : undefined,
      })
      .where(eq(posts.id, existingPost.id))
      .returning();
      
    res.json(updatedPost);
  } catch (error) {
     if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues }); 
    } else {
      console.error('Update post error:', error);
      res.status(500).json({ error: 'Failed to update post' });
    }
  }
});


export default router;
