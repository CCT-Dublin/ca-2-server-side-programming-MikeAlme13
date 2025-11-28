// index.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const csv = require('csv-parser');
const fs = require('fs');
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

// Serve static files (form.html)
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

// Route to process CSV upload (assuming CSV file is in project root, e.g., data.csv)
app.get('/import-csv', async (req, res) => {
  const results = [];
  const errors = [];

  let rowNum = 1;
  fs.createReadStream('data.csv')
    .pipe(csv())
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
        res.send(`Imported ${results.length} records. Errors: ${errors.join(', ')}`);
      } catch (err) {
        console.error(err);
        res.status(500).send('Error inserting records');
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
    console.error(err);
    res.status(500).send('Server error while saving data.');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
