import { db } from '../db/index.js';
import { contactSubmissions } from '../db/schema.js';
import { eq, desc, count } from 'drizzle-orm';

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  countryCode: string;
  phone: string;
  message: string;
  status: string;
  createdAt: Date;
}

export class ContactModel {
  static async create(data: {
    name: string;
    email: string;
    countryCode: string;
    phone: string;
    message: string;
  }): Promise<ContactSubmission> {
    const result = await db.insert(contactSubmissions).values(data).returning();
    return result[0]!;
  }

  static async getAll(page = 1, limit = 20): Promise<{ data: ContactSubmission[], total: number, pages: number }> {
    const offset = (page - 1) * limit;
    
    const [totalCount] = await db.select({ count: count() }).from(contactSubmissions);
    const total = totalCount?.count || 0;
    
    const data = await db.select()
      .from(contactSubmissions)
      .orderBy(desc(contactSubmissions.createdAt))
      .limit(limit)
      .offset(offset);
      
    return {
      data,
      total,
      pages: Math.ceil(total / limit)
    };
  }

  static async getById(id: string): Promise<ContactSubmission | null> {
    const result = await db.select().from(contactSubmissions).where(eq(contactSubmissions.id, id)).limit(1);
    return result.length > 0 ? result[0]! : null;
  }

  static async updateStatus(id: string, status: string): Promise<ContactSubmission | null> {
    const result = await db
      .update(contactSubmissions)
      .set({ status })
      .where(eq(contactSubmissions.id, id))
      .returning();
    return result.length > 0 ? result[0]! : null;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await db.delete(contactSubmissions).where(eq(contactSubmissions.id, id)).returning();
    return result.length > 0;
  }
}
