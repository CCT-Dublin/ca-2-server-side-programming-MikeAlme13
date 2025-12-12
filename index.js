// index.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { createTableIfNotExists, insertRecord } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for security headers
app.use(helmet());

// Middleware to parse JSON and URL encoded data
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Middleware to log incoming requests
app.use((req, res, next) => {
  console.log(`${req.method} request to ${req.url}`);
  next();
});

// Middleware to check if DB and table exist before requests that save data
app.use(async (req, res, next) => {
  try {
    await createTableIfNotExists();
    next();
  } catch (err) {
    console.error('DB/Table setup error:', err);
    res.status(500).send('Database error.');
  }
});

// Serve static files (form.html in public/)
app.use(express.static('public'));

// CSV validation function
function validateRecord(record) {
  const nameRegex = /^[a-zA-Z0-9]{1,20}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\d{10}$/;
  const eircodeRegex = /^[0-9][a-zA-Z0-9]{5}$/;

  if (!nameRegex.test(record.first_name)) return false;
  if (!nameRegex.test(record.second_name)) return false;
  if (!emailRegex.test(record.email)) return false;
  if (!phoneRegex.test(record.phone_number)) return false;
  if (!eircodeRegex.test(record.eircode)) return false;

  return true;
}

// Route to process CSV import
app.get('/import-csv', async (req, res) => {
  const results = [];
  const errors = [];

  const filePath = path.join(__dirname, 'data.csv'); // Absolute path to data.csv

  // Check if file exists before reading
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('CSV file data.csv not found in project folder.');
  }

  let rowNum = 2; // Start at 2 because CSV header is row 1
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('error', (err) => {
      console.error('CSV Read Error:', err.message);
      return res.status(500).send('Could not read CSV file.');
    })
    .on('data', (data) => {
      if (validateRecord(data)) {
        results.push(data);
      } else {
        errors.push(`Row ${rowNum} invalid`);
      }
      rowNum++;
    })
    .on('end', async () => {
      try {
        for (const record of results) {
          await insertRecord(record);
        }
        res.send(`Imported ${results.length} records. Errors: ${errors.join(', ') || 'None'}`);
      } catch (err) {
        console.error('DB Insert Error:', err);
        res.status(500).send('Error inserting records into database.');
      }
    });
});

// Route to accept form data submission (POST)
app.post('/submit-form', async (req, res) => {
  const data = req.body;

  if (!validateRecord(data)) {
    return res.status(400).send('Invalid data submitted.');
  }

  try {
    await insertRecord(data);
    res.send('Data submitted successfully.');
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).send('Server error while saving data.');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
