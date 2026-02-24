const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');
const PLUGINS_DIR = path.join(ROOT_DIR, 'plugins');
const SKILLS_DIR = path.join(ROOT_DIR, 'skills');
const MARKETPLACES_FILE = path.join(CONFIG_DIR, 'marketplaces.json');
const INSTALLED_FILE = path.join(CONFIG_DIR, 'installed.json');
const SKILLS_FILE = path.join(CONFIG_DIR, 'skills.json');

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
 * Parse SKILL.md YAML front matter to extract skill metadata.
 * YAML folded scalar (>) 形式に対応。
 */
function parseSkillFrontMatter(skillMdPath) {
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const meta = {};

  // name フィールド
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  if (nameMatch) meta.name = nameMatch[1].trim();

  // description フィールド — folded scalar (>) / literal (|) / インライン対応
  const descHeaderMatch = yaml.match(/^description:\s*([>|]|-?)?\s*$/m);
  if (descHeaderMatch) {
    // 複数行: "description: >" or "description: |" の後にインデントされた行
    const afterDesc = yaml.slice(yaml.indexOf(descHeaderMatch[0]) + descHeaderMatch[0].length);
    const lines = afterDesc.split('\n');
    const collected = [];
    for (const line of lines) {
      if (/^\s+\S/.test(line)) {
        collected.push(line.trim());
      } else if (collected.length > 0) {
        break;
      }
    }
    if (collected.length > 0) {
      meta.description = collected.join(' ');
    }
  } else {
    // インライン: "description: some text"
    const descInline = yaml.match(/^description:\s*(.+)$/m);
    if (descInline) meta.description = descInline[1].trim();
  }

  return meta.name ? meta : null;
}

/**
 * Scan a plugin directory for skills (subdirectories with SKILL.md).
 */
function discoverSkills(pluginDir, pluginName, marketplace) {
  const skillsRoot = path.join(pluginDir, 'skills');
  if (!fs.existsSync(skillsRoot)) return [];

  const entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(skillsRoot, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;

    const meta = parseSkillFrontMatter(skillMd);
    skills.push({
      id: `${pluginName}:${entry.name}`,
      dir: entry.name,
      name: meta ? meta.name : entry.name,
      description: meta ? meta.description : '',
      plugin: pluginName,
      marketplace,
      sourcePath: path.join('plugins', pluginName, 'skills', entry.name)
    });
  }
  return skills;
}

/**
 * Create symlinks from project skills/ to plugin skill directories.
 * Namespace: skills/<plugin>:<skill-dir> -> plugins/<plugin>/skills/<skill-dir>
 */
function linkSkills(skills) {
  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });

  for (const skill of skills) {
    const linkPath = path.join(SKILLS_DIR, skill.id);
    const targetPath = path.join(ROOT_DIR, skill.sourcePath);

    // 既存のリンクを削除してから再作成
    if (fs.existsSync(linkPath)) fs.rmSync(linkPath, { recursive: true });

    fs.symlinkSync(targetPath, linkPath);
  }
}

/**
 * Remove symlinks for a plugin's skills.
 */
function unlinkSkills(pluginName) {
  if (!fs.existsSync(SKILLS_DIR)) return;

  const prefix = `${pluginName}:`;
  const entries = fs.readdirSync(SKILLS_DIR);
  for (const entry of entries) {
    if (entry.startsWith(prefix)) {
      fs.rmSync(path.join(SKILLS_DIR, entry), { recursive: true });
    }
  }
}

/**
 * Rebuild config/skills.json and symlinks from all installed plugins.
 */
function rebuildSkillsRegistry() {
  ensureConfig();
  const installed = loadJSON(INSTALLED_FILE);
  const allSkills = {};

  // 既存の skills/ ディレクトリをクリーンアップ
  if (fs.existsSync(SKILLS_DIR)) {
    fs.rmSync(SKILLS_DIR, { recursive: true });
  }

  for (const [, info] of Object.entries(installed)) {
    const pluginDir = path.join(PLUGINS_DIR, info.name);
    if (!fs.existsSync(pluginDir)) continue;

    const skills = discoverSkills(pluginDir, info.name, info.marketplace);
    linkSkills(skills);
    for (const skill of skills) {
      allSkills[skill.id] = skill;
    }
  }

  saveJSON(SKILLS_FILE, allSkills);
  return allSkills;
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

  // スキル統合: 検出 → シンボリックリンク → レジストリ更新
  const skills = discoverSkills(pluginDir, pluginName, marketplace);
  if (skills.length > 0) {
    linkSkills(skills);
    const allSkills = rebuildSkillsRegistry();
    console.log(`  Integrated ${skills.length} skill(s):`);
    for (const s of skills) {
      console.log(`    - ${s.id} (${s.name})`);
    }
    console.log(`  Skills registry: config/skills.json (${Object.keys(allSkills).length} total)`);
    console.log(`  Symlinks created in: skills/`);
  }
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

  // スキルのシンボリックリンク削除 → プラグイン削除 → レジストリ更新
  unlinkSkills(pluginInfo.name);

  if (fs.existsSync(pluginDir)) {
    fs.rmSync(pluginDir, { recursive: true });
  }

  delete installed[specifier];
  saveJSON(INSTALLED_FILE, installed);
  rebuildSkillsRegistry();
  console.log(`Plugin uninstalled: ${specifier} (skills removed)`);
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

/**
 * List all integrated skills.
 */
function listSkills() {
  ensureConfig();
  if (!fs.existsSync(SKILLS_FILE)) {
    console.log('No skills registered.');
    return;
  }
  const skills = loadJSON(SKILLS_FILE);
  const entries = Object.entries(skills);

  if (entries.length === 0) {
    console.log('No skills registered.');
    return;
  }

  console.log(`Integrated skills (${entries.length}):`);
  for (const [id, info] of entries) {
    const desc = info.description ? ` - ${info.description.slice(0, 80)}` : '';
    console.log(`  ${id}${desc}`);
  }
}

module.exports = {
  addMarketplace,
  removeMarketplace,
  listMarketplaces,
  installPlugin,
  uninstallPlugin,
  listPlugins,
  listSkills,
  rebuildSkillsRegistry
};
