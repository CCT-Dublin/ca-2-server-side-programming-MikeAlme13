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

app.use(helmet());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static('public'));

// Log each request
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Ensure table exists before handling requests that insert data
app.use(async (req, res, next) => {
  try {
    await createTableIfNotExists();
    next();
  } catch (err) {
    console.error('DB/Table setup error:', err);
    res.status(500).send('Database error.');
  }
});

// Validation function
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

// Route to import CSV (GET)
app.get('/import-csv', async (req, res) => {
  const results = [];
  const errors = [];

  let rowNum = 1;
  fs.createReadStream(path.join(__dirname, 'data.csv'))
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
        res.send(`Imported ${results.length} records.<br>Errors: ${errors.join(', ') || 'None'}`);
      } catch (err) {
        console.error(err);
        res.status(500).send('Error inserting records.');
      }
    })
    .on('error', (err) => {
      console.error('CSV read error:', err);
      res.status(500).send('Error reading CSV file.');
    });
});

// Route to accept form POST submission
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
