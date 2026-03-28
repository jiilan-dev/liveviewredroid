const { runCommand } = require('../lib/utils');

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

module.exports = { getStatus, startSystem, stopSystem };
