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

// GET /api/users/:id/membership - Get user membership status and post count
router.get('/:id/membership', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    // Only allow user to check their own membership or admin
    if (userId !== id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Get active membership
    const [memberships] = await db.query(`
      SELECT mu.*, mp.name as package_name, mp.post_limit, mp.duration, mp.price
      FROM membership_user mu
      JOIN membership_packages mp ON mu.ms_id = mp.ms_id
      WHERE mu.user_id = ? AND mu.status = 'active' AND mu.end_at > NOW()
      ORDER BY mu.end_at DESC
      LIMIT 1
    `, [id]);

    // Check if membership was renewed in current month
    let canRenew = true;
    if (memberships.length > 0) {
      const membership = memberships[0];
      const startDate = new Date(membership.start_at);
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // If membership started in current month, cannot renew yet
      if (startDate >= startOfCurrentMonth) {
        canRenew = false;
      }
    }

    // Get post count for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [postCount] = await db.query(`
      SELECT COUNT(*) as count
      FROM posts
      WHERE user_id = ? AND created_at >= ?
    `, [id, startOfMonth]);

    const currentPostCount = postCount[0]?.count || 0;
    const membership = memberships.length > 0 ? memberships[0] : null;

    res.json({
      success: true,
      data: {
        hasActiveMembership: !!membership,
        membership: membership ? {
          package_name: membership.package_name,
          post_limit: membership.post_limit,
          start_at: membership.start_at,
          end_at: membership.end_at,
          daysRemaining: membership.end_at ? Math.ceil((new Date(membership.end_at) - now) / (1000 * 60 * 60 * 24)) : 0
        } : null,
        currentPostCount,
        canCreatePost: membership ? currentPostCount < membership.post_limit : false,
        canRenew: canRenew // ✅ Can only renew when new month starts
      }
    });
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

// PUT /api/users/:id/profile - Cập nhật profile (bao gồm cả password)
router.put('/:id/profile', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    // Chỉ cho phép user update chính profile của mình
    if (userId !== id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { name, email, phone, currentPassword, newPassword } = req.body;

    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng điền đầy đủ thông tin!' 
      });
    }

    // Lấy thông tin user hiện tại
    const [users] = await db.query('SELECT * FROM users WHERE user_id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = users[0];

    // Nếu đổi password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu mới!' 
        });
      }
      
      // Kiểm tra mật khẩu hiện tại
      if (currentPassword !== user.password) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mật khẩu hiện tại không đúng!' 
        });
      }

      // Update với password mới
      await db.query(
        'UPDATE users SET name = ?, email = ?, phone = ?, password = ? WHERE user_id = ?',
        [name, email, phone, newPassword, id]
      );
    } else {
      // Update không có password
      await db.query(
        'UPDATE users SET name = ?, email = ?, phone = ? WHERE user_id = ?',
        [name, email, phone, id]
      );
    }

    // Lấy thông tin user đã update
    const [updatedUsers] = await db.query(
      'SELECT user_id, name, email, phone, role, status, image_url FROM users WHERE user_id = ?',
      [id]
    );

    res.json({ 
      success: true, 
      message: 'Cập nhật thông tin thành công!',
      user: updatedUsers[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/users/:id/password - Lấy password của user (chỉ chính user đó)
router.get('/:id/password', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    // Only allow user to get their own password
    if (userId !== id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const [rows] = await db.query(
      'SELECT password FROM users WHERE user_id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, password: rows[0].password });
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