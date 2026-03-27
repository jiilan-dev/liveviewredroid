const { pgTable, serial, varchar, timestamp, text } = require('drizzle-orm/pg-core');

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

const redroidInstances = pgTable('redroid_instances', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  port: serial('port').notNull().unique(),
  status: varchar('status', { length: 50 }).notNull().default('stopped'),
  appPackage: varchar('app_package', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

const automationLogs = pgTable('automation_logs', {
  id: serial('id').primaryKey(),
  redroidId: serial('redroid_id').references(() => redroidInstances.id),
  action: varchar('action', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

module.exports = { users, redroidInstances, automationLogs };
