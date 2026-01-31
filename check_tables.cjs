require('dotenv').config({path: '.env.local'});
const {Client} = require('pg');

async function checkTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {rejectUnauthorized: false}
  });
  
  try {
    await client.connect();
    console.log('✓ Connected to RDS');
    
    // Check tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables in database:');
    tablesResult.rows.forEach(row => console.log('  -', row.table_name));
    
    // Check if global_settings exists and has data
    if (tablesResult.rows.some(r => r.table_name === 'global_settings')) {
      const settingsCount = await client.query('SELECT COUNT(*) FROM global_settings');
      console.log(`\n⚙️  global_settings records: ${settingsCount.rows[0].count}`);
    }
    
    // Check if categories exists and has data
    if (tablesResult.rows.some(r => r.table_name === 'categories')) {
      const categoriesCount = await client.query('SELECT COUNT(*) FROM categories');
      console.log(`📁 categories records: ${categoriesCount.rows[0].count}`);
    }
    
    // Check if users exist
    if (tablesResult.rows.some(r => r.table_name === 'users')) {
      const usersCount = await client.query('SELECT COUNT(*) FROM users');
      console.log(`👥 users records: ${usersCount.rows[0].count}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTables();
