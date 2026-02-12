import { pgTable, uuid, varchar, timestamp, pgEnum, text, json, jsonb, boolean, serial, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';


// Enum for user roles
export const userRoleEnum = pgEnum('user_role', ['admin', 'editor']);

// Enum for change status
export const changeStatusEnum = pgEnum('change_status', ['pending', 'approved', 'rejected']);

// Enum for action types
export const actionTypeEnum = pgEnum('action_type', ['create', 'update', 'delete', 'login', 'logout', 'approve', 'reject']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('editor'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
// Categories table
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  image: varchar('image', { length: 500 }),
  displayOrder: varchar('display_order', { length: 10 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Subcategories table
export const subcategories = pgTable('subcategories', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  image: varchar('image', { length: 500 }),
  displayOrder: varchar('display_order', { length: 10 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Products table

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  subcategoryId: uuid('subcategory_id').notNull().references(() => subcategories.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  shortDescription: text('short_description'),
  price: varchar('price', { length: 50 }),
  images: json('images').$type<string[]>(),
  coverImage: varchar('cover_image', { length: 500 }),
  pdfUrl: varchar('pdf_url', { length: 500 }),
  specifications: json('specifications'),
  features: json('features').$type<string[]>(),
  seoKeywords: json('seo_keywords').$type<string[]>(),
  // Static page URL - links to existing static product pages in the Next.js app
  staticPageUrl: varchar('static_page_url', { length: 500 }),
  displayOrder: varchar('display_order', { length: 10 }),
  isActive: boolean('is_active').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    searchIndex: index('search_index').using('gin', sql`(
      setweight(to_tsvector('english', ${table.name}), 'A') ||
      setweight(to_tsvector('english', coalesce(${table.description}, '')), 'B')
    )`),
  };
});
// Audit logs table
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  action: actionTypeEnum('action').notNull(),
  resourceType: varchar('resource_type', { length: 100 }),
  resourceId: varchar('resource_id', { length: 255 }),
  details: json('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Pending changes table for approval workflow
export const pendingChanges = pgTable('pending_changes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  action: actionTypeEnum('action').notNull(),
  resourceType: varchar('resource_type', { length: 100 }).notNull(),
  resourceId: varchar('resource_id', { length: 255 }),
  changeData: json('change_data').notNull(),
  previousData: json('previous_data'),
  status: changeStatusEnum('status').notNull().default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Product Specifications table with JSONB for flexible table structures
export const productSpecifications = pgTable('product_specifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  // 'grid' = standard table, 'matrix' = complex merged headers, 'image' = specification image
  type: varchar('type', { length: 50 }).notNull().default('grid'),
  // JSONB column for flexible table structure (headers, rows, merged cells)
  content: jsonb('content').notNull(),
  displayOrder: varchar('display_order', { length: 10 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Define relations
export const productsRelations = relations(products, ({ one, many }) => ({
  subcategory: one(subcategories, {
    fields: [products.subcategoryId],
    references: [subcategories.id],
  }),
  specifications: many(productSpecifications),
}));

export const subcategoriesRelations = relations(subcategories, ({ one, many }) => ({
  category: one(categories, {
    fields: [subcategories.categoryId],
    references: [categories.id],
  }),
  products: many(products),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  subcategories: many(subcategories),
}));

export const specificationsRelations = relations(productSpecifications, ({ one }) => ({
  product: one(products, {
    fields: [productSpecifications.productId],
    references: [products.id],
  }),
}));

// Type exports for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductSpecification = typeof productSpecifications.$inferSelect;
export type NewProductSpecification = typeof productSpecifications.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Subcategory = typeof subcategories.$inferSelect;
export type NewSubcategory = typeof subcategories.$inferInsert;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type PendingChange = typeof pendingChanges.$inferSelect;
export type NewPendingChange = typeof pendingChanges.$inferInsert;

// Blog Posts table
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: jsonb('content').notNull(),
  coverImage: varchar('cover_image', { length: 500 }),
  seoKeywords: json('seo_keywords').$type<string[]>(),
  published: boolean('published').default(false),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export const globalSettings = pgTable('global_settings', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type GlobalSetting = typeof globalSettings.$inferSelect;
export type NewGlobalSetting = typeof globalSettings.$inferInsert;

export const contactSubmissions = pgTable('contact_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  countryCode: varchar('country_code', { length: 10 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('new'), // new, read, archived
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type NewContactSubmission = typeof contactSubmissions.$inferInsert;

// Analytics table for tracking page views
export const analytics = pgTable('analytics', {
  id: uuid('id').defaultRandom().primaryKey(),
  page: varchar('page', { length: 500 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  referer: varchar('referer', { length: 500 }),
  country: varchar('country', { length: 100 }),
  device: varchar('device', { length: 50 }), // mobile, tablet, desktop
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    pageIdx: index('analytics_page_idx').on(table.page),
    dateIdx: index('analytics_date_idx').on(table.createdAt),
  };
});

export type AnalyticsEntry = typeof analytics.$inferSelect;
export type NewAnalyticsEntry = typeof analytics.$inferInsert;

// YouTube videos table for homepage videos section
export const youtubeVideos = pgTable('youtube_videos', {
  id: uuid('id').defaultRandom().primaryKey(),
  youtubeUrl: varchar('youtube_url', { length: 500 }).notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type YoutubeVideo = typeof youtubeVideos.$inferSelect;
export type NewYoutubeVideo = typeof youtubeVideos.$inferInsert;

// Home Popups table for managing homepage entry popups
export const homePopups = pgTable('home_popups', {
  id: uuid('id').defaultRandom().primaryKey(),
  imageUrl: text('image_url').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  link: varchar('link', { length: 500 }),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type HomePopup = typeof homePopups.$inferSelect;
export type NewHomePopup = typeof homePopups.$inferInsert;
