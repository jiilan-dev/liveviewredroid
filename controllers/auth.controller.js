const { db } = require('../db');
const { users } = require('../db/schema');
const { generateToken, hashPassword, comparePassword } = require('../lib/auth');
const { eq } = require('drizzle-orm');

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

const login = async (req, res) => {
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
};

const initAuth = async (req, res) => {
  try {
    await initDefaultUser();
    res.json({ success: true, message: 'Default user initialized' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { login, initAuth, initDefaultUser };
