// wrstudios-backend/routes/posts.js - FIXED CLEAN VERSION
import express from 'express';
import db from '../config/database.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// ==================== IMAGES ROUTES ====================

// GET /api/posts/:id/images - Get all images
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

// GET /api/posts/:id/image/:index - Get single image by index
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

// ==================== COMMENTS ROUTES ====================

// POST /api/posts/:id/comments - Add comment to 'comment' table
router.post('/:id/comments', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parent_comment_id } = req.body;
    const user_id = req.user.user_id;

    console.log('📝 Adding comment:', { 
      post_id: id, 
      user_id, 
      content_length: content?.length,
      has_parent: !!parent_comment_id 
    });

    if (!content || !content.trim()) {
      console.log('❌ Content is empty');
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    // Check if post exists
    const [posts] = await db.query('SELECT post_id FROM posts WHERE post_id = ?', [id]);
    if (posts.length === 0) {
      console.log('❌ Post not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check parent comment if exists
    if (parent_comment_id) {
      const [parentComment] = await db.query(
        'SELECT comment_id FROM comment WHERE comment_id = ? AND post_id = ?',
        [parent_comment_id, id]
      );
      
      if (parentComment.length === 0) {
        console.log('❌ Parent comment not found:', parent_comment_id);
        return res.status(404).json({
          success: false,
          message: 'Parent comment not found'
        });
      }
    }

    const comment_id = `comment_${Date.now()}`;

    // ✅ INSERT vào bảng 'comment' (số ít)
    const insertQuery = `
      INSERT INTO comment (comment_id, content_comment, user_id, post_id, parent_comment_id, rating, created_at)
      VALUES (?, ?, ?, ?, ?, 5, NOW())
    `;

    console.log('🔍 SQL Query:', insertQuery);
    console.log('🔍 SQL Params:', [comment_id, content.trim(), user_id, id, parent_comment_id || null]);

    await db.query(insertQuery, [
      comment_id, 
      content.trim(), 
      user_id, 
      id, 
      parent_comment_id || null
    ]);

    console.log(`✅ Comment added: ${comment_id}${parent_comment_id ? ` (reply to ${parent_comment_id})` : ''}`);

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment_id
    });
  } catch (error) {
    console.error('❌ Error adding comment:', error);
    console.error('❌ SQL Error:', error.sqlMessage);
    console.error('❌ Error Code:', error.code);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      sqlError: error.sqlMessage,
      code: error.code
    });
  }
});

// GET /api/posts/:id/comments - Get all comments from 'comment' table
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📖 Getting comments for post:', id);

    // ✅ Query từ bảng 'comment' (số ít)
    const [comments] = await db.query(`
      SELECT 
        c.comment_id,
        c.content_comment as content,
        c.rating,
        c.created_at,
        c.user_id,
        c.parent_comment_id,
        u.name as user_name,
        u.email as user_email
      FROM comment c
      LEFT JOIN users u ON c.user_id = u.user_id
      WHERE c.post_id = ? AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `, [id]);

    console.log(`✅ Found ${comments.length} comments for post ${id}`);

    res.json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error('❌ Error getting comments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== POSTS ROUTES ====================

// GET /api/posts - Get all posts with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
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

    // Check membership and post limit
    const [memberships] = await db.query(`
      SELECT mu.*, mp.post_limit
      FROM membership_user mu
      JOIN membership_packages mp ON mu.ms_id = mp.ms_id
      WHERE mu.user_id = ? AND mu.status = 'active' AND mu.end_at > NOW()
      ORDER BY mu.end_at DESC
      LIMIT 1
    `, [user_id]);

    if (memberships.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Bạn cần đăng ký gói Premium để đăng bài viết. Vui lòng nâng cấp tài khoản!'
      });
    }

    const membership = memberships[0];
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [postCount] = await db.query(`
      SELECT COUNT(*) as count
      FROM posts
      WHERE user_id = ? AND created_at >= ?
    `, [user_id, startOfMonth]);

    const currentPostCount = postCount[0]?.count || 0;
    
    if (currentPostCount >= membership.post_limit) {
      return res.status(403).json({
        success: false,
        message: `Bạn đã đạt giới hạn ${membership.post_limit} bài viết/tháng. Vui lòng nâng cấp gói hoặc đợi tháng sau!`
      });
    }

    const post_id = `post_${Date.now()}`;

    await db.query(`
      INSERT INTO posts (post_id, title, description, address, price, area, post_type, user_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', NOW())
    `, [post_id, title, description, address || null, price || null, area || null, post_type || 'listing', user_id]);

    console.log(`✅ Post created and auto-approved: ${post_id}`);

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
      message: 'Post created and published successfully',
      post_id 
    });
  } catch (error) {
    console.error('❌ Error creating post:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/posts/:id/approve - Approve post
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

// PATCH /api/posts/:id/reject - Reject post
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

// DELETE /api/posts/:id - Delete post
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

// PATCH /api/posts/:id/increment-view - Increment view count
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

// GET /api/posts/:id - Get single post (MUST be last)
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

export default router;