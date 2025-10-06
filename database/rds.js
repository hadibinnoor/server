const { Pool } = require('pg');

let pool;

function initRDSDatabase() {
  // RDS configuration from environment variables
  const config = {
    host: process.env.RDS_HOSTNAME,
    port: process.env.RDS_PORT || 5432,
    database: process.env.RDS_DB_NAME,
    user: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    ssl: process.env.RDS_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  };

  // Check if RDS is configured
  if (!config.host || !config.database || !config.user || !config.password) {
    console.log('RDS not configured - falling back to SQLite for development');
    return null;
  }

  try {
    pool = new Pool(config);
    
    // Test the connection
    pool.query('SELECT NOW()', (err, result) => {
      if (err) {
        console.error('RDS connection test failed:', err);
        pool = null;
        return;
      }
      console.log('Connected to RDS PostgreSQL database');
      console.log('Database time:', result.rows[0].now);
      
      // Create tables if they don't exist
      createTables();
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    return pool;
  } catch (error) {
    console.error('Failed to initialize RDS connection:', error);
    return null;
  }
}

function createTables() {
  if (!pool) return;

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createJobsTable = `
    CREATE TABLE IF NOT EXISTS jobs (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      file_path TEXT NOT NULL,
      output_format VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      transcoded_path TEXT,
      file_size BIGINT,
      duration REAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  pool.query(createUsersTable, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      console.log('Users table ready');
    }
  });

  pool.query(createJobsTable, async (err) => {
    if (err) {
      console.error('Error creating jobs table:', err);
    } else {
      console.log('Jobs table ready');
      // Attempt to align schema if an older schema exists (best-effort)
      try {
        await pool.query("ALTER TABLE jobs ALTER COLUMN user_id TYPE VARCHAR(255)");
      } catch (e) {
        // ignore if already correct
      }
      try {
        await pool.query("ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_user_id_fkey");
      } catch (e) {
        // ignore if constraint not present
      }
      insertDefaultUsers();
    }
  });
}

function insertDefaultUsers() {
  if (!pool) return;

  const bcrypt = require('bcryptjs');
  
  const users = [
    { username: 'admin', password: 'admin123' },
    { username: 'user1', password: 'user123' },
    { username: 'user2', password: 'user456' }
  ];

  users.forEach(user => {
    const hashedPassword = bcrypt.hashSync(user.password, 10);
    pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
      [user.username, hashedPassword],
      (err) => {
        if (err) {
          console.error('Error inserting user:', err);
        }
      }
    );
  });
}

function getRDSDatabase() {
  return pool;
}

function isRDSConfigured() {
  return pool !== null;
}

module.exports = { 
  initRDSDatabase, 
  getRDSDatabase, 
  isRDSConfigured 
};
