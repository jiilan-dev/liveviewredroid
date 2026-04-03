const { runCommand } = require('../lib/utils');
const { db } = require('../db');
const { automationLogs, redroidInstances } = require('../db/schema');
const { desc, eq } = require('drizzle-orm');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Shared helper: get running redroid containers as [{name, port}]
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

// Try to write a log row; silently skip if redroid_instances table has no matching row
const tryLog = async (port, action, status, details) => {
  try {
    const [instance] = await db
      .select({ id: redroidInstances.id })
      .from(redroidInstances)
      .where(eq(redroidInstances.port, port))
      .limit(1);
    if (!instance) return;
    await db.insert(automationLogs).values({
      redroidId: instance.id,
      action,
      status,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (_) {
    // DB not synced yet — log is optional
  }
};

const executeAutomation = async (req, res) => {
  try {
    const { apkPath, packageName, buttonText, timeout } = req.body;
    const apk = apkPath || process.env.LIVEVIEW_APK_PATH || './shopee.apk';
    const text = buttonText || 'Masuk Live';
    const wait = Number(timeout) || 60;

    const instances = await getRunningInstances();
    if (instances.length === 0) {
      return res.status(400).json({ error: 'No running instances found. Start the system first.' });
    }

    console.log(`Executing automation on ${instances.length} instance(s): "${text}"`);

    const settled = await Promise.allSettled(
      instances.map(async ({ port }) => {
        const serial = `localhost:${port}`;
        // Run install+launch then tap — skip restart steps (system already running)
        await runCommand(
          `ADB_SERIAL=${serial} ./scripts/open-liveview.sh "${apk}" "${packageName || ''}"`
        );

        // Prevent Android immersive tutorial overlay from blocking target buttons.
        await runCommand(
          `adb -s ${serial} shell settings put secure immersive_mode_confirmations confirmed`
        ).catch(() => null);

        // Best-effort dismiss in case overlay is already visible.
        await runCommand(
          `python3 ./scripts/tap-ui-element.py --serial ${serial} --text "GOT IT" --timeout 4`
        ).catch(() => null);

        // Give app transition a moment before UI dump/tap starts.
        await sleep(1500);
        await runCommand(
          `python3 ./scripts/tap-ui-element.py --serial ${serial} --text "${text}" --timeout ${wait}`
        );
        await tryLog(port, 'execute_automation', 'success', { apk, buttonText: text });
        return serial;
      })
    );

    const results = settled.map((r, i) => ({
      serial: `localhost:${instances[i].port}`,
      status: r.status === 'fulfilled' ? 'success' : 'error',
      ...(r.status === 'rejected' && { error: r.reason?.message ?? 'Unknown error' }),
    }));

    // Log errors to DB too
    for (let i = 0; i < settled.length; i++) {
      if (settled[i].status === 'rejected') {
        await tryLog(instances[i].port, 'execute_automation', 'error', {
          error: settled[i].reason?.message,
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const allFailed = successCount === 0;
    res.json({
      success: !allFailed,
      message: allFailed
        ? 'Automation finished, but all instances failed. Check per-instance errors.'
        : `Automation finished: ${successCount}/${results.length} instance(s) succeeded`,
      buttonText: text,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const tapElement = async (req, res) => {
  try {
    const { text, resourceId, contentDesc, timeout } = req.body;
    const wait = Number(timeout) || 60;

    if (!text && !resourceId && !contentDesc) {
      return res.status(400).json({ error: 'Provide at least one selector: text, resourceId, or contentDesc' });
    }

    const instances = await getRunningInstances();
    if (instances.length === 0) {
      return res.status(400).json({ error: 'No running instances found. Start the system first.' });
    }

    console.log(`Tapping element on ${instances.length} instance(s)`);

    const settled = await Promise.allSettled(
      instances.map(async ({ port }) => {
        const serial = `localhost:${port}`;
        let cmd = `python3 ./scripts/tap-ui-element.py --serial ${serial} --timeout ${wait}`;
        if (text) cmd += ` --text "${text}"`;
        if (resourceId) cmd += ` --id "${resourceId}"`;
        if (contentDesc) cmd += ` --desc "${contentDesc}"`;
        await runCommand(cmd);
        await tryLog(port, 'tap_element', 'success', { text, resourceId, contentDesc });
        return serial;
      })
    );

    const results = settled.map((r, i) => ({
      serial: `localhost:${instances[i].port}`,
      status: r.status === 'fulfilled' ? 'success' : 'error',
      ...(r.status === 'rejected' && { error: r.reason?.message ?? 'Unknown error' }),
    }));

    for (let i = 0; i < settled.length; i++) {
      if (settled[i].status === 'rejected') {
        await tryLog(instances[i].port, 'tap_element', 'error', {
          error: settled[i].reason?.message,
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const allFailed = successCount === 0;
    res.json({
      success: !allFailed,
      message: allFailed
        ? 'Tap finished, but all instances failed. Check per-instance errors.'
        : `Tap finished: ${successCount}/${results.length} instance(s) succeeded`,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getLogs = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const logs = await db
      .select({
        id: automationLogs.id,
        redroidId: automationLogs.redroidId,
        action: automationLogs.action,
        status: automationLogs.status,
        details: automationLogs.details,
        createdAt: automationLogs.createdAt,
      })
      .from(automationLogs)
      .orderBy(desc(automationLogs.createdAt))
      .limit(limit);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { executeAutomation, tapElement, getLogs };
