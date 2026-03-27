const { runCommand } = require('../lib/utils');

const launchApp = async (req, res) => {
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
};

module.exports = { launchApp };
