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

const db = new sqlite3.Database('./tiffin.db', (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to SQLite database.');
});

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

  db.run(`CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week TEXT UNIQUE,
    title TEXT,
    items TEXT,
    image_url TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    rating INTEGER,
    comment TEXT,
    created_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS outbox_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT,
    clock_date TEXT,
    status TEXT DEFAULT 'pending'
  )`);

  // Seed default weekly menus if empty
  db.get(`SELECT COUNT(*) as count FROM menus`, (err, row) => {
    if (row && row.count === 0) {
      const defaultMenus = [
        ['Monday', 'Shahi Paneer Thali', 'Shahi Paneer, Dal Tadka, 4 Phulkas, Jeera Rice, Salad', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80'],
        ['Tuesday', 'Aloo Gobi Special', 'Aloo Gobi Adraki, Dal Makhani, Tawa Roti, Steamed Rice, Raita', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80'],
        ['Wednesday', 'Rajma Chawal Bowl', 'Homestyle Rajma, Jeera Rice, Laccha Paratha, Boondi Raita, Pickle', 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80'],
        ['Thursday', 'Kahi Kofta Thali', 'Malai Kofta, Yellow Dal Fry, Butter Naan, Pulao, Gulab Jamun', 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=800&q=80'],
        ['Friday', 'Executive Weekend Thali', 'Paneer Lababdar, Dal Fry, Stuffed Kulcha, Veg Biryani, Rasgulla', 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80']
      ];
      defaultMenus.forEach(m => {
        db.run(`INSERT INTO menus (day_of_week, title, items, image_url) VALUES (?, ?, ?, ?)`, m);
      });
    }
  });
});

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

// 1. Register
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

// 2. Login
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

// 3. Analytics & Average Rating
app.get('/api/analytics', authenticateToken, (req, res) => {
  db.get(`
    SELECT 
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeCount,
      SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as pausedCount,
      COUNT(*) as totalCount,
      SUM(plan_price) as totalPotentialRevenue
    FROM subscriptions
  `, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get(`SELECT AVG(rating) as avgRating, COUNT(*) as totalReviews FROM feedbacks`, (err2, feedbackRow) => {
      res.json({ ...row, avgRating: feedbackRow?.avgRating ? feedbackRow.avgRating.toFixed(1) : '5.0', totalReviews: feedbackRow?.totalReviews || 0 });
    });
  });
});

// 4. Weekly Menus API
app.get('/api/menus', (req, res) => {
  db.all(`SELECT * FROM menus`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/menu', authenticateToken, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Unauthorized' });
  const { day_of_week, title, items, image_url } = req.body;

  db.run(`INSERT OR REPLACE INTO menus (day_of_week, title, items, image_url) VALUES (?, ?, ?, ?)`, 
    [day_of_week, title, items, image_url || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80'], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Menu updated successfully' });
  });
});

// 5. Customers & Pro-Rated Billing
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

// 6. Toggle Subscription Pause/Resume
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

// --- LEVEL 1 TWIST: Clock & Notification Outbox ---
app.post('/api/clock', authenticateToken, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Unauthorized' });
  const clockDate = req.body.date || new Date().toISOString().split('T')[0];

  db.all(`
    SELECT u.id as user_id, u.name, u.phone 
    FROM users u 
    JOIN subscriptions s ON u.id = s.user_id 
    WHERE u.role = 'customer' AND s.status = 'active'
  `, (err, customers) => {
    if (err) return res.status(500).json({ error: err.message });

    let notifiedCount = 0;
    customers.forEach(cust => {
      const msg = `Hello ${cust.name}, your hot home tiffin is scheduled for delivery today!`;
      db.run(`INSERT INTO outbox_notifications (user_id, message, clock_date, status) VALUES (?, ?, ?, 'sent')`, [cust.user_id, msg, clockDate]);
      notifiedCount++;
    });

    res.json({ message: `Clock advanced for ${clockDate}`, notificationsSent: notifiedCount });
  });
});

app.get('/api/outbox', authenticateToken, (req, res) => {
  db.all(`SELECT * FROM outbox_notifications ORDER BY id DESC LIMIT 20`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- LEVEL 2 TWIST: Lifecycle Subscription Transfer Mid-Cycle ---
app.post('/api/subscription/transfer', authenticateToken, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Unauthorized' });
  const { oldSubscriptionId, newCustomerName, newCustomerPhone, newPassword } = req.body;

  db.get(`SELECT * FROM subscriptions WHERE id = ?`, [oldSubscriptionId], async (err, sub) => {
    if (err || !sub) return res.status(404).json({ error: 'Original subscription not found' });

    const hashedPassword = await bcrypt.hash(newPassword || 'password123', 10);
    db.run(`INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, 'customer')`, 
      [newCustomerName, newCustomerPhone, hashedPassword], function(err2) {
      if (err2) return res.status(400).json({ error: 'New customer phone already exists' });
      
      const newUserId = this.lastID;
      // Carry over plan and cycle status to new customer
      db.run(`UPDATE subscriptions SET user_id = ? WHERE id = ?`, [newUserId, oldSubscriptionId], (err3) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ message: `Subscription successfully transferred to ${newCustomerName} mid-cycle!`, newUserId });
      });
    });
  });
});

// --- LEVEL 3 TWIST: Messy Data Importer ---
app.post('/api/import/customers', authenticateToken, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Unauthorized' });
  const { rawData } = req.body; // Expects array of objects or newline string
  
  if (!Array.isArray(rawData)) return res.status(400).json({ error: 'rawData must be an array' });

  let imported = 0;
  let deduped = 0;
  let rejected = 0;
  const seenPhones = new Set();

  db.all(`SELECT phone FROM users`, async (err, existingUsers) => {
    if (err) return res.status(500).json({ error: err.message });
    existingUsers.forEach(u => seenPhones.add(u.phone));

    for (const item of rawData) {
      const name = item.name ? item.name.trim() : '';
      const phone = item.phone ? String(item.phone).trim() : '';

      if (!name || !phone || phone.length < 8) {
        rejected++;
        continue;
      }

      if (seenPhones.has(phone)) {
        deduped++;
        continue;
      }

      seenPhones.add(phone);
      const defaultPass = await bcrypt.hash('import123', 10);
      
      await new Promise((resolve) => {
        db.run(`INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, 'customer')`, [name, phone, defaultPass], function(err2) {
          if (err2) {
            rejected++;
          } else {
            const newId = this.lastID;
            db.run(`INSERT INTO subscriptions (user_id, plan_price, start_date) VALUES (?, 3000.0, DATE('now'))`, [newId]);
            imported++;
          }
          resolve();
        });
      });
    }

    res.json({
      report: {
        imported,
        deduped,
        rejected,
        totalProcessed: rawData.length
      }
    });
  });
});

// Feedbacks
app.post('/api/feedback', authenticateToken, (req, res) => {
  const { rating, comment } = req.body;
  if (!rating) return res.status(400).json({ error: 'Rating is required' });

  db.run(`INSERT INTO feedbacks (user_id, rating, comment, created_at) VALUES (?, ?, ?, DATE('now'))`, 
    [req.user.id, rating, comment || ''], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Feedback submitted successfully. Thank you!' });
  });
});

app.get('/api/feedbacks', authenticateToken, (req, res) => {
  db.all(`
    SELECT f.id, f.rating, f.comment, f.created_at, u.name 
    FROM feedbacks f 
    JOIN users u ON f.user_id = u.id 
    ORDER BY f.id DESC LIMIT 10
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Enterprise Advanced Server running on http://localhost:${PORT}`);
});
