// Database adapter to handle both SQLite and PostgreSQL
class DatabaseAdapter {
  constructor(db) {
    this.db = db;
    this.isRDS = db && typeof db.query === 'function';
  }

  // Convert PostgreSQL parameters ($1, $2) to SQLite parameters (?, ?)
  convertParams(sql, params) {
    if (this.isRDS) {
      return { sql, params };
    } else {
      // Convert $1, $2, etc. to ?, ?, etc.
      const convertedSql = sql.replace(/\$(\d+)/g, '?');
      return { sql: convertedSql, params };
    }
  }

  // Execute a query with parameters
  query(sql, params = [], callback) {
    const { sql: convertedSql, params: convertedParams } = this.convertParams(sql, params);
    
    if (this.isRDS) {
      this.db.query(convertedSql, convertedParams, callback);
    } else {
      this.db.run(convertedSql, convertedParams, callback);
    }
  }

  // Get a single row
  get(sql, params = [], callback) {
    const { sql: convertedSql, params: convertedParams } = this.convertParams(sql, params);
    
    if (this.isRDS) {
      this.db.query(convertedSql, convertedParams, (err, result) => {
        if (err) {
          callback(err, null);
        } else {
          callback(null, result.rows[0] || null);
        }
      });
    } else {
      this.db.get(convertedSql, convertedParams, callback);
    }
  }

  // Get all rows
  all(sql, params = [], callback) {
    const { sql: convertedSql, params: convertedParams } = this.convertParams(sql, params);
    
    if (this.isRDS) {
      this.db.query(convertedSql, convertedParams, (err, result) => {
        if (err) {
          callback(err, null);
        } else {
          callback(null, result.rows);
        }
      });
    } else {
      this.db.all(convertedSql, convertedParams, callback);
    }
  }

  // Run a query (for INSERT, UPDATE, DELETE)
  run(sql, params = [], callback) {
    const { sql: convertedSql, params: convertedParams } = this.convertParams(sql, params);
    
    // Handle missing callback
    const safeCallback = callback || (() => {});
    
    if (this.isRDS) {
      this.db.query(convertedSql, convertedParams, (err, result) => {
        if (err) {
          safeCallback(err);
        } else {
          // PostgreSQL returns different structure
          safeCallback(null, { 
            lastID: result.insertId || result.rows[0]?.id,
            changes: result.rowCount || 0 
          });
        }
      });
    } else {
      this.db.run(convertedSql, convertedParams, function(err) {
        safeCallback(err, this);
      });
    }
  }
}

module.exports = DatabaseAdapter;
