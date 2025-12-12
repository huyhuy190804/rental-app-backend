  # Hướng Dẫn Đăng Nhập Admin

  ## 📋 Tổng Quan

  Trong hệ thống WRStudios, **role admin** có các quyền:
  - Quản lý users (xem, xóa, cập nhật trạng thái)
  - Duyệt/từ chối bài viết
  - Quản lý gói Premium
  - Quản lý transactions
  - Xem thống kê hệ thống
  - Quản lý comments/reviews

  ## 🔐 Cách Tạo Tài Khoản Admin

  ### Cách 1: Sử dụng SQL Script (Khuyến nghị)

  1. Chạy script SQL:
  ```bash
  mysql -u root -p rental_app < create-admin.sql
  ```

  Hoặc mở MySQL và chạy:
  ```sql
  USE rental_app;

  INSERT INTO users (user_id, name, email, phone, password, status, role, created_at)
  VALUES (
    'admin_001',
    'admin',
    'admin@wrstudios.com',
    '0123456789',
    'admin123',  -- ⚠️ Đổi password sau lần đăng nhập đầu!
    'active',
    'admin',
    NOW()
  );
  ```

  ### Cách 2: Sử dụng API (Development Only)

  ```bash
  POST http://localhost:4000/api/admin-setup/create-admin
  Content-Type: application/json

  {
    "name": "admin",
    "email": "admin@wrstudios.com",
    "phone": "0123456789",
    "password": "admin123"
  }
  ```

  **Lưu ý:** Route này chỉ nên dùng trong development. Vô hiệu hóa trong production!

  ### Cách 3: Tạo thủ công trong Database

  ```sql
  INSERT INTO users (user_id, name, email, phone, password, status, role, created_at)
  VALUES (
    'admin_001',
    'admin',
    'admin@wrstudios.com',
    '0123456789',
    'your_password_here',
    'active',
    'admin',
    NOW()
  );
  ```

  ## 🚀 Cách Đăng Nhập Admin

  ### Bước 1: Mở trang đăng nhập
  - Truy cập trang web: `http://localhost:3000`
  - Click nút "Đăng nhập" hoặc "Log In"

  ### Bước 2: Nhập thông tin đăng nhập
  - **Username/Email:** `admin` (hoặc email của admin)
  - **Password:** `admin123` (hoặc password bạn đã đặt)

  ### Bước 3: Xác nhận đăng nhập
  - Frontend sẽ tự động phát hiện username là "admin" và gọi `loginAdmin()`
  - Sau khi đăng nhập thành công, bạn sẽ được chuyển đến trang admin

  ### Bước 4: Truy cập Admin Dashboard
  - Sau khi đăng nhập, truy cập: `http://localhost:3000/admin`
  - Hoặc click vào menu Admin trong header

  ## 🔍 Kiểm Tra Role Admin

  ### Trong Database:
  ```sql
  SELECT user_id, name, email, role, status 
  FROM users 
  WHERE role = 'admin';
  ```

  ### Trong Code:
  - Backend middleware `isAdmin` kiểm tra: `req.user?.role === 'admin'`
  - Frontend kiểm tra: `user.role === 'admin'`

  ## ⚠️ Lưu Ý Bảo Mật

  1. **Đổi password mặc định:** Sau lần đăng nhập đầu tiên, nên đổi password
  2. **Hash password:** Hiện tại password lưu plain text. Nên dùng bcrypt trong production
  3. **Vô hiệu hóa admin-setup route:** Trong production, xóa hoặc disable route `/api/admin-setup`
  4. **Giới hạn IP:** Có thể giới hạn admin access theo IP trong production

  ## 📝 Thông Tin Tài Khoản Admin Mặc Định

  - **Username:** `admin`
  - **Email:** `admin@wrstudios.com`
  - **Password:** `admin123` (⚠️ Đổi ngay!)
  - **Role:** `admin`
  - **Status:** `active`

  ## 🛠️ Troubleshooting

  ### Không đăng nhập được admin?
  1. Kiểm tra tài khoản admin đã được tạo trong database chưa
  2. Kiểm tra password có đúng không
  3. Kiểm tra status có phải 'active' không
  4. Kiểm tra role có phải 'admin' không

  ### Lỗi "Admin access required"?
  - Token không chứa role 'admin'
  - Kiểm tra JWT token có đúng không
  - Đăng xuất và đăng nhập lại

  ### Không thấy menu Admin?
  - Kiểm tra `user.role === 'admin'` trong localStorage
  - Kiểm tra routing trong App.jsx có `/admin` routes không

