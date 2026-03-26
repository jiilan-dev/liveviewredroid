require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const { db, pool } = require('./db');
const { users } = require('./db/schema');
const { generateToken, verifyToken, hashPassword, comparePassword } = require('./lib/auth');
const { eq } = require('drizzle-orm');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());
app.use(morgan('combined'));

// Auth middleware
const verifyAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });

  req.userId = decoded.userId;
  next();
};

// Helper: Run shell commands
const runCommand = (command, args = [], options = {}) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { shell: true, ...options });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || stdout));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
};

// Initialize default admin user
const initDefaultUser = async () => {
  try {
    const existingUser = await db.select().from(users).where(eq(users.username, 'admin'));
    if (existingUser.length === 0) {
      const hashedPassword = await hashPassword('admin123');
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
      });
      console.log('✓ Default admin user created (admin/admin123)');
    }
  } catch (error) {
    console.error('Error initializing default user:', error);
  }
};

// ============================================
// AUTH ENDPOINTS
// ============================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await db.select().from(users).where(eq(users.username, username));
    if (user.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await comparePassword(password, user[0].password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user[0].id);
    res.json({
      success: true,
      token,
      user: {
        id: user[0].id,
        username: user[0].username,
        role: user[0].role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/init', async (req, res) => {
  try {
    await initDefaultUser();
    res.json({ success: true, message: 'Default user initialized' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SYSTEM ENDPOINTS
// ============================================

app.get('/api/system/status', verifyAuth, async (req, res) => {
  try {
    const adbStatus = await runCommand('adb devices').catch(() => 'unavailable');
    const dockerStatus = await runCommand('docker ps').catch(() => 'unavailable');

    res.json({
      status: 'online',
      adb: adbStatus.includes('device') ? 'connected' : 'disconnected',
      docker: dockerStatus ? 'available' : 'unavailable',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system/start', verifyAuth, async (req, res) => {
  try {
    const redroidCount = req.body.redroidCount || parseInt(process.env.REDROID_COUNT || '1');

    // Start redroid
    console.log(`Starting ${redroidCount} redroid instance(s)...`);
    await runCommand('./scripts/start-redroid.sh');

    // Connect ADB
    console.log('Connecting ADB...');
    await runCommand('./scripts/adb-connect.sh');

    res.json({
      success: true,
      message: `Started ${redroidCount} redroid instance(s)`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system/stop', verifyAuth, async (req, res) => {
  try {
    console.log('Stopping all systems...');
    await runCommand('./scripts/stop-all.sh');

    res.json({
      success: true,
      message: 'All systems stopped',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// APP LAUNCH ENDPOINTS
// ============================================

app.post('/api/app/launch', verifyAuth, async (req, res) => {
  try {
    const { apkPath, packageName, serialPort } = req.body;

    const apk = apkPath || process.env.LIVEVIEW_APK_PATH || './liveview.apk';
    const serial = serialPort || process.env.ADB_SERIAL || 'localhost:5555';

    console.log(`Launching app: ${apk} on ${serial}`);
    await runCommand(`ADB_SERIAL=${serial} ./scripts/open-liveview.sh "${apk}" "${packageName || ''}"`);

    res.json({
      success: true,
      message: 'App launched successfully',
      apk,
      serial,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AUTOMATION ENDPOINTS
// ============================================

app.post('/api/automation/execute', verifyAuth, async (req, res) => {
  try {
    const { apkPath, packageName, buttonText, timeout, serialPort } = req.body;

    const apk = apkPath || process.env.LIVEVIEW_APK_PATH || './liveview.apk';
    const text = buttonText || 'Masuk Live';
    const wait = timeout || 60;
    const serial = serialPort || process.env.ADB_SERIAL || 'localhost:5555';

    console.log(`Executing automation: ${text} on ${serial}`);

    const cmd =
      `WAIT_TIMEOUT=${wait} ADB_SERIAL=${serial} ` +
      `./scripts/automate-liveview.sh "${apk}" "${packageName || ''}" "${text}"`;

    await runCommand(cmd);

    res.json({
      success: true,
      message: 'Automation executed successfully',
      details: {
        apk,
        buttonText: text,
        timeout: wait,
        serial,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/automation/tap-element', verifyAuth, async (req, res) => {
  try {
    const { text, resourceId, contentDesc, timeout, serialPort } = req.body;

    const serial = serialPort || process.env.ADB_SERIAL || 'localhost:5555';
    const wait = timeout || 60;

    let cmd = `python3 ./scripts/tap-ui-element.py --serial ${serial} --timeout ${wait}`;

    if (text) cmd += ` --text "${text}"`;
    if (resourceId) cmd += ` --id "${resourceId}"`;
    if (contentDesc) cmd += ` --desc "${contentDesc}"`;

    console.log(`Tapping element on ${serial}`);
    await runCommand(cmd);

    res.json({
      success: true,
      message: 'Element tapped successfully',
      serial,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// ERROR HANDLING
// ============================================

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
      console.log(`✓ API docs:`);
      console.log(`   POST /api/auth/login - Login with credentials`);
      console.log(`   POST /api/system/start - Start all systems`);
      console.log(`   POST /api/system/stop - Stop all systems`);
      console.log(`   POST /api/app/launch - Launch app on device`);
      console.log(`   POST /api/automation/execute - Run full automation`);
      console.log(`   POST /api/automation/tap-element - Tap UI element`);
      console.log(`   GET /api/health - Health check`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();