const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  // Idle client errors shouldn't crash the process — log and keep serving.
  console.error('Unexpected database error on idle client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
