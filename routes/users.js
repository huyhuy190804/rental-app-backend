// wrstudios-backend/routes/users.js
import express from 'express';
import db from '../config/database.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users - Lấy tất cả users (chỉ admin)
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT user_id, name, email, status, role, phone, created_at FROM users');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/users/:id - Lấy thông tin 1 user
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      'SELECT user_id, name, email, status, role, phone, image_url, created_at FROM users WHERE user_id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/users/register - Đăng ký user mới
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    // Check email tồn tại
    const [existing] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    const user_id = `user_${Date.now()}`;
    
    // Trong thực tế cần hash password (dùng bcrypt)
    await db.query(
      `INSERT INTO users (user_id, name, email, phone, status, role, created_at) 
       VALUES (?, ?, ?, ?, 'active', 'member', NOW())`,
      [user_id, name, email, phone]
    );
    
    res.status(201).json({ success: true, user_id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/users/:id - Cập nhật thông tin user
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, image_url } = req.body;
    
    await db.query(
      'UPDATE users SET name = ?, phone = ?, image_url = ? WHERE user_id = ?',
      [name, phone, image_url, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/users/:id - Xóa user (chỉ admin)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM users WHERE user_id = ?', [id]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;