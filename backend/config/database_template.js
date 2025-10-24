// database.example.js - TEAMMATES COPY THIS AND FILL THEIR OWN INFO
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'zoneconquer',
  user: 'YOUR_USERNAME_HERE',      // ← Teammates change this
  password: 'YOUR_PASSWORD_HERE',  // ← Teammates change this
  ssl: false
});

module.exports = pool;