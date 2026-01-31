import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Get database URL
const dbUrl = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'khush'}:${process.env.DB_PASSWORD || 'khush123'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'gogreen'}`;

// Determine if SSL is needed (for RDS or any remote database with SSL in connection string)
const needsSSL = dbUrl.includes('rds.amazonaws.com') || dbUrl.includes('sslmode=require') || dbUrl.includes('sslmode=no-verify');

console.log('🔌 Database connection config:');
console.log('  - URL contains RDS:', dbUrl.includes('rds.amazonaws.com'));
console.log('  - SSL enabled:', needsSSL);
console.log('  - Host:', dbUrl.match(/@([^:\/]+)/)?.[1] || 'unknown');

// SSL configuration for RDS
// Using rejectUnauthorized: false for development
// TODO: Switch to CA bundle verification before production deployment
let sslConfig = needsSSL ? { rejectUnauthorized: false } : undefined;

if (needsSSL) {
  console.log('  - SSL mode: rejectUnauthorized=false (DEV ONLY)');
}

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: dbUrl,
  ssl: sslConfig,
});

// Create Drizzle instance
export const db = drizzle(pool, { schema });

// Export pool for raw queries if needed
export { pool };
