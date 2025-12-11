// index.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for security headers
app.use(helmet());
// Set Content Security Policy (adjust sources as needed)
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  next();
});

// Serve static files (like form.html) from 'public' folder
app.use(express.static('public'));

// Middleware to parse JSON and URL-encoded data
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Ensure the database table exists
async function ensureTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS mysql_table (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100),
      second_name VARCHAR(100),
      email VARCHAR(150),
      phone_number VARCHAR(20),
      eircode VARCHAR(20)
    )
  `;
  const conn = await pool.getConnection();
  try {
    await conn.query(createTableSQL);
  } finally {
    conn.release();
  }
}

// Validation functions
function isValidName(name) {
  return /^[a-zA-Z0-9]{1,20}$/.test(name);
}

function isValidEmail(email) {
  // simple email regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^\d{10}$/.test(phone);
}

function isValidEircode(eircode) {
  return /^[0-9][a-zA-Z0-9]{5}$/.test(eircode);
}

// Validate entire record (object with keys: first_name, second_name, email, phone_number, eircode)
function validateRecord(record) {
  if (
    !isValidName(record.first_name) ||
    !isValidName(record.second_name) ||
    !isValidEmail(record.email) ||
    !isValidPhone(record.phone_number) ||
    !isValidEircode(record.eircode)
  ) {
    return false;
  }
  return true;
}

// Insert a record into DB
async function insertRecord(record) {
  const conn = await pool.getConnection();
  try {
    const sql = `INSERT INTO mysql_table (first_name, second_name, email, phone_number, eircode)
                 VALUES (?, ?, ?, ?, ?)`;
    const values = [
      record.first_name,
      record.second_name,
      record.email,
      record.phone_number,
      record.eircode
    ];
    await conn.query(sql, values);
  } finally {
    conn.release();
  }
}

// Route: Import CSV and insert valid rows only
app.get('/import-csv', async (req, res) => {
  const results = [];
  const invalidRows = [];
  let rowNum = 1; // Starting from 1 for data rows (assuming header row in CSV)

  fs.createReadStream(path.join(__dirname, 'data.csv'))
    .pipe(csv())
    .on('data', (data) => {
      rowNum++;
      // Normalize keys to snake_case if needed
      const record = {
        first_name: data.first_name,
        second_name: data.second_name,
        email: data.email,
        phone_number: data.phone_number,
        eircode: data.eircode
      };

      if (validateRecord(record)) {
        results.push(record);
      } else {
        invalidRows.push(rowNum);
      }
    })
    .on('end', async () => {
      try {
        // Make sure table exists before inserting
        await ensureTable();

        // Insert valid records sequentially (could optimize with bulk insert if desired)
        for (const rec of results) {
          await insertRecord(rec);
        }

        const msg = `Imported ${results.length} valid record(s).`;
        const errorMsg = invalidRows.length > 0 ? ` Invalid rows: ${invalidRows.join(', ')}` : '';
        res.send(msg + errorMsg);
      } catch (err) {
        console.error('Error importing CSV:', err);
        res.status(500).send('Server error during CSV import.');
      }
    });
});

// Route: Handle form POST submission
app.post('/submit-form', async (req, res) => {
  const record = {
    first_name: req.body.first_name,
    second_name: req.body.second_name,
    email: req.body.email,
    phone_number: req.body.phone_number,
    eircode: req.body.eircode
  };

  if (!validateRecord(record)) {
    return res.status(400).send('Invalid data submitted.');
  }

  try {
    await ensureTable();
    await insertRecord(record);
    res.send('Data submitted successfully.');
  } catch (err) {
    console.error('Error inserting form data:', err);
    res.status(500).send('Server error.');
  }
});

// Middleware to check if server port is running (basic example)
app.use((req, res, next) => {
  if (!PORT) {
    res.status(500).send('Server port not configured.');
  } else {
    next();
  }
});

// Start the server
app.listen(PORT, async () => {
  try {
    await ensureTable();
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    console.error('Error creating table:', err);
  }
});
