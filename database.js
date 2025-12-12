require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

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
  await pool.query(createTableSQL);
}

async function insertRecord(record) {
  const { first_name, second_name, email, phone_number, eircode } = record;
  const insertSQL = `
    INSERT INTO mysql_table (first_name, second_name, email, phone_number, eircode)
    VALUES (?, ?, ?, ?, ?);
  `;
  await pool.query(insertSQL, [first_name, second_name, email, phone_number, eircode]);
}

module.exports = {
  pool,
  createTableIfNotExists,
  insertRecord
};
