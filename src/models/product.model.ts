import { db } from '../db/index.js';
import { products, productSpecifications } from '../db/schema.js';
import { eq, desc, asc, and, sql } from 'drizzle-orm';

export interface Product {
  id: string;
  subcategoryId: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  price: string | null;
  images: string[] | null;
  coverImage: string | null;
  pdfUrl: string | null;
  specifications: any | null;
  features: string[] | null;
  seoKeywords: string[] | null;
  staticPageUrl: string | null;
  displayOrder: string | null;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ProductModel {
  static async create(data: {
    subcategoryId: string;
    name: string;
    slug: string;
    description?: string | undefined;
    shortDescription?: string | undefined;
    price?: string | undefined;
    images?: string[] | undefined;
    coverImage?: string | undefined;
    pdfUrl?: string | undefined;
    specifications?: any;
    features?: string[] | undefined;
    seoKeywords?: string[] | undefined;
    staticPageUrl?: string | undefined;
    displayOrder?: string | undefined;
    isFeatured?: boolean | undefined;
  }): Promise<Product> {
    const result = await db.insert(products).values(data).returning();
    return result[0]!;
  }

  static async getAll(includeInactive = false): Promise<Product[]> {
    const query = db.query.products.findMany({
      where: includeInactive ? undefined : eq(products.isActive, true),
      with: {
        specifications: {
          where: eq(productSpecifications.isActive, true),
        },
      },
      orderBy: asc(products.displayOrder),
    });
    return await query;
  }

  static async getById(id: string): Promise<Product | null> {
    const result = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        specifications: {
          where: eq(productSpecifications.isActive, true),
        },
      },
    });
    return result || null;
  }

  static async getBySlug(slug: string): Promise<Product | null> {
    const result = await db.query.products.findFirst({
      where: eq(products.slug, slug),
      with: {
        specifications: {
          where: eq(productSpecifications.isActive, true),
        },
      },
    });
    return result || null;
  }

  static async getBySubcategoryId(subcategoryId: string, includeInactive = false): Promise<Product[]> {
    const query = db.query.products.findMany({
      where: includeInactive 
        ? eq(products.subcategoryId, subcategoryId)
        : and(eq(products.subcategoryId, subcategoryId), eq(products.isActive, true)),
      with: {
        specifications: {
          where: eq(productSpecifications.isActive, true),
        },
      },
      orderBy: asc(products.displayOrder),
    });
    return await query;
  }

  static async getFeatured(limit = 10): Promise<Product[]> {
    const query = db.query.products.findMany({
      where: and(eq(products.isFeatured, true), eq(products.isActive, true)),
      with: {
        specifications: {
          where: eq(productSpecifications.isActive, true),
        },
      },
      orderBy: asc(products.displayOrder),
      limit,
    });
    return await query;
  }

  static async update(id: string, data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Product | null> {
    const result = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return result.length > 0 ? result[0]! : null;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  static async toggleActive(id: string, isActive: boolean): Promise<boolean> {
    const result = await db
      .update(products)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return result.length > 0;
  }

  static async toggleFeatured(id: string, isFeatured: boolean): Promise<boolean> {
    const result = await db
      .update(products)
      .set({ isFeatured, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return result.length > 0;
  }
  static async search(query: string, includeInactive = false): Promise<Product[]> {
    // Use multiple search strategies for better results:
    // 1. Exact match and prefix matching with ILIKE
    // 2. Full-text search with PostgreSQL
    // 3. Trigram similarity for typo tolerance
    
    const searchPattern = `%${query}%`;
    
    return await db
      .select()
      .from(products)
      .where(
        and(
          includeInactive ? undefined : eq(products.isActive, true),
          sql`(
            -- Strategy 1: Pattern matching (fast, handles partial matches)
            LOWER(${products.name}) LIKE LOWER(${searchPattern}) OR
            LOWER(COALESCE(${products.description}, '')) LIKE LOWER(${searchPattern}) OR
            LOWER(COALESCE(${products.shortDescription}, '')) LIKE LOWER(${searchPattern}) OR
            
            -- Strategy 2: Full-text search (handles multiple words)
            (
              setweight(to_tsvector('english', ${products.name}), 'A') ||
              setweight(to_tsvector('english', coalesce(${products.description}, '')), 'B') ||
              setweight(to_tsvector('english', coalesce(${products.shortDescription}, '')), 'C')
            ) @@ plainto_tsquery('english', ${query}) OR
            
            -- Strategy 3: Trigram similarity (handles typos)
            similarity(LOWER(${products.name}), LOWER(${query})) > 0.2 OR
            
            -- Strategy 4: Word distance (Levenshtein) for close matches
            word_similarity(LOWER(${query}), LOWER(${products.name})) > 0.3
          )`
        )
      )
      .orderBy(
        // Order by relevance score combining multiple factors
        desc(sql`(
          -- Exact match gets highest score
          CASE WHEN LOWER(${products.name}) = LOWER(${query}) THEN 100 ELSE 0 END +
          
          -- Starts with query gets high score
          CASE WHEN LOWER(${products.name}) LIKE LOWER(${query} || '%') THEN 50 ELSE 0 END +
          
          -- Contains query gets medium score
          CASE WHEN LOWER(${products.name}) LIKE LOWER(${searchPattern}) THEN 25 ELSE 0 END +
          
          -- Full-text search ranking
          ts_rank(
            setweight(to_tsvector('english', ${products.name}), 'A') ||
            setweight(to_tsvector('english', coalesce(${products.description}, '')), 'B'),
            plainto_tsquery('english', ${query})
          ) * 10 +
          
          -- Trigram similarity score
          similarity(LOWER(${products.name}), LOWER(${query})) * 30 +
          
          -- Word similarity score
          word_similarity(LOWER(${query}), LOWER(${products.name})) * 20
        )`)
      );
  }
}
