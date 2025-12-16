// wrstudios-backend/routes/posts.js - ĐẦY ĐỦ VỚI RESTORE
import express from 'express';
import db from '../config/database.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/posts - Lấy tất cả posts
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    console.log(`📄 Fetching posts: page=${page}, limit=${limit}`);

    const [posts] = await db.query(
      `SELECT 
        p.*,
        u.name as author_name,
        u.email as author_email,
        COUNT(DISTINCT c.comment_id) as total_comments,
        COUNT(DISTINCT i.image_id) as image_count,
        COALESCE(AVG(CASE WHEN c.rating IS NOT NULL THEN c.rating END), 0) as average_rating,
        COUNT(CASE WHEN c.rating IS NOT NULL THEN 1 END) as total_ratings,
        (SELECT i2.img_url FROM images i2 WHERE i2.post_id = p.post_id ORDER BY i2.created_at ASC LIMIT 1) as thumbnail
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.user_id
       LEFT JOIN comment c ON p.post_id = c.post_id AND c.deleted_at IS NULL
       LEFT JOIN images i ON p.post_id = i.post_id
       GROUP BY p.post_id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countResult] = await db.query('SELECT COUNT(*) as total FROM posts');
    const total = countResult[0].total;

    console.log(`✅ Fetched ${posts.length} posts`);

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
    console.error('❌ Error fetching posts:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/posts/:id - Lấy chi tiết post
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📄 Fetching post:', id);

    const [posts] = await db.query(
      `SELECT 
        p.*,
        u.name as author_name,
        u.email as author_email,
        u.phone as author_phone,
        u.image_url as author_image,
        COUNT(DISTINCT c.comment_id) as total_comments,
        COALESCE(AVG(CASE WHEN c.rating IS NOT NULL THEN c.rating END), 0) as average_rating,
        COUNT(CASE WHEN c.rating IS NOT NULL THEN 1 END) as total_ratings
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.user_id
       LEFT JOIN comment c ON p.post_id = c.post_id AND c.deleted_at IS NULL
       WHERE p.post_id = ?
       GROUP BY p.post_id`,
      [id]
    );

    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    console.log('✅ Post found:', posts[0].post_id);
    res.json({ 
      success: true, 
      data: posts[0] 
    });
  } catch (error) {
    console.error('❌ Error fetching post:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/posts - Tạo post mới
router.post('/', verifyToken, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      address, 
      price, 
      area, 
      category,
      post_type = 'listing', 
      images = [] 
    } = req.body;

    const user_id = req.user.user_id;

    console.log('📝 Received post data:', { title, post_type, category });

    // Validate
    if (!title || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title và description là bắt buộc!' 
      });
    }

    // Validate category
    if (post_type === 'listing' && category) {
      const validCategories = ['studio', '1bedroom', '2bedroom', 'hotel'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Category không hợp lệ! (studio/1bedroom/2bedroom/hotel)' 
        });
      }
    }

    const post_id = `post_${Date.now()}`;

    // INSERT
    await db.query(
      `INSERT INTO posts (
        post_id, title, description, address, price, area, 
        category, post_type, user_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', NOW())`,
      [
        post_id, 
        title, 
        description, 
        address || null, 
        price || null, 
        area || null,
        post_type === 'listing' ? (category || 'studio') : null,
        post_type, 
        user_id
      ]
    );

    // Insert images
    if (images && images.length > 0) {
      const imageValues = images.map((img, idx) => [
        `img_${post_id}_${idx}`,
        img,
        post_id
      ]);

      await db.query(
        `INSERT INTO images (image_id, img_url, post_id) VALUES ?`,
        [imageValues]
      );
    }

    console.log(`✅ Post created: ${post_id} (category: ${category || 'default studio'})`);

    res.status(201).json({ 
      success: true, 
      message: 'Tạo bài viết thành công!',
      post_id 
    });
  } catch (error) {
    console.error('❌ Error creating post:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// PUT /api/posts/:id - Cập nhật post
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      description, 
      address, 
      price, 
      area,
      category
    } = req.body;

    const user_id = req.user.user_id;

    // Check ownership
    const [posts] = await db.query(
      'SELECT user_id FROM posts WHERE post_id = ?',
      [id]
    );

    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post không tồn tại!' 
      });
    }

    if (posts[0].user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền sửa post này!' 
      });
    }

    // UPDATE
    await db.query(
      `UPDATE posts 
       SET title = ?, description = ?, address = ?, 
           price = ?, area = ?, category = ?, updated_at = NOW()
       WHERE post_id = ?`,
      [title, description, address, price, area, category, id]
    );

    res.json({ 
      success: true, 
      message: 'Cập nhật bài viết thành công!' 
    });
  } catch (error) {
    console.error('❌ Error updating post:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// DELETE /api/posts/:id - Xóa post
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    // Check ownership
    const [posts] = await db.query(
      'SELECT user_id FROM posts WHERE post_id = ?',
      [id]
    );

    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post không tồn tại!' 
      });
    }

    if (posts[0].user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền xóa post này!' 
      });
    }

    await db.query('DELETE FROM posts WHERE post_id = ?', [id]);

    console.log(`🗑️ Post deleted: ${id}`);

    res.json({ 
      success: true, 
      message: 'Xóa bài viết thành công!' 
    });
  } catch (error) {
    console.error('❌ Error deleting post:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// PATCH /api/posts/:id/reject - Từ chối post
router.patch('/:id/reject', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if post exists
    const [posts] = await db.query(
      'SELECT post_id, title FROM posts WHERE post_id = ?',
      [id]
    );

    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post không tồn tại!' 
      });
    }

    await db.query(
      "UPDATE posts SET status = 'rejected', updated_at = NOW() WHERE post_id = ?",
      [id]
    );

    console.log(`❌ Post rejected: ${id} - "${posts[0].title}"`);

    res.json({ 
      success: true, 
      message: 'Từ chối bài viết thành công!' 
    });
  } catch (error) {
    console.error('❌ Error rejecting post:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ✅ PATCH /api/posts/:id/restore - Khôi phục bài viết (rejected → approved)
router.patch('/:id/restore', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if post exists and is rejected
    const [posts] = await db.query(
      'SELECT post_id, title, status FROM posts WHERE post_id = ?',
      [id]
    );

    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post không tồn tại!' 
      });
    }

    if (posts[0].status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể khôi phục bài viết đã bị từ chối!'
      });
    }

    await db.query(
      "UPDATE posts SET status = 'approved', updated_at = NOW() WHERE post_id = ?",
      [id]
    );

    console.log(`♻️ Post restored: ${id} - "${posts[0].title}"`);

    res.json({
      success: true,
      message: 'Khôi phục bài viết thành công!'
    });
  } catch (error) {
    console.error('❌ Error restoring post:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PATCH /api/posts/:id/increment-view - Tăng view
router.patch('/:id/increment-view', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'UPDATE posts SET views = views + 1 WHERE post_id = ?',
      [id]
    );

    res.json({ 
      success: true, 
      message: 'View incremented' 
    });
  } catch (error) {
    console.error('❌ Error incrementing view:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== IMAGES ROUTES ====================

// GET /api/posts/:postId/images
router.get('/:postId/images', async (req, res) => {
  try {
    const { postId } = req.params;

    const [images] = await db.query(
      'SELECT img_url FROM images WHERE post_id = ? ORDER BY created_at ASC',
      [postId]
    );

    const imageUrls = images.map(img => img.img_url);

    res.json({ 
      success: true, 
      data: imageUrls 
    });
  } catch (error) {
    console.error('❌ Error fetching images:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/posts/:postId/image/:index
router.get('/:postId/image/:index', async (req, res) => {
  try {
    const { postId, index } = req.params;
    const imageIndex = parseInt(index);

    const [images] = await db.query(
      'SELECT img_url FROM images WHERE post_id = ? ORDER BY created_at ASC LIMIT 1 OFFSET ?',
      [postId, imageIndex]
    );

    if (images.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Image not found' 
      });
    }

    res.json({ 
      success: true, 
      data: { img_url: images[0].img_url } 
    });
  } catch (error) {
    console.error('❌ Error fetching image:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== COMMENTS ROUTES ====================

// GET /api/posts/:postId/comments
router.get('/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    console.log('📖 Fetching comments for post:', postId);

    const [comments] = await db.query(
      `SELECT 
        c.comment_id, 
        c.content_comment, 
        c.rating, 
        c.created_at, 
        c.updated_at,
        c.user_id,
        c.parent_comment_id,
        u.name as user_name, 
        u.email as user_email,
        u.image_url
       FROM comment c
       LEFT JOIN users u ON c.user_id = u.user_id
       WHERE c.post_id = ? AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [postId]
    );

    console.log(`✅ Found ${comments.length} comments`);
    
    res.json({ 
      success: true, 
      data: comments 
    });
  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/posts/:postId/comments
router.post('/:postId/comments', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, rating, parent_comment_id } = req.body;
    const user_id = req.user.user_id;

    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Nội dung comment không được để trống!' 
      });
    }

    const comment_id = `cmt_${Date.now()}`;

    await db.query(
      `INSERT INTO comment 
       (comment_id, content_comment, rating, post_id, user_id, parent_comment_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [comment_id, content.trim(), rating || null, postId, user_id, parent_comment_id || null]
    );

    console.log(`✅ Comment created: ${comment_id}`);

    res.status(201).json({ 
      success: true, 
      message: 'Thêm bình luận thành công!',
      comment_id 
    });
  } catch (error) {
    console.error('❌ Error adding comment:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;