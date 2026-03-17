const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '..', 'database.db');
  }

  init() {
    // Create database directory if it doesn't exist
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database connection
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        return;
      }
      console.log('Connected to SQLite database');
      this.createTables();
    });
  }

  createTables() {
    // Create users table
    const usersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        wallet_balance REAL DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create products table
    const productsTable = `
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL, -- 'data', 'airtime', 'tv'
        network TEXT, -- 'mtn', 'airtel', 'glo', '9mobile'
        data_type TEXT, -- 'daily', 'weekly', 'monthly' for data
        amount REAL NOT NULL,
        price REAL NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create transactions table
    const transactionsTable = `
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        transaction_type TEXT NOT NULL, -- 'purchase', 'wallet_add', 'wallet_withdraw', 'airtime_to_cash'
        amount REAL NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
        reference_id TEXT,
        metadata TEXT, -- JSON string for additional data
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
      )
    `;

    // Create wallets table
    const walletsTable = `
      CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        balance REAL DEFAULT 0,
        total_deposited REAL DEFAULT 0,
        total_withdrawn REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `;

    // Create API configurations table
    const apiConfigsTable = `
      CREATE TABLE IF NOT EXISTS api_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_name TEXT NOT NULL,
        api_key TEXT NOT NULL,
        api_secret TEXT,
        base_url TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Execute table creation queries
    this.db.run(usersTable, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
      } else {
        console.log('Users table created successfully');
      }
    });

    this.db.run(productsTable, (err) => {
      if (err) {
        console.error('Error creating products table:', err);
      } else {
        console.log('Products table created successfully');
      }
    });

    this.db.run(transactionsTable, (err) => {
      if (err) {
        console.error('Error creating transactions table:', err);
      } else {
        console.log('Transactions table created successfully');
      }
    });

    this.db.run(walletsTable, (err) => {
      if (err) {
        console.error('Error creating wallets table:', err);
      } else {
        console.log('Wallets table created successfully');
      }
    });

    this.db.run(apiConfigsTable, (err) => {
      if (err) {
        console.error('Error creating api_configs table:', err);
      } else {
        console.log('API configs table created successfully');
      }
    });

    // Insert default admin user if not exists
    this.insertDefaultAdmin();
    
    // Insert default products if not exists
    this.insertDefaultProducts();
  }

  insertDefaultAdmin() {
    const insertAdmin = `
      INSERT OR IGNORE INTO users (username, email, password, full_name, phone, is_admin, is_verified)
      VALUES (?, ?, ?, ?, ?, 1, 1)
    `;
    
    const bcrypt = require('bcryptjs');
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    
    this.db.run(insertAdmin, ['admin', 'admin@example.com', defaultPassword, 'Administrator', '08000000000'], (err) => {
      if (err) {
        console.error('Error inserting default admin:', err);
      } else {
        console.log('Default admin user created (username: admin, password: admin123)');
      }
    });
  }

  insertDefaultProducts() {
    const products = [
      // MTN Data Bundles
      ['MTN 100MB Daily', 'data', 'mtn', 'daily', 100, 200, 1],
      ['MTN 350MB Weekly', 'data', 'mtn', 'weekly', 350, 500, 1],
      ['MTN 1.5GB Monthly', 'data', 'mtn', 'monthly', 1536, 1200, 1],
      ['MTN 3.5GB Monthly', 'data', 'mtn', 'monthly', 3584, 2500, 1],
      
      // Airtel Data Bundles
      ['Airtel 100MB Daily', 'data', 'airtel', 'daily', 100, 180, 1],
      ['Airtel 350MB Weekly', 'data', 'airtel', 'weekly', 350, 480, 1],
      ['Airtel 1.2GB Monthly', 'data', 'airtel', 'monthly', 1228, 1100, 1],
      ['Airtel 3GB Monthly', 'data', 'airtel', 'monthly', 3072, 2300, 1],
      
      // Glo Data Bundles
      ['Glo 100MB Daily', 'data', 'glo', 'daily', 100, 150, 1],
      ['Glo 350MB Weekly', 'data', 'glo', 'weekly', 350, 400, 1],
      ['Glo 1GB Monthly', 'data', 'glo', 'monthly', 1024, 900, 1],
      ['Glo 2.5GB Monthly', 'data', 'glo', 'monthly', 2560, 1800, 1],
      
      // 9mobile Data Bundles
      ['9mobile 100MB Daily', 'data', '9mobile', 'daily', 100, 160, 1],
      ['9mobile 350MB Weekly', 'data', '9mobile', 'weekly', 350, 420, 1],
      ['9mobile 1GB Monthly', 'data', '9mobile', 'monthly', 1024, 950, 1],
      ['9mobile 2GB Monthly', 'data', '9mobile', 'monthly', 2048, 1700, 1],
      
      // TV Subscriptions
      ['DSTV Compact', 'tv', null, null, 0, 5000, 1],
      ['DSTV Premium', 'tv', null, null, 0, 12000, 1],
      ['GOTV Max', 'tv', null, null, 0, 3000, 1],
      ['Startimes Nova', 'tv', null, null, 0, 2000, 1],
    ];

    const insertProduct = `
      INSERT OR IGNORE INTO products (name, category, network, data_type, amount, price, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    products.forEach(product => {
      this.db.run(insertProduct, product, (err) => {
        if (err) {
          console.error('Error inserting default product:', err);
        }
      });
    });

    console.log('Default products inserted successfully');
  }

  // Database query methods
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = new Database();