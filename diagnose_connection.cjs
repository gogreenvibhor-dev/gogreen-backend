require('dotenv').config({path: '.env.local'});
const net = require('net');
const {Client} = require('pg');
const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnosing RDS connection...\n');

// Parse connection string
const dbUrl = process.env.DATABASE_URL;
console.log('📌 DATABASE_URL:', dbUrl ? 'Found' : 'Missing');

if (!dbUrl) {
  console.log('❌ DATABASE_URL not set!');
  process.exit(1);
}

// Extract host and port
const match = dbUrl.match(/@([^:]+):(\d+)/);
if (!match) {
  console.log('❌ Could not parse DATABASE_URL');
  process.exit(1);
}

const host = match[1];
const port = parseInt(match[2]);

console.log(`\n1️⃣ Testing TCP connection to ${host}:${port}...`);

// Test raw TCP connection first
const socket = new net.Socket();
socket.setTimeout(5000);

socket.on('connect', () => {
  console.log('✅ TCP connection successful!');
  socket.destroy();
  testPostgresConnection();
});

socket.on('timeout', () => {
  console.log('❌ Connection timeout (5s)');
  console.log('\n🔧 Possible issues:');
  console.log('   • RDS security group blocks your IP');
  console.log('   • RDS is in a private subnet');
  console.log('   • "Publicly accessible" is set to No');
  console.log('   • Your network/firewall blocks outbound connections');
  socket.destroy();
  process.exit(1);
});

socket.on('error', (err) => {
  console.log('❌ Connection failed:', err.message);
  console.log('\n🔧 Possible issues:');
  console.log('   • RDS security group blocks your IP');
  console.log('   • RDS hostname is incorrect');
  console.log('   • RDS is in a private subnet (not publicly accessible)');
  process.exit(1);
});

socket.connect(port, host);

// Test actual PostgreSQL connection
async function testPostgresConnection() {
  console.log('\n2️⃣ Testing PostgreSQL connection with SSL certificate...');
  
  // Load AWS RDS certificate
  const certPath = path.join(__dirname, 'certs', 'global-bundle.pem');
  let sslConfig;
  
  try {
    const ca = fs.readFileSync(certPath, 'utf8');
    sslConfig = { ca, rejectUnauthorized: true };
    console.log('✅ Loaded AWS RDS certificate bundle');
  } catch (error) {
    console.log('⚠️  Certificate not found, using unverified SSL');
    sslConfig = { rejectUnauthorized: false };
  }
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: sslConfig,
    connectionTimeoutMillis: 5000
  });
  
  try {
    await client.connect();
    console.log('✅ PostgreSQL connection successful!');
    
    const result = await client.query('SELECT version()');
    console.log('✅ Database version:', result.rows[0].version.split(' ')[0]);
    
    // List tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`\n3️⃣ Found ${tables.rows.length} tables:`);
    tables.rows.forEach(row => console.log('   •', row.table_name));
    
    console.log('\n✅ All diagnostics passed!');
    await client.end();
  } catch (error) {
    console.log('❌ PostgreSQL connection failed:', error.message);
    console.log('\n🔧 Possible issues:');
    console.log('   • Wrong credentials (username/password)');
    console.log('   • Database name is incorrect');
    console.log('   • SSL/TLS configuration issue');
  }
}
