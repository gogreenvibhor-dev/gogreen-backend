
import { db, pool } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("Starting manual migration...");
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "home_popups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "image_url" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "start_date" timestamp,
        "end_date" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

main();
