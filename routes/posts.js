// wrstudios-backend/routes/posts.js - FIXED VERSION
import express from 'express';
import db from '../config/database.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// ✅ FIX: Thêm route GET all images của post
router.get('/:id/images', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [images] = await db.query(`
      SELECT img_url, created_at 
      FROM images 
      WHERE post_id = ? 
      ORDER BY created_at ASC
    `, [id]);
    
    res.json({ 
      success: true, 
      data: images.map(img => img.img_url),
      count: images.length 
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ FIX: Route lấy 1 ảnh theo index (đổi từ /images/:index thành /image/:index)
router.get('/:id/image/:index', async (req, res) => {
  try {
    const { id, index } = req.params;
    const imageIndex = parseInt(index);
    
    if (isNaN(imageIndex) || imageIndex < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid image index' 
      });
    }

    const [images] = await db.query(`
      SELECT img_url 
      FROM images 
      WHERE post_id = ? 
      ORDER BY created_at ASC
      LIMIT 1 OFFSET ?
    `, [id, imageIndex]);

    if (images.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Image not found' 
      });
    }

    res.json({ 
      success: true, 
      data: images[0].img_url 
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/posts - Get all posts with pagination + THUMBNAIL
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status || null;

    let query = `
      SELECT 
        p.*,
        u.name as author_name,
        u.email as author_email,
        COUNT(DISTINCT c.comment_id) as comment_count,
        (SELECT img_url FROM images WHERE post_id = p.post_id ORDER BY created_at LIMIT 1) as thumbnail,
        (SELECT COUNT(*) FROM images WHERE post_id = p.post_id) as image_count
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.user_id
      LEFT JOIN comment c ON p.post_id = c.post_id AND c.deleted_at IS NULL
    `;

    const params = [];

    if (status) {
      query += ' WHERE p.status = ?';
      params.push(status);
    }

    query += `
      GROUP BY p.post_id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const [posts] = await db.query(query, params);

    let countQuery = 'SELECT COUNT(DISTINCT p.post_id) as total FROM posts p';
    if (status) {
      countQuery += ' WHERE p.status = ?';
    }
    const [countResult] = await db.query(countQuery, status ? [status] : []);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/posts/:id - Get single post details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [posts] = await db.query(`
      SELECT 
        p.*,
        u.name as author_name,
        u.email as author_email,
        u.phone as author_phone,
        (SELECT COUNT(*) FROM images WHERE post_id = p.post_id) as image_count
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.user_id
      WHERE p.post_id = ?
    `, [id]);

    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    res.json({ success: true, data: posts[0] });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/posts - Create new post
router.post('/', verifyToken, async (req, res) => {
  try {
    console.log('📝 Creating post, body:', req.body);
    
    const { title, description, address, price, area, post_type, images } = req.body;
    const user_id = req.user.user_id;

    if (!title || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and description are required' 
      });
    }

    const post_id = `post_${Date.now()}`;

    await db.query(`
      INSERT INTO posts (post_id, title, description, address, price, area, post_type, user_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    `, [post_id, title, description, address || null, price || null, area || null, post_type || 'listing', user_id]);

    console.log(`✅ Post created: ${post_id}`);

    if (images && Array.isArray(images) && images.length > 0) {
      const imageValues = images.map((img, idx) => [
        `img_${post_id}_${idx}`,
        img,
        post_id,
        new Date()
      ]);

      await db.query(`
        INSERT INTO images (image_id, img_url, post_id, created_at)
        VALUES ?
      `, [imageValues]);
      
      console.log(`✅ Inserted ${images.length} images for post ${post_id}`);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Post created successfully',
      post_id 
    });
  } catch (error) {
    console.error('❌ Error creating post:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/posts/:id/approve - Approve post (admin only)
router.patch('/:id/approve', verifyToken, async (req, res) => {
  try {
    const [posts] = await db.query('SELECT post_id FROM posts WHERE post_id = ?', [req.params.id]);
    
    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    await db.query(
      'UPDATE posts SET status = ?, updated_at = NOW() WHERE post_id = ?',
      ['approved', req.params.id]
    );

    res.json({ success: true, message: 'Post approved' });
  } catch (error) {
    console.error('Error approving post:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/posts/:id/reject - Reject post (admin only)
router.patch('/:id/reject', verifyToken, async (req, res) => {
  try {
    const [posts] = await db.query('SELECT post_id FROM posts WHERE post_id = ?', [req.params.id]);
    
    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    await db.query(
      'UPDATE posts SET status = ?, updated_at = NOW() WHERE post_id = ?',
      ['rejected', req.params.id]
    );

    res.json({ success: true, message: 'Post rejected' });
  } catch (error) {
    console.error('Error rejecting post:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/posts/:id - Delete post (admin or owner)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const [posts] = await db.query('SELECT post_id FROM posts WHERE post_id = ?', [req.params.id]);
    
    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found - already deleted' 
      });
    }

    await db.query('DELETE FROM images WHERE post_id = ?', [req.params.id]);
    await db.query('DELETE FROM posts WHERE post_id = ?', [req.params.id]);

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/posts/:id/increment-view - Tăng lượt xem
router.patch('/:id/increment-view', async (req, res) => {
  try {
    await db.query(
      'UPDATE posts SET views = views + 1 WHERE post_id = ?',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error incrementing view:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;