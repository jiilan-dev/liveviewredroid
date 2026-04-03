const { runCommand } = require('../lib/utils');

// Parse running redroid container names -> [{name, port}]
const getRunningInstances = async () => {
  const out = await runCommand(
    'docker ps --filter "name=redroid" --format "{{.Names}}"'
  ).catch(() => '');
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => {
      const m = name.match(/redroid-(\d+)/);
      return m ? { name, port: 5554 + parseInt(m[1], 10) } : null;
    })
    .filter(Boolean);
};

const launchApp = async (req, res) => {
  try {
    const { apkPath, packageName } = req.body;
    const apk = apkPath || process.env.LIVEVIEW_APK_PATH || './shopee.apk';

    const instances = await getRunningInstances();
    if (instances.length === 0) {
      return res.status(400).json({ error: 'No running instances found. Start the system first.' });
    }

    console.log(`Launching app on ${instances.length} instance(s): ${apk}`);

    const settled = await Promise.allSettled(
      instances.map(async ({ port }) => {
        const serial = `localhost:${port}`;
        await runCommand(
          `ADB_SERIAL=${serial} ./scripts/open-liveview.sh "${apk}" "${packageName || ''}"`
        );
        await runCommand(
          `adb -s ${serial} shell settings put secure immersive_mode_confirmations confirmed`
        ).catch(() => null);
        return serial;
      })
    );

    const results = settled.map((r, i) => ({
      serial: `localhost:${instances[i].port}`,
      status: r.status === 'fulfilled' ? 'success' : 'error',
      ...(r.status === 'rejected' && { error: r.reason?.message ?? 'Unknown error' }),
    }));

    const allFailed = results.every((r) => r.status === 'error');
    res.status(allFailed ? 500 : 200).json({
      success: !allFailed,
      apk,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { launchApp, getRunningInstances };
