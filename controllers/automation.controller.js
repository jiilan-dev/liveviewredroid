const { runCommand } = require('../lib/utils');

const executeAutomation = async (req, res) => {
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
};

const tapElement = async (req, res) => {
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
};

module.exports = { executeAutomation, tapElement };
