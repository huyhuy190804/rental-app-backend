// wrstudios-backend/routes/plans.js
import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// GET /api/plans - Lấy tất cả gói membership
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM membership_packages');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/plans - Thêm gói mới
router.post('/', async (req, res) => {
  try {
    const { name, price, description, duration, post_limit } = req.body;
    
    const ms_id = `ms_${Date.now()}`;
    
    await db.query(
      `INSERT INTO membership_packages (ms_id, name, price, description, duration, post_limit) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ms_id, name, price, description, duration, post_limit]
    );
    
    res.status(201).json({ success: true, id: ms_id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/plans/:id - Cập nhật gói
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, duration, post_limit } = req.body;
    
    await db.query(
      `UPDATE membership_packages 
       SET name = ?, price = ?, description = ?, duration = ?, post_limit = ? 
       WHERE ms_id = ?`,
      [name, price, description, duration, post_limit, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/plans/:id - Xóa gói
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM membership_packages WHERE ms_id = ?', [id]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;