// wrstudios-backend/config/database.js
import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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
    console.error('❌ MySQL Connection Error:', err.message);
    process.exit(1);
  }
  console.log('✅ MySQL Connected Successfully!');
  connection.release();
});

export default pool.promise();