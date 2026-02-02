/**
 * Migration to add static_page_url column to products table
 * This allows products to be linked to existing static product pages in the Next.js app
 * 
 * Run with: npx tsx add_static_page_url_migration.ts
 */

import { db, pool } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function addStaticPageUrlColumn() {
  console.log('Adding static_page_url column to products table...');
  
  try {
    // Check if column already exists
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'static_page_url'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('Column static_page_url already exists. Skipping migration.');
      return;
    }
    
    // Add the column
    await db.execute(sql`
      ALTER TABLE products 
      ADD COLUMN static_page_url VARCHAR(500)
    `);
    
    console.log('✅ Successfully added static_page_url column to products table');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

addStaticPageUrlColumn()
  .then(async () => {
    console.log('Migration completed');
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  });
