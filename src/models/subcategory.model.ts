import { db } from '../db/index.js';
import { subcategories } from '../db/schema.js';
import { eq, desc, asc, and } from 'drizzle-orm';

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  displayOrder: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class SubcategoryModel {
  static async create(data: {
    categoryId: string;
    name: string;
    slug: string;
    description?: string | undefined;
    image?: string | undefined;
    displayOrder?: string | undefined;
  }): Promise<Subcategory> {
    const result = await db.insert(subcategories).values(data).returning();
    return result[0]!;
  }

  static async getAll(includeInactive = false): Promise<Subcategory[]> {
    if (includeInactive) {
      return await db.select().from(subcategories).orderBy(asc(subcategories.displayOrder));
    }
    return await db.select().from(subcategories).where(eq(subcategories.isActive, true)).orderBy(asc(subcategories.displayOrder));
  }

  static async getById(id: string): Promise<Subcategory | null> {
    const result = await db.select().from(subcategories).where(eq(subcategories.id, id)).limit(1);
    return result.length > 0 ? result[0]! : null;
  }

  static async getBySlug(slug: string): Promise<Subcategory | null> {
    const result = await db.select().from(subcategories).where(eq(subcategories.slug, slug)).limit(1);
    return result.length > 0 ? result[0]! : null;
  }

  static async getByCategoryId(categoryId: string, includeInactive = false): Promise<Subcategory[]> {
    if (includeInactive) {
      return await db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId)).orderBy(asc(subcategories.displayOrder));
    }
    return await db
      .select()
      .from(subcategories)
      .where(and(eq(subcategories.categoryId, categoryId), eq(subcategories.isActive, true)))
      .orderBy(asc(subcategories.displayOrder));
  }

  static async update(id: string, data: Partial<Omit<Subcategory, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Subcategory | null> {
    const result = await db
      .update(subcategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subcategories.id, id))
      .returning();
    return result.length > 0 ? result[0]! : null;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await db.delete(subcategories).where(eq(subcategories.id, id)).returning();
    return result.length > 0;
  }

  static async toggleActive(id: string, isActive: boolean): Promise<boolean> {
    const result = await db
      .update(subcategories)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(subcategories.id, id))
      .returning();
    return result.length > 0;
  }
}
