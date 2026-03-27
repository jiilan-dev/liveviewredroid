require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { db, pool } = require('./db');
const { initDefaultUser } = require('./controllers/auth.controller');

// Routes
const authRoutes = require('./routes/auth.routes');
const systemRoutes = require('./routes/system.routes');
const appRoutes = require('./routes/app.routes');
const automationRoutes = require('./routes/automation.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(morgan('combined'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/app', appRoutes);
app.use('/api/automation', automationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// SERVER STARTUP
// ============================================

const startServer = async () => {
  try {
    // Initialize database connection
    await pool.query('SELECT NOW()');
    console.log('✓ Database connected');

    // Initialize default user
    await initDefaultUser();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log('\n📚 API Endpoints:');
      console.log('   POST   /api/auth/login                - Login with credentials');
      console.log('   POST   /api/auth/init                 - Initialize default user');
      console.log('   GET    /api/system/status             - Check system status');
      console.log('   POST   /api/system/start              - Start all systems');
      console.log('   POST   /api/system/stop               - Stop all systems');
      console.log('   POST   /api/app/launch                - Launch app on device');
      console.log('   POST   /api/automation/execute        - Run full automation');
      console.log('   POST   /api/automation/tap-element    - Tap UI element');
      console.log('   GET    /api/health                    - Health check\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
