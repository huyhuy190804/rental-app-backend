// wrstudios-backend/index.js
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import postsRoutes from "./routes/posts.js";
import commentsRoutes from "./routes/comments.js";
import membershipRoutes from "./routes/membership_packages.js";
import plansRoutes from "./routes/plans.js";
import transactionsRoutes from "./routes/transactions.js";
import adminSetupRoutes from "./routes/admin-setup.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get("/", (req, res) => {
  res.json({ status: "OK", message: "Server is running", timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/membership_packages', membershipRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/admin-setup', adminSetupRoutes); // ⚠️ DEV ONLY - Disable in production

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api`);
});