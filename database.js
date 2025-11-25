// database.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * Ensure the table exists. Run this once at start (or call manually).
 */
async function createTableIfNotExists() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS mysql_table (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(50),
      second_name VARCHAR(50),
      email VARCHAR(255),
      phone_number VARCHAR(20),
      eircode VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(createTableSQL);
}

/**
 * Insert one record object
 * record should contain keys: first_name, second_name, email, phone_number, eircode
 */
async function insertRecord(record) {
  const { first_name, second_name, email, phone_number, eircode } = record;
  const insertSQL = `
    INSERT INTO mysql_table (first_name, second_name, email, phone_number, eircode)
    VALUES (?, ?, ?, ?, ?);
  `;
  const [result] = await pool.query(insertSQL, [first_name || null, second_name || null, email || null, phone_number || null, eircode || null]);
  return result.insertId;
}

/**
 * Optional: simple fetch to verify contents
 */
async function getAllRecords(limit = 100) {
  const [rows] = await pool.query('SELECT * FROM mysql_table ORDER BY id DESC LIMIT ?', [Number(limit)]);
  return rows;
}

module.exports = {
  pool,
  createTableIfNotExists,
  insertRecord,
  getAllRecords
};
