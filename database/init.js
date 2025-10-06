const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { initRDSDatabase, getRDSDatabase, isRDSConfigured } = require('./rds');
const DatabaseAdapter = require('./adapter');

const DB_PATH = path.join(__dirname, 'app.db');

let db;
let rdsPool;

function initDatabase() {
  // Try to initialize RDS first
  rdsPool = initRDSDatabase();
  
  if (rdsPool) {
    console.log('Using RDS PostgreSQL database');
    return;
  }
  
  // Fallback to SQLite for development
  console.log('RDS not available, using SQLite database');
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err);
      return;
    }
    console.log('Connected to SQLite database');
    createTables();
  });
}

function createTables() {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createJobsTable = `
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      output_format TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      transcoded_path TEXT,
      file_size INTEGER,
      duration REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `;

  db.run(createUsersTable, (err) => {
    if (err) console.error('Error creating users table:', err);
  });

  db.run(createJobsTable, (err) => {
    if (err) console.error('Error creating jobs table:', err);
    else insertDefaultUsers();
  });
}

function insertDefaultUsers() {
  const bcrypt = require('bcryptjs');
  
  const users = [
    { username: 'admin', password: 'admin123' },
    { username: 'user1', password: 'user123' },
    { username: 'user2', password: 'user456' }
  ];

  users.forEach(user => {
    const hashedPassword = bcrypt.hashSync(user.password, 10);
    db.run('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)', 
      [user.username, hashedPassword]);
  });
}

function getDatabase() {
  // Return RDS pool if available, otherwise SQLite
  const rawDb = isRDSConfigured() ? getRDSDatabase() : db;
  return new DatabaseAdapter(rawDb);
}

module.exports = { initDatabase, getDatabase };