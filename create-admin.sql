-- Script to create admin user account
-- Run this in MySQL to create admin account

USE rental_app;

-- Create admin user (if not exists)
INSERT INTO users (user_id, name, email, phone, password, status, role, created_at)
VALUES (
  'admin_001',
  'admin',
  'admin@wrstudios.com',
  '0123456789',
  'admin123',  -- ⚠️ CHANGE THIS PASSWORD IN PRODUCTION!
  'active',
  'admin',
  NOW()
)
ON DUPLICATE KEY UPDATE 
  name = VALUES(name),
  email = VALUES(email),
  phone = VALUES(phone),
  password = VALUES(password),
  status = 'active',
  role = 'admin';

-- Verify admin user was created
SELECT user_id, name, email, role, status FROM users WHERE role = 'admin';

