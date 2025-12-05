// Admin Setup Route - Only for development/testing
// ⚠️ DISABLE THIS IN PRODUCTION!
import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// POST /api/admin-setup/create-admin - Create admin account (DEV ONLY)
router.post('/create-admin', async (req, res) => {
  try {
    const { name = 'admin', email = 'admin@wrstudios.com', phone = '0123456789', password = 'admin123' } = req.body;

    // Check if admin already exists
    const [existing] = await db.query(
      "SELECT user_id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Admin account already exists',
        admin: existing[0]
      });
    }

    const user_id = 'admin_001';

    await db.query(
      `INSERT INTO users (user_id, name, email, phone, password, status, role, created_at) 
       VALUES (?, ?, ?, ?, ?, 'active', 'admin', NOW())`,
      [user_id, name, email, phone, password]
    );

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      admin: {
        user_id,
        name,
        email,
        role: 'admin'
      },
      credentials: {
        username: name,
        password: password,
        note: '⚠️ Change password after first login!'
      }
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

