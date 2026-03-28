const { runCommand } = require('../lib/utils');
const { db } = require('../db');
const { redroidInstances, automationLogs } = require('../db/schema');
const { count, eq } = require('drizzle-orm');

const formatUptime = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
};

const getStatus = async (req, res) => {
  try {
    const adbOutput = await runCommand('adb devices').catch(() => '');
    const dockerOutput = await runCommand(
      'docker ps --filter "name=redroid" --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"'
    ).catch(() => '');

    const runningInstances = dockerOutput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    res.json({
      status: 'online',
      adb: adbOutput.includes('\tdevice') ? 'connected' : 'disconnected',
      docker: 'available',
      instanceCount: runningInstances.length,
      instances: runningInstances,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const startSystem = async (req, res) => {
  try {
    const count = Math.min(
      Math.max(parseInt(req.body.redroidCount) || parseInt(process.env.REDROID_COUNT || '1'), 1),
      10
    );

    console.log(`Starting ${count} instance(s)...`);
    await runCommand(`./scripts/start-redroid.sh ${count}`);

    console.log('Connecting ADB...');
    await runCommand(`./scripts/adb-connect.sh ${count}`);

    const ports = Array.from({ length: count }, (_, i) => 5555 + i);

    res.json({
      success: true,
      message: `Started ${count} instance(s)`,
      count,
      ports,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const stopSystem = async (req, res) => {
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
};

const getOverview = async (req, res) => {
  try {
    const dockerOutput = await runCommand(
      'docker ps --filter "name=redroid" --format "{{.Names}}"'
    ).catch(() => '');
    const activeInstances = dockerOutput.split('\n').map((s) => s.trim()).filter(Boolean).length;

    const [totalRow] = await db.select({ value: count() }).from(automationLogs);
    const [successRow] = await db
      .select({ value: count() })
      .from(automationLogs)
      .where(eq(automationLogs.status, 'success'));

    const total = Number(totalRow?.value ?? 0);
    const success = Number(successRow?.value ?? 0);
    const successRate = total > 0 ? `${((success / total) * 100).toFixed(1)}%` : 'N/A';

    res.json({
      activeInstances,
      totalAutomations: total,
      successRate,
      uptime: formatUptime(Math.floor(process.uptime())),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInstances = async (req, res) => {
  try {
    const instances = await db
      .select()
      .from(redroidInstances)
      .orderBy(redroidInstances.id);
    res.json({ instances });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getStatus, startSystem, stopSystem, getOverview, getInstances };
