// index.js
require('dotenv').config();
const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const pool = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  next();
});

// Serve static files from 'public'
app.use(express.static('public'));

// Parse form data
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Ensure table exists
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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^\d{10}$/.test(phone);
}

function isValidEircode(eircode) {
  return /^[0-9][a-zA-Z0-9]{5}$/.test(eircode);
}

function validateRecord(record) {
  return (
    isValidName(record.first_name) &&
    isValidName(record.second_name) &&
    isValidEmail(record.email) &&
    isValidPhone(record.phone_number) &&
    isValidEircode(record.eircode)
  );
}

// Insert record helper
async function insertRecord(record) {
  const conn = await pool.getConnection();
  try {
    const sql = `INSERT INTO mysql_table (first_name, second_name, email, phone_number, eircode) VALUES (?, ?, ?, ?, ?)`;
    await conn.query(sql, [
      record.first_name,
      record.second_name,
      record.email,
      record.phone_number,
      record.eircode
    ]);
  } finally {
    conn.release();
  }
}

// CSV import route
app.get('/import-csv', (req, res) => {
  const results = [];
  const invalidRows = [];
  let rowNum = 1;

  fs.createReadStream(path.join(__dirname, 'data.csv'))
    .pipe(csv())
    .on('data', (data) => {
      rowNum++;
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
        await ensureTable();
        for (const rec of results) {
          await insertRecord(rec);
        }
        const msg = `Imported ${results.length} valid record(s).`;
        const errMsg = invalidRows.length > 0 ? ` Invalid rows: ${invalidRows.join(', ')}` : '';
        res.send(msg + errMsg);
      } catch (err) {
        console.error(err);
        res.status(500).send('Server error during CSV import.');
      }
    })
    .on('error', (err) => {
      console.error('CSV read error:', err);
      res.status(500).send('Error reading CSV file.');
    });
});

// Form submission route
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
    console.error('Insert error:', err);
    res.status(500).send('Server error.');
  }
});

// Middleware to check server port
app.use((req, res, next) => {
  if (!PORT) {
    res.status(500).send('Server port not configured.');
  } else {
    next();
  }
});

// Start server
app.listen(PORT, async () => {
  try {
    await ensureTable();
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    console.error('Error creating table:', err);
  }
});
