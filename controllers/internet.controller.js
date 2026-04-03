const { runCommand } = require('../lib/utils');
const { spawn } = require('child_process');

// Helper: run a ping test and return result
const pingTest = async (host, serial) => {
  const start = Date.now();
  try {
    let cmd;
    if (serial) {
      cmd = `adb -s ${serial} shell "ping -c 2 -W 3 ${host}"`;
    } else {
      cmd = `ping -c 2 -W 3 ${host}`;
    }
    const output = await runCommand(cmd);
    const elapsed = Date.now() - start;

    // Parse avg latency from ping output
    const match = output.match(/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/);
    const avgMs = match ? parseFloat(match[2]) : null;
    const lossMatch = output.match(/(\d+)% (?:packet )?loss/);
    const loss = lossMatch ? parseInt(lossMatch[1], 10) : null;

    return {
      host,
      reachable: true,
      avgMs,
      loss,
      elapsed,
      output: output.trim(),
    };
  } catch (err) {
    return {
      host,
      reachable: false,
      avgMs: null,
      loss: 100,
      elapsed: Date.now() - start,
      output: err.message || 'ping failed',
    };
  }
};

// GET /api/internet/status — full internet health check
const getInternetStatus = async (req, res) => {
  try {
    const results = { host: {}, docker: {}, instances: [] };

    // 1. Host checks
    results.host.ipForward = (await runCommand('cat /proc/sys/net/ipv4/ip_forward').catch(() => '0')).trim() === '1';

    // Host pings
    const hostTargets = ['8.8.8.8', 'google.com', '1.1.1.1'];
    results.host.pings = await Promise.all(hostTargets.map((h) => pingTest(h)));

    // 2. nftables check
    try {
      const nftOutput = await runCommand('sudo -n nft list chain inet filter forward 2>/dev/null || echo "no-chain"');
      if (nftOutput.includes('no-chain')) {
        results.host.nftables = { hasChain: false, hasDockerRules: true };
      } else {
        results.host.nftables = {
          hasChain: true,
          hasDockerRules: nftOutput.includes('docker0') && nftOutput.includes('accept'),
          raw: nftOutput.trim(),
        };
      }
    } catch {
      results.host.nftables = { hasChain: false, hasDockerRules: false, error: 'cannot check' };
    }

    // 3. Docker connectivity test
    try {
      const dockerPing = await runCommand('docker run --rm alpine ping -c 1 -W 3 8.8.8.8 2>&1');
      results.docker.hasInternet = dockerPing.includes('bytes from');
      results.docker.output = dockerPing.trim();
    } catch {
      results.docker.hasInternet = false;
    }

    // 4. Per-instance checks
    const dockerOutput = await runCommand(
      'docker ps --filter "name=redroid-" --format "{{.Names}}"'
    ).catch(() => '');
    const containers = dockerOutput.split('\n').map((s) => s.trim()).filter(Boolean).sort();

    for (const cname of containers) {
      const num = cname.match(/(\d+)$/)?.[1];
      if (!num) continue;
      const port = 5554 + parseInt(num, 10);
      const serial = `localhost:${port}`;

      const inst = { name: cname, port, serial, checks: {} };

      // Container route
      try {
        const routes = await runCommand(`docker exec ${cname} ip route show`);
        inst.checks.hasDefaultRoute = routes.includes('default');
        inst.checks.routes = routes.trim();
      } catch {
        inst.checks.hasDefaultRoute = false;
      }

      // Container ping
      try {
        const out = await runCommand(`docker exec ${cname} ping -c 1 -W 3 8.8.8.8`);
        inst.checks.containerPing = out.includes('bytes from');
      } catch {
        inst.checks.containerPing = false;
      }

      // Container DNS
      try {
        const out = await runCommand(`docker exec ${cname} ping -c 1 -W 3 google.com`);
        inst.checks.containerDns = out.includes('bytes from');
      } catch {
        inst.checks.containerDns = false;
      }

      // ADB status
      const adbDevices = await runCommand('adb devices').catch(() => '');
      inst.checks.adbConnected = adbDevices.includes(`${serial}\tdevice`);

      // ADB pings (multiple targets)
      if (inst.checks.adbConnected) {
        const targets = ['8.8.8.8', 'google.com', '1.1.1.1', 'shopee.co.id'];
        inst.checks.adbPings = await Promise.all(targets.map((h) => pingTest(h, serial)));
      } else {
        inst.checks.adbPings = [];
      }

      results.instances.push(inst);
    }

    res.json({ success: true, results, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/internet/ping — custom ping test
const customPing = async (req, res) => {
  const { host, serial } = req.body;
  if (!host || typeof host !== 'string') {
    return res.status(400).json({ error: 'host is required' });
  }
  // Validate host to prevent command injection
  if (!/^[a-zA-Z0-9._-]+$/.test(host)) {
    return res.status(400).json({ error: 'Invalid host format' });
  }
  if (serial && !/^localhost:\d+$/.test(serial)) {
    return res.status(400).json({ error: 'Invalid serial format' });
  }

  try {
    const result = await pingTest(host, serial || null);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/internet/fix — auto-fix internet issues
const fixInternet = async (req, res) => {
  const logs = [];
  const log = (msg, status = 'info') => logs.push({ message: msg, status, time: new Date().toISOString() });

  try {
    // 1. IP forwarding
    const ipfwd = (await runCommand('cat /proc/sys/net/ipv4/ip_forward').catch(() => '0')).trim();
    if (ipfwd !== '1') {
      log('IP forwarding disabled — fixing...', 'warning');
      await runCommand('sudo -n sysctl -w net.ipv4.ip_forward=1').catch(() => {});
      log('IP forwarding enabled', 'success');
    } else {
      log('IP forwarding already enabled', 'success');
    }

    // 2. nftables rules
    try {
      const nftOutput = await runCommand('sudo -n nft list chain inet filter forward 2>/dev/null || echo "no-chain"');
      if (nftOutput.includes('no-chain')) {
        log('No inet filter forward chain — no fix needed', 'success');
      } else if (nftOutput.includes('docker0') && nftOutput.includes('accept')) {
        log('Docker forwarding rules already present', 'success');
      } else {
        log('Adding Docker forwarding rules...', 'warning');
        await runCommand('sudo -n nft add rule inet filter forward iifname "docker0" accept');
        await runCommand('sudo -n nft add rule inet filter forward oifname "docker0" ct state related,established accept');
        await runCommand('sudo -n nft add rule inet filter forward iifname "br-*" accept');
        await runCommand('sudo -n nft add rule inet filter forward oifname "br-*" ct state related,established accept');
        log('Docker forwarding rules added', 'success');
      }
    } catch (err) {
      log(`nftables fix failed: ${err.message}`, 'error');
    }

    // 3. NAT masquerade
    try {
      const subnet = (await runCommand(
        "docker network inspect bridge --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}'"
      ).catch(() => '172.17.0.0/16')).trim();
      try {
        await runCommand(`sudo -n iptables -t nat -C POSTROUTING -s ${subnet} ! -o docker0 -j MASQUERADE 2>/dev/null`);
        log(`NAT masquerade for ${subnet} already exists`, 'success');
      } catch {
        await runCommand(`sudo -n iptables -t nat -A POSTROUTING -s ${subnet} ! -o docker0 -j MASQUERADE`);
        log(`NAT masquerade added for ${subnet}`, 'success');
      }
    } catch (err) {
      log(`NAT fix: ${err.message}`, 'error');
    }

    // 4. Per-instance DNS + captive portal fix
    const dockerOutput = await runCommand(
      'docker ps --filter "name=redroid-" --format "{{.Names}}"'
    ).catch(() => '');
    const containers = dockerOutput.split('\n').map((s) => s.trim()).filter(Boolean);

    for (const cname of containers) {
      const num = cname.match(/(\d+)$/)?.[1];
      if (!num) continue;
      const port = 5554 + parseInt(num, 10);
      const serial = `localhost:${port}`;

      log(`Fixing ${cname} (${serial})...`, 'info');

      // Ensure ADB connected
      await runCommand(`adb connect ${serial}`).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));

      // DNS properties
      const cmds = [
        `adb -s ${serial} shell "setprop net.dns1 8.8.8.8"`,
        `adb -s ${serial} shell "setprop net.dns2 8.8.4.4"`,
        `adb -s ${serial} shell "settings put global captive_portal_detection_enabled 0"`,
        `adb -s ${serial} shell "settings put global captive_portal_mode 0"`,
        `adb -s ${serial} shell "ndc resolver setnetdns 100 '' 8.8.8.8 8.8.4.4"`,
      ];

      for (const cmd of cmds) {
        try { await runCommand(cmd); } catch { /* best effort */ }
      }
      log(`${cname} DNS & captive portal configured`, 'success');
    }

    // 5. Verify
    let verified = false;
    try {
      const out = await runCommand('docker run --rm alpine ping -c 1 -W 3 8.8.8.8 2>&1');
      verified = out.includes('bytes from');
    } catch { /* ignored */ }
    log(verified ? 'Verification: Docker internet OK' : 'Verification: Docker still no internet — may need manual check', verified ? 'success' : 'warning');

    res.json({ success: true, logs, timestamp: new Date().toISOString() });
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    res.json({ success: false, logs, error: error.message, timestamp: new Date().toISOString() });
  }
};

module.exports = { getInternetStatus, customPing, fixInternet };
