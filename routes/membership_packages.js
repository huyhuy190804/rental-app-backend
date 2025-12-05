// wrstudios-backend/routes/membership_packages.js
import express from 'express';
import db from '../config/database.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/membership_packages - Get all packages
router.get('/', async (req, res) => {
  try {
    const [packages] = await db.query('SELECT * FROM membership_packages ORDER BY price ASC');
    res.json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/membership_packages/:id - Get package by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [packages] = await db.query('SELECT * FROM membership_packages WHERE ms_id = ?', [id]);

    if (packages.length === 0) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    res.json({ success: true, data: packages[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/membership_packages - Create package (admin only)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, price, description, duration, post_limit } = req.body;

    if (!name || !price || !duration) {
      return res.status(400).json({ success: false, message: 'Name, price, and duration required' });
    }

    const ms_id = `ms_${Date.now()}`;

    await db.query(
      `INSERT INTO membership_packages (ms_id, name, price, description, duration, post_limit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ms_id, name, price, description || null, duration, post_limit || 10]
    );

    res.status(201).json({ success: true, message: 'Package created', ms_id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/membership_packages/:id - Update package (admin only)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, duration, post_limit } = req.body;

    await db.query(
      `UPDATE membership_packages SET name = ?, price = ?, description = ?, duration = ?, post_limit = ?
       WHERE ms_id = ?`,
      [name, price, description, duration, post_limit, id]
    );

    res.json({ success: true, message: 'Package updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/membership_packages/:id - Delete package (admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM membership_packages WHERE ms_id = ?', [id]);
    res.json({ success: true, message: 'Package deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
