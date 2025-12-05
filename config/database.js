// wrstudios-backend/config/database.js
import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

// Parse DATABASE_URL or use individual environment variables
let dbConfig = {};

if (process.env.DATABASE_URL) {
  // Parse DATABASE_URL format: mysql://user:password@host:port/database
  try {
    const url = new URL(process.env.DATABASE_URL);
    
    dbConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password), // Decode URL encoded password
      database: url.pathname.slice(1) // Remove leading '/'
    };
    
    console.log('📊 Using DATABASE_URL for connection');
  } catch (error) {
    console.error('❌ Error parsing DATABASE_URL:', error.message);
    console.error('⚠️ Falling back to individual environment variables');
    // Fallback to individual variables
    dbConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    };
  }
} else {
  // Use individual environment variables
  dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  };
  console.log('📊 Using individual environment variables for connection');
}

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Increase GROUP_CONCAT limit for each connection
pool.on('connection', (connection) => {
  connection.query('SET SESSION group_concat_max_len = 10485760', (err) => {
    if (err) {
      console.error('Failed to set GROUP_CONCAT limit:', err);
    }
  });
});

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('\n❌ MySQL Connection Error:', err.message);
    console.error('\n📊 Connection Details:');
    console.error(`   Host: ${dbConfig.host}`);
    console.error(`   Port: ${dbConfig.port}`);
    console.error(`   User: ${dbConfig.user}`);
    console.error(`   Database: ${dbConfig.database || 'NOT SET'}`);
    console.error(`   Password: ${dbConfig.password ? '***SET***' : '(empty)'}`);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Verify MySQL service is running');
    console.error('   2. Check DATABASE_URL format: mysql://user:password@host:port/database');
    console.error('   3. Ensure database exists');
    console.error('   4. Verify user permissions\n');
    process.exit(1);
  }
  console.log('✅ MySQL Connected Successfully!');
  console.log(`   Database: ${dbConfig.database}`);
  connection.release();
});

export default pool.promise();