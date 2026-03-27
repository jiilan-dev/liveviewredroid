const { runCommand } = require('../lib/utils');

const getStatus = async (req, res) => {
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
};

const startSystem = async (req, res) => {
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
