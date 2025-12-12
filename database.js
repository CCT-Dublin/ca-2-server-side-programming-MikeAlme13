// database.js
require('dotenv').config();
const mysql = require('mysql2/promise');

// Create a connection pool to your MySQL database
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'company_db',  // Use company_db or .env value
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Function to create table if it doesn't exist
async function createTableIfNotExists() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS mysql_table (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(20),
      second_name VARCHAR(20),
      email VARCHAR(255),
      phone_number VARCHAR(10),
      eircode VARCHAR(6)
    );
  `;
  const conn = await pool.getConnection();
  try {
    await conn.query(createTableSQL);
  } finally {
    conn.release();
  }
}

// Function to insert a single record into the table
async function insertRecord(record) {
  const { first_name, second_name, email, phone_number, eircode } = record;
  const insertSQL = `
    INSERT INTO mysql_table (first_name, second_name, email, phone_number, eircode)
    VALUES (?, ?, ?, ?, ?);
  `;
  const conn = await pool.getConnection();
  try {
    await conn.query(insertSQL, [first_name, second_name, email, phone_number, eircode]);
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,
  createTableIfNotExists,
  insertRecord,
};
