import { config } from 'dotenv';
import pg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'khush'}:${process.env.DB_PASSWORD || 'khush123'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'gogreen'}`,
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if country_code column already exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'contact_submissions' 
      AND column_name = 'country_code'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('Adding country_code column...');
      
      // Add country_code column with default value first
      await client.query(`
        ALTER TABLE "contact_submissions" ADD COLUMN "country_code" varchar(10)
      `);
      
      // Update existing rows with a default country code
      await client.query(`
        UPDATE "contact_submissions" SET "country_code" = '+1' WHERE "country_code" IS NULL
      `);
      
      // Now make it NOT NULL
      await client.query(`
        ALTER TABLE "contact_submissions" ALTER COLUMN "country_code" SET NOT NULL
      `);
      
      console.log('✓ country_code column added');
    } else {
      console.log('✓ country_code column already exists');
    }
    
    // Check if phone column is nullable
    const checkPhone = await client.query(`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'contact_submissions' 
      AND column_name = 'phone'
    `);
    
    if (checkPhone.rows[0]?.is_nullable === 'YES') {
      console.log('Making phone column NOT NULL...');
      
      // First update any null values
      await client.query(`
        UPDATE "contact_submissions" SET "phone" = '0000000000' WHERE "phone" IS NULL
      `);
      
      // Make phone NOT NULL
      await client.query(`
        ALTER TABLE "contact_submissions" ALTER COLUMN "phone" SET NOT NULL
      `);
      
      console.log('✓ phone column is now NOT NULL');
    } else {
      console.log('✓ phone column is already NOT NULL');
    }
    
    await client.query('COMMIT');
    console.log('\n✓ Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(console.error);
