import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function fixPostsTable() {
  console.log('Fixing posts table schema...');

  try {
    // Check if created_at column exists
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'posts' AND column_name = 'created_at'
    `);
    
    if (result.rows.length === 0) {
      console.log('Adding created_at column to posts table...');
      await db.execute(sql`
        ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW() NOT NULL
      `);
      console.log('✅ created_at column added');
    } else {
      console.log('✅ created_at column already exists');
    }
    
    console.log('✅ Posts table fix completed!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }

  process.exit(0);
}

fixPostsTable();
