// wrstudios-backend/routes/auth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'change-me';

// POST /api/auth/register - Đăng ký với kiểm tra dữ liệu unique
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validate
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng điền đầy đủ thông tin' 
      });
    }

    // Check for duplicate name (username)
    const [existingName] = await db.query(
      'SELECT user_id FROM users WHERE name = ?', 
      [name]
    );
    if (existingName.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên tài khoản này đã được sử dụng' 
      });
    }

    // Check for duplicate email
    const [existingEmail] = await db.query(
      'SELECT user_id FROM users WHERE email = ?', 
      [email]
    );
    if (existingEmail.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email này đã được sử dụng' 
      });
    }

    // Check for duplicate phone
    const [existingPhone] = await db.query(
      'SELECT user_id FROM users WHERE phone = ?', 
      [phone]
    );
    if (existingPhone.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Số điện thoại này đã được sử dụng' 
      });
    }

    const user_id = `user_${Date.now()}`;

    // TODO: Hash password with bcrypt in production
    await db.query(
      `INSERT INTO users (user_id, name, email, phone, password, status, role, created_at) 
       VALUES (?, ?, ?, ?, ?, 'active', 'member', NOW())`,
      [user_id, name, email, phone, password]
    );

    // Create token
    const token = jwt.sign(
      { user_id, email, name, role: 'member' },
      SECRET_KEY,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công!',
      token,
      user: {
        user_id,
        name,
        email,
        phone,
        role: 'member',
        status: 'active'
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
});

// POST /api/auth/login - Đăng nhập bằng username HOẶC email
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body; // Frontend gửi field tên "email"

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email/Username và mật khẩu là bắt buộc' 
      });
    }

    // Tìm user bằng email HOẶC name (username)
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? OR name = ?',
      [email, email] // Dùng input cho cả 2 trường hợp
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác' 
      });
    }

    const user = users[0];

    // TODO: So sánh password hash với bcrypt
    // const isValidPassword = await bcrypt.compare(password, user.password);
    const isValidPassword = (password === user.password);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác' 
      });
    }

    // Kiểm tra tài khoản có bị khóa không
    if (user.status !== 'active') {
      return res.status(403).json({ 
        success: false, 
        message: 'Tài khoản đã bị vô hiệu hóa' 
      });
    }

    // Create token
    const token = jwt.sign(
      { 
        user_id: user.user_id, 
        email: user.email, 
        name: user.name, 
        role: user.role 
      },
      SECRET_KEY,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        image_url: user.image_url
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
});

export default router;
