const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tiffin_secret_key_99!';

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite Database
const db = new sqlite3.Database('./tiffin.db', (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to SQLite database.');
});

// Create Tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'customer'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    plan_price REAL DEFAULT 3000.0,
    status TEXT DEFAULT 'active',
    start_date TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pause_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER,
    pause_date TEXT,
    resume_date TEXT,
    days_paused INTEGER,
    FOREIGN KEY(subscription_id) REFERENCES subscriptions(id)
  )`);
});

// Middleware for JWT Authentication
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// --- REST APIS ---

// 1. User Registration
app.post('/api/register', async (req, res) => {
  const { name, phone, password, role } = req.body;
  if (!name || !phone || !password) return res.status(400).json({ error: 'All fields required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)`, 
      [name, phone, hashedPassword, role || 'customer'], function(err) {
      if (err) return res.status(400).json({ error: 'Phone number already registered' });
      
      const userId = this.lastID;
      db.run(`INSERT INTO subscriptions (user_id, plan_price, start_date) VALUES (?, 3000.0, DATE('now'))`, [userId]);
      res.status(201).json({ message: 'User registered successfully', userId });
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// 2. User Login
app.post('/api/login', (req, res) => {
  const { phone, password } = req.body;
  db.get(`SELECT * FROM users WHERE phone = ?`, [phone], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Invalid phone or password' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid phone or password' });

    const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
  });
});

// 3. Forgot / Reset Password
app.post('/api/forgot-password', (req, res) => {
  const { phone, newPassword } = req.body;
  if (!phone || !newPassword) return res.status(400).json({ error: 'Phone and new password are required' });

  db.get(`SELECT * FROM users WHERE phone = ?`, [phone], async (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Phone number not found' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.run(`UPDATE users SET password = ? WHERE phone = ?`, [hashedPassword, phone], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update password' });
      res.json({ message: 'Password reset successfully. You can now login.' });
    });
  });
});

// 4. Get Customers with Search, Pagination, Sorting & Pro-Rated Billing
app.get('/api/customers', authenticateToken, (req, res) => {
  const { search = '', status = '', page = 1, limit = 5, sortBy = 'name', order = 'ASC' } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT u.id, u.name, u.phone, s.id as sub_id, s.plan_price, s.status, s.start_date,
           COALESCE(SUM(p.days_paused), 0) as total_paused_days
    FROM users u
    JOIN subscriptions s ON u.id = s.user_id
    LEFT JOIN pause_logs p ON s.id = p.subscription_id
    WHERE u.role = 'customer' AND (u.name LIKE ? OR u.phone LIKE ?)
  `;
  const params = [`%${search}%`, `%${search}%`];

  if (status) {
    query += ` AND s.status = ?`;
    params.push(status);
  }

  query += ` GROUP BY u.id ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const workingDaysInMonth = 22;
    const processedRows = rows.map(row => {
      const dailyRate = row.plan_price / workingDaysInMonth;
      const activeDays = Math.max(0, workingDaysInMonth - row.total_paused_days);
      const proratedBill = Math.round(activeDays * dailyRate);
      return { ...row, activeDays, proratedBill };
    });

    db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'customer'`, (err, countRow) => {
      res.json({
        data: processedRows,
        currentPage: parseInt(page),
        totalPages: Math.ceil(countRow.count / limit)
      });
    });
  });
});

// 5. Toggle Subscription Pause/Resume
app.post('/api/subscription/toggle', authenticateToken, (req, res) => {
  const { subscriptionId, status, daysPaused = 1 } = req.body;
  
  db.run(`UPDATE subscriptions SET status = ? WHERE id = ?`, [status, subscriptionId], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    if (status === 'paused') {
      db.run(`INSERT INTO pause_logs (subscription_id, pause_date, days_paused) VALUES (?, DATE('now'), ?)`, [subscriptionId, daysPaused]);
    }
    res.json({ message: `Subscription status updated to ${status}` });
  });
});

app.listen(PORT, () => {
  console.log(`Tiffin Service server running on http://localhost:${PORT}`);
});