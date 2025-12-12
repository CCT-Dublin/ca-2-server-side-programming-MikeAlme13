// database.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'assignment_db',
  waitForConnections: true,
  connectionLimit: 10,
});

async function ensureSchema() {
  const createDBSQL = `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`;
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS mysql_table (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(50),
      second_name VARCHAR(50),
      email VARCHAR(255),
      phone VARCHAR(20),
      eircode VARCHAR(10),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  // Ensure DB exists (connect to server first)
  const tmpPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    waitForConnections: true,
    connectionLimit: 1,
  });
  const conn = await tmpPool.getConnection();
  try {
    await conn.query(createDBSQL);
  } finally {
    conn.release();
    await tmpPool.end();
  }

  // Now ensure table exists (connect to specific DB)
  const conn2 = await pool.getConnection();
  try {
    await conn2.query(createTableSQL);
  } finally {
    conn2.release();
  }
}

module.exports = { pool, ensureSchema };
