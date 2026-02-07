
import { db, pool } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function diagnose() {
  console.log("--- DIAGNOSTIC START ---");
  try {
    // 1. Check if table exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'home_popups'
      );
    `);
    console.log("Table 'home_popups' exists:", tableCheck.rows[0]);

    // 2. Count rows
    if (tableCheck.rows[0].exists) {
        const count = await db.execute(sql`SELECT count(*) FROM home_popups`);
        console.log("Row count in 'home_popups':", count.rows[0]);
        
        // 3. Check active popups
        const rows = await db.execute(sql`SELECT * FROM home_popups`);
        console.log("Rows:", rows.rows);
    } else {
        console.log("CRITICAL: Table 'home_popups' DOES NOT EXIST.");
        
        // Attempt to create it right now
        console.log("Attempting to create table...");
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
        console.log("Table created successfully.");
    }

  } catch (err) {
    console.error("Diagnostic failed:", err);
  } finally {
    await pool.end();
    console.log("--- DIAGNOSTIC END ---");
  }
}

diagnose();
