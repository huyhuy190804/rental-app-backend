// wrstudios-backend/routes/comments.js
import express from 'express';
import db from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/comments/post/:postId - Get comments for a post
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    const [comments] = await db.query(
      `SELECT c.comment_id, c.content_comment, c.rating, c.created_at, c.user_id,
              u.name as user_name, u.image_url
       FROM comment c
       LEFT JOIN users u ON c.user_id = u.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at DESC`,
      [postId]
    );

    res.json({ success: true, data: comments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/comments - Create comment
router.post('/', verifyToken, async (req, res) => {
  try {
    const { post_id, content_comment, rating } = req.body;
    const user_id = req.user.user_id;

    if (!post_id || !content_comment) {
      return res.status(400).json({ success: false, message: 'Post ID and content required' });
    }

    // Check post exists
    const [posts] = await db.query('SELECT post_id FROM posts WHERE post_id = ?', [post_id]);
    if (posts.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const comment_id = `cmt_${Date.now()}`;

    await db.query(
      `INSERT INTO comment (comment_id, content_comment, rating, post_id, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [comment_id, content_comment, rating || null, post_id, user_id]
    );

    res.status(201).json({ success: true, message: 'Comment created', comment_id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/comments/:id - Update comment
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content_comment, rating } = req.body;
    const user_id = req.user.user_id;

    // Check ownership
    const [comments] = await db.query('SELECT user_id FROM comment WHERE comment_id = ?', [id]);
    if (comments.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (comments[0].user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await db.query(
      'UPDATE comment SET content_comment = ?, rating = ?, updated_at = NOW() WHERE comment_id = ?',
      [content_comment, rating || null, id]
    );

    res.json({ success: true, message: 'Comment updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/comments/:id - Delete comment
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    // Check ownership
    const [comments] = await db.query('SELECT user_id FROM comment WHERE comment_id = ?', [id]);
    if (comments.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (comments[0].user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await db.query('DELETE FROM comment WHERE comment_id = ?', [id]);

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
