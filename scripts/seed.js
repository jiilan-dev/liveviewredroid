require('dotenv').config();

const { db, pool } = require('../db');
const { users } = require('../db/schema');
const { hashPassword } = require('../lib/auth');
const { eq } = require('drizzle-orm');

const seed = async () => {
  try {
    const existing = await db.select().from(users).where(eq(users.username, 'admin'));

    if (existing.length > 0) {
      console.log('✓ User admin sudah ada, skip.');
      return;
    }

    const hashed = await hashPassword('admin123');
    await db.insert(users).values({
      username: 'admin',
      password: hashed,
      role: 'admin',
    });

    console.log('✓ Default user created: admin / admin123');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

seed();
