#!/usr/bin/env node

const {
  addMarketplace,
  removeMarketplace,
  listMarketplaces,
  installPlugin,
  uninstallPlugin,
  listPlugins,
  listSkills,
  rebuildSkillsRegistry
} = require('./plugin-manager');

const args = process.argv.slice(2);

function printUsage() {
  console.log(`Usage:
  plugin marketplace add <owner/repo>    Add a marketplace source
  plugin marketplace remove <name>       Remove a marketplace source
  plugin marketplace list                List registered marketplaces
  plugin install <marketplace@plugin>    Install a plugin (with skill integration)
  plugin uninstall <marketplace@plugin>  Uninstall a plugin (removes skills)
  plugin list                            List installed plugins
  plugin skills                          List all integrated skills
  plugin skills rebuild                  Rebuild skills registry from installed plugins
  plugin help                            Show this help message`);
}

function run() {
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'marketplace': {
        const subcommand = args[1];
        if (subcommand === 'add') {
          if (!args[2]) {
            console.error('Error: Missing marketplace path. Usage: plugin marketplace add <owner/repo>');
            process.exit(1);
          }
          addMarketplace(args[2]);
        } else if (subcommand === 'remove') {
          if (!args[2]) {
            console.error('Error: Missing marketplace name. Usage: plugin marketplace remove <name>');
            process.exit(1);
          }
          removeMarketplace(args[2]);
        } else if (subcommand === 'list') {
          listMarketplaces();
        } else {
          console.error(`Unknown marketplace subcommand: ${subcommand}`);
          printUsage();
          process.exit(1);
        }
        break;
      }

      case 'install': {
        if (!args[1]) {
          console.error('Error: Missing plugin specifier. Usage: plugin install <marketplace@plugin>');
          process.exit(1);
        }
        installPlugin(args[1]);
        break;
      }

      case 'uninstall': {
        if (!args[1]) {
          console.error('Error: Missing plugin specifier. Usage: plugin uninstall <marketplace@plugin>');
          process.exit(1);
        }
        uninstallPlugin(args[1]);
        break;
      }

      case 'list': {
        listPlugins();
        break;
      }

      case 'skills': {
        const subcommand = args[1];
        if (subcommand === 'rebuild') {
          const allSkills = rebuildSkillsRegistry();
          console.log(`Skills registry rebuilt: ${Object.keys(allSkills).length} skill(s)`);
        } else {
          listSkills();
        }
        break;
      }

      case 'help': {
        printUsage();
        break;
      }

      default: {
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
      }
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

run();
