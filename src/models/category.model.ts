import { db } from '../db/index.js';
import { categories } from '../db/schema.js';
import { eq, desc, asc } from 'drizzle-orm';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  displayOrder: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CategoryModel {
  static async create(data: {
    name: string;
    slug: string;
    description?: string | undefined;
    image?: string | undefined;
    displayOrder?: string | undefined;
  }): Promise<Category> {
    const result = await db.insert(categories).values(data).returning();
    return result[0]!;
  }

  static async getAll(includeInactive = false): Promise<Category[]> {
    if (includeInactive) {
      return await db.select().from(categories).orderBy(asc(categories.displayOrder));
    }
    return await db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.displayOrder));
  }

  static async getById(id: string): Promise<Category | null> {
    const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return result.length > 0 ? result[0]! : null;
  }

  static async getBySlug(slug: string): Promise<Category | null> {
    const result = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    return result.length > 0 ? result[0]! : null;
  }

  static async update(id: string, data: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Category | null> {
    const result = await db
      .update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return result.length > 0 ? result[0]! : null;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id)).returning();
    return result.length > 0;
  }

  static async toggleActive(id: string, isActive: boolean): Promise<boolean> {
    const result = await db
      .update(categories)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return result.length > 0;
  }
}
