const { Pool } = require('pg');

// Connect to Neon Cloud db (now everyone can use)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.log('❌ Neon database connection failed:', err.message);
  } else {
    console.log('✅ Connected to Neon PostgreSQL at:', res.rows[0].now);
  }
});

// Temp debug code
console.log('🔗 Database connecting to:', process.env.DATABASE_URL);

module.exports = pool;
