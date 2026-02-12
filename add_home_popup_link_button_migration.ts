
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: path.resolve(__dirname, '.env.local') });

async function applyMigration() {
  try {
    console.log('🔄 Adding link column to home_popups table...');
    
    await db.execute(sql`
      ALTER TABLE home_popups 
      ADD COLUMN IF NOT EXISTS link varchar(500);
    `);
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
