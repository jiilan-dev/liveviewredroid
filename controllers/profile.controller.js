const { runCommand } = require('../lib/utils');
const fs = require('fs');
const path = require('path');

const PROFILES_DIR = path.join(__dirname, '..', 'data', 'profiles');

// Ensure profiles dir exists
const ensureProfilesDir = () => {
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }
};

// GET /api/profiles — list all saved profiles
const listProfiles = async (req, res) => {
  try {
    ensureProfilesDir();
    const entries = fs.readdirSync(PROFILES_DIR, { withFileTypes: true });
    const profiles = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const profilePath = path.join(PROFILES_DIR, entry.name);
      const metaPath = path.join(profilePath, '.profile-meta.json');

      let meta = {};
      if (fs.existsSync(metaPath)) {
        try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { /* ignore */ }
      }

      // Get dir size (fast estimate via du)
      let size = '—';
      try {
        const out = await runCommand(`du -sh "${profilePath}" 2>/dev/null`);
        size = out.split('\t')[0]?.trim() || '—';
      } catch { /* ignore */ }

      profiles.push({
        name: entry.name,
        size,
        label: meta.label || entry.name,
        note: meta.note || '',
        createdAt: meta.createdAt || null,
        lastUsed: meta.lastUsed || null,
      });
    }

    // Also check legacy instance-N dirs and report them
    const dataDir = path.join(__dirname, '..', 'data');
    const legacyDirs = fs.readdirSync(dataDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^instance-\d+$/.test(e.name));

    res.json({
      profiles: profiles.sort((a, b) => a.name.localeCompare(b.name)),
      legacyDirs: legacyDirs.map((e) => e.name),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/profiles — create new empty profile
const createProfile = async (req, res) => {
  try {
    ensureProfilesDir();
    const { name, label, note } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    // Only allow safe chars
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'name must be alphanumeric with - or _' });
    }

    const profilePath = path.join(PROFILES_DIR, name);
    if (fs.existsSync(profilePath)) {
      return res.status(409).json({ error: 'Profile already exists' });
    }

    fs.mkdirSync(profilePath, { recursive: true });

    const meta = {
      label: label || name,
      note: note || '',
      createdAt: new Date().toISOString(),
      lastUsed: null,
    };
    fs.writeFileSync(path.join(profilePath, '.profile-meta.json'), JSON.stringify(meta, null, 2));

    res.json({ success: true, profile: { name, ...meta, size: '0' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/profiles/:name — update profile metadata
const updateProfile = async (req, res) => {
  try {
    const { name } = req.params;
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid profile name' });
    }

    const profilePath = path.join(PROFILES_DIR, name);
    if (!fs.existsSync(profilePath)) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const metaPath = path.join(profilePath, '.profile-meta.json');
    let meta = {};
    if (fs.existsSync(metaPath)) {
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { /* ignore */ }
    }

    const { label, note } = req.body;
    if (label !== undefined) meta.label = label;
    if (note !== undefined) meta.note = note;

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    res.json({ success: true, profile: { name, ...meta } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/profiles/:name — delete a profile
const deleteProfile = async (req, res) => {
  try {
    const { name } = req.params;
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid profile name' });
    }

    const profilePath = path.join(PROFILES_DIR, name);
    if (!fs.existsSync(profilePath)) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Check not in use by a running container
    try {
      const running = await runCommand('docker ps --filter "name=redroid-" --format "{{.Names}}\t{{.Mounts}}"');
      if (running.includes(name)) {
        return res.status(409).json({ error: 'Profile is currently mounted by a running instance' });
      }
    } catch { /* ignore */ }

    fs.rmSync(profilePath, { recursive: true, force: true });
    res.json({ success: true, message: `Profile "${name}" deleted` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/profiles/import-legacy — import legacy instance-N dirs as profiles
const importLegacy = async (req, res) => {
  try {
    ensureProfilesDir();
    const dataDir = path.join(__dirname, '..', 'data');
    const legacyDirs = fs.readdirSync(dataDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^instance-\d+$/.test(e.name));

    if (legacyDirs.length === 0) {
      return res.json({ success: true, imported: 0, message: 'No legacy dirs found' });
    }

    const imported = [];
    for (const entry of legacyDirs) {
      const src = path.join(dataDir, entry.name);
      const dest = path.join(PROFILES_DIR, entry.name);

      if (fs.existsSync(dest)) {
        // Already imported
        continue;
      }

      // Move the directory
      fs.renameSync(src, dest);

      // Write meta
      const meta = {
        label: entry.name,
        note: `Imported from legacy ${entry.name}`,
        createdAt: new Date().toISOString(),
        lastUsed: null,
      };
      fs.writeFileSync(path.join(dest, '.profile-meta.json'), JSON.stringify(meta, null, 2));
      imported.push(entry.name);
    }

    res.json({ success: true, imported: imported.length, profiles: imported });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/profiles/duplicate/:name — duplicate a profile
const duplicateProfile = async (req, res) => {
  try {
    const { name } = req.params;
    const { newName } = req.body;

    if (!/^[a-zA-Z0-9_-]+$/.test(name) || !/^[a-zA-Z0-9_-]+$/.test(newName || '')) {
      return res.status(400).json({ error: 'Invalid profile name' });
    }

    const srcPath = path.join(PROFILES_DIR, name);
    const destPath = path.join(PROFILES_DIR, newName);

    if (!fs.existsSync(srcPath)) {
      return res.status(404).json({ error: 'Source profile not found' });
    }
    if (fs.existsSync(destPath)) {
      return res.status(409).json({ error: 'Destination profile already exists' });
    }

    await runCommand(`cp -a "${srcPath}" "${destPath}"`);

    const meta = {
      label: newName,
      note: `Duplicated from ${name}`,
      createdAt: new Date().toISOString(),
      lastUsed: null,
    };
    fs.writeFileSync(path.join(destPath, '.profile-meta.json'), JSON.stringify(meta, null, 2));

    res.json({ success: true, message: `Profile duplicated: ${name} → ${newName}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  importLegacy,
  duplicateProfile,
  PROFILES_DIR,
};
