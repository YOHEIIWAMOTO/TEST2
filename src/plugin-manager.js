const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');
const MARKETPLACES_FILE = path.join(CONFIG_DIR, 'marketplaces.json');
const INSTALLED_FILE = path.join(CONFIG_DIR, 'installed.json');

function ensureConfig() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  if (!fs.existsSync(MARKETPLACES_FILE)) fs.writeFileSync(MARKETPLACES_FILE, '{}');
  if (!fs.existsSync(INSTALLED_FILE)) fs.writeFileSync(INSTALLED_FILE, '{}');
}

function loadJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Register a marketplace source (GitHub repository).
 * Format: owner/repo
 */
function addMarketplace(repoPath) {
  ensureConfig();
  const parts = repoPath.split('/');
  if (parts.length !== 2) {
    throw new Error(`Invalid marketplace format: "${repoPath}". Expected "owner/repo".`);
  }

  const [owner, repo] = parts;
  const marketplaces = loadJSON(MARKETPLACES_FILE);

  if (marketplaces[repo]) {
    console.log(`Marketplace "${repo}" is already registered (${marketplaces[repo].url}).`);
    return;
  }

  marketplaces[repo] = {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
    addedAt: new Date().toISOString()
  };

  saveJSON(MARKETPLACES_FILE, marketplaces);
  console.log(`Marketplace added: ${repo} (${marketplaces[repo].url})`);
}

/**
 * Remove a marketplace source.
 */
function removeMarketplace(name) {
  ensureConfig();
  const marketplaces = loadJSON(MARKETPLACES_FILE);

  if (!marketplaces[name]) {
    throw new Error(`Marketplace "${name}" is not registered.`);
  }

  delete marketplaces[name];
  saveJSON(MARKETPLACES_FILE, marketplaces);
  console.log(`Marketplace removed: ${name}`);
}

/**
 * List all registered marketplaces.
 */
function listMarketplaces() {
  ensureConfig();
  const marketplaces = loadJSON(MARKETPLACES_FILE);
  const entries = Object.entries(marketplaces);

  if (entries.length === 0) {
    console.log('No marketplaces registered.');
    return;
  }

  console.log('Registered marketplaces:');
  for (const [name, info] of entries) {
    console.log(`  ${name} -> ${info.url} (added: ${info.addedAt})`);
  }
}

/**
 * Install a plugin from a marketplace.
 * Format: marketplace@plugin
 */
function installPlugin(specifier) {
  ensureConfig();
  const parts = specifier.split('@');
  if (parts.length !== 2) {
    throw new Error(`Invalid install format: "${specifier}". Expected "marketplace@plugin".`);
  }

  const [marketplace, pluginName] = parts;
  const marketplaces = loadJSON(MARKETPLACES_FILE);

  if (!marketplaces[marketplace]) {
    throw new Error(`Marketplace "${marketplace}" is not registered. Add it first with: plugin marketplace add <owner/repo>`);
  }

  const installed = loadJSON(INSTALLED_FILE);
  const pluginKey = `${marketplace}@${pluginName}`;

  if (installed[pluginKey]) {
    console.log(`Plugin "${pluginKey}" is already installed.`);
    return;
  }

  const marketplaceInfo = marketplaces[marketplace];
  const pluginDir = path.join(PLUGINS_DIR, pluginName);

  console.log(`Installing plugin "${pluginName}" from marketplace "${marketplace}"...`);
  console.log(`  Source: ${marketplaceInfo.url}`);

  // Clone the plugin from the marketplace repository
  try {
    if (fs.existsSync(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true });
    }
    execSync(
      `git clone --depth 1 ${marketplaceInfo.url} "${pluginDir}"`,
      { stdio: 'pipe' }
    );
    console.log(`  Cloned repository to plugins/${pluginName}`);
  } catch (err) {
    // If clone fails, create a placeholder directory with manifest
    console.log(`  Note: Could not clone from remote. Creating local plugin entry.`);
    fs.mkdirSync(pluginDir, { recursive: true });
    const manifest = {
      name: pluginName,
      marketplace,
      source: marketplaceInfo.url,
      version: '1.0.0'
    };
    fs.writeFileSync(
      path.join(pluginDir, 'plugin.json'),
      JSON.stringify(manifest, null, 2) + '\n'
    );
  }

  installed[pluginKey] = {
    name: pluginName,
    marketplace,
    source: marketplaceInfo.url,
    installedAt: new Date().toISOString(),
    path: `plugins/${pluginName}`
  };

  saveJSON(INSTALLED_FILE, installed);
  console.log(`Plugin installed: ${pluginKey}`);
}

/**
 * Uninstall a plugin.
 * Format: marketplace@plugin
 */
function uninstallPlugin(specifier) {
  ensureConfig();
  const installed = loadJSON(INSTALLED_FILE);

  if (!installed[specifier]) {
    throw new Error(`Plugin "${specifier}" is not installed.`);
  }

  const pluginInfo = installed[specifier];
  const pluginDir = path.join(PLUGINS_DIR, pluginInfo.name);

  if (fs.existsSync(pluginDir)) {
    fs.rmSync(pluginDir, { recursive: true });
  }

  delete installed[specifier];
  saveJSON(INSTALLED_FILE, installed);
  console.log(`Plugin uninstalled: ${specifier}`);
}

/**
 * List all installed plugins.
 */
function listPlugins() {
  ensureConfig();
  const installed = loadJSON(INSTALLED_FILE);
  const entries = Object.entries(installed);

  if (entries.length === 0) {
    console.log('No plugins installed.');
    return;
  }

  console.log('Installed plugins:');
  for (const [key, info] of entries) {
    console.log(`  ${key} (installed: ${info.installedAt}, path: ${info.path})`);
  }
}

module.exports = {
  addMarketplace,
  removeMarketplace,
  listMarketplaces,
  installPlugin,
  uninstallPlugin,
  listPlugins
};
