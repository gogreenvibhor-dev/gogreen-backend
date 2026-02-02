import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function addYoutubeVideosMigration() {
  console.log('Running YouTube videos migration...');

  try {
    // Create youtube_videos table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS youtube_videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        youtube_url VARCHAR(500) NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    console.log('✅ YouTube videos table created successfully');

    // Insert some sample videos if table is empty
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM youtube_videos`);
    const count = Number((result.rows[0] as { count: string }).count);

    if (count === 0) {
      console.log('Inserting sample YouTube videos...');
      
      await db.execute(sql`
        INSERT INTO youtube_videos (youtube_url, display_order, is_active)
        VALUES 
          ('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 1, true),
          ('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 2, true),
          ('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 3, true)
      `);

      console.log('✅ Sample videos inserted successfully');
    } else {
      console.log(`ℹ️ Table already has ${count} videos, skipping sample data`);
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }

  process.exit(0);
}

addYoutubeVideosMigration();
