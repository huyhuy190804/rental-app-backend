-- Script to check posts in database
USE rental_app;

-- Check total posts
SELECT COUNT(*) as total_posts FROM posts;

-- Check posts by status
SELECT status, COUNT(*) as count 
FROM posts 
GROUP BY status;

-- Check approved posts with details
SELECT 
    p.post_id,
    p.title,
    p.status,
    p.post_type,
    p.created_at,
    u.name as author_name,
    (SELECT COUNT(*) FROM images WHERE post_id = p.post_id) as image_count
FROM posts p
LEFT JOIN users u ON p.user_id = u.user_id
WHERE p.status = 'approved'
ORDER BY p.created_at DESC
LIMIT 10;

-- Check all posts (first 10)
SELECT 
    p.post_id,
    p.title,
    p.status,
    p.post_type,
    p.created_at,
    u.name as author_name
FROM posts p
LEFT JOIN users u ON p.user_id = u.user_id
ORDER BY p.created_at DESC
LIMIT 10;

