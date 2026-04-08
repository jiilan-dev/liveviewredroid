require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { db, pool } = require('./db');
const { initDefaultUser } = require('./controllers/auth.controller');

// Routes
const authRoutes = require('./routes/auth.routes');
const systemRoutes = require('./routes/system.routes');
const appRoutes = require('./routes/app.routes');
const automationRoutes = require('./routes/automation.routes');
const internetRoutes = require('./routes/internet.routes');
const profileRoutes = require('./routes/profile.routes');

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
app.use('/api/internet', internetRoutes);
app.use('/api/profiles', profileRoutes);

// Swagger UI
const swaggerDocument = yaml.load(fs.readFileSync(path.join(__dirname, 'openapi.yml'), 'utf8'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'LiveView Redroid API',
  swaggerOptions: { persistAuthorization: true },
}));
app.get('/api/docs.json', (req, res) => res.json(swaggerDocument));
app.get('/api/docs.yaml', (req, res) => {
  res.setHeader('Content-Type', 'text/yaml');
  res.send(fs.readFileSync(path.join(__dirname, 'openapi.yml'), 'utf8'));
});

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
      console.log(`✓ Swagger UI   → http://localhost:${PORT}/api/docs`);
      console.log(`✓ OpenAPI JSON → http://localhost:${PORT}/api/docs.json`);
      console.log(`✓ OpenAPI YAML → http://localhost:${PORT}/api/docs.yaml`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
