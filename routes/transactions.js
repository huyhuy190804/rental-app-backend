// wrstudios-backend/routes/transactions.js
import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Tạo table transactions (chạy 1 lần duy nhất)
const createTransactionsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(50) NOT NULL,
        userAccount VARCHAR(255) NOT NULL,
        method VARCHAR(50) NOT NULL,
        planName VARCHAR(100) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'VND',
        content TEXT,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Transactions table ready');
  } catch (error) {
    console.error('❌ Error creating transactions table:', error.message);
  }
};

// Chạy khi server start
createTransactionsTable();

// GET /api/transactions - Lấy tất cả giao dịch
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM transactions ORDER BY date DESC'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/transactions - Tạo giao dịch mới
router.post('/', async (req, res) => {
  try {
    const { userId, userAccount, method, planName, amount, currency, content } = req.body;
    
    const id = `TRX${Date.now()}`;
    
    await db.query(
      `INSERT INTO transactions (id, userId, userAccount, method, planName, amount, currency, content, status, date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [id, userId, userAccount, method, planName, amount, currency, content]
    );
    
    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/transactions/:id - Duyệt/Từ chối
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "approved" or "rejected"
    
    // Update transaction status
    await db.query(
      'UPDATE transactions SET status = ? WHERE id = ?',
      [status, id]
    );
    
    // Nếu approved → Tạo membership_user
    if (status === 'approved') {
      const [transaction] = await db.query(
        'SELECT userId, planName FROM transactions WHERE id = ?',
        [id]
      );
      
      if (transaction.length > 0) {
        const { userId, planName } = transaction[0];
        
        // Lấy thông tin gói
        const [plan] = await db.query(
          'SELECT ms_id, duration FROM membership_packages WHERE name = ?',
          [planName]
        );
        
        if (plan.length > 0) {
          const { ms_id, duration } = plan[0];
          const member_user_id = `mu_${Date.now()}`;
          const start_at = new Date();
          const end_at = new Date();
          end_at.setDate(end_at.getDate() + duration);
          
          // Insert vào membership_user
          await db.query(
            `INSERT INTO membership_user (member_user_id, start_at, end_at, status, user_id, ms_id) 
             VALUES (?, ?, ?, 'active', ?, ?)`,
            [member_user_id, start_at, end_at, userId, ms_id]
          );
        }
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;