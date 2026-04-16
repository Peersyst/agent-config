#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const PKG_ROOT = path.join(__dirname, "..");
const SRC_SETTINGS = path.join(PKG_ROOT, "settings.json");
const SRC_STATUSLINE = path.join(PKG_ROOT, "scripts", "statusline.sh");

function printHelp() {
  console.log(`
  Usage: npx @peersyst/agent-config [options]

  Options:
    --statusline        Include the statusline script
    --no-statusline     Skip statusline installation (default)
    --help              Show this help message
`);
  process.exit(0);
}

function parseArgs(argv) {
  const args = { statusline: false };
  for (const arg of argv.slice(2)) {
    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        break;
      case "--statusline":
        args.statusline = true;
        break;
      case "--no-statusline":
        args.statusline = false;
        break;
      default:
        console.error(`  Unknown option: ${arg}\n`);
        printHelp();
    }
  }
  return args;
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function findProjectRoot(from) {
  let dir = from;
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, ".git")) ||
      fs.existsSync(path.join(dir, "package.json"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return from;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else if (Array.isArray(source[key])) {
      const existing = result[key] || [];
      const merged = [...existing];
      for (const item of source[key]) {
        const serialized = JSON.stringify(item);
        if (!merged.some((e) => JSON.stringify(e) === serialized)) {
          merged.push(item);
        }
      }
      result[key] = merged;
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

async function installSettings(claudeDir) {
  const settingsPath = path.join(claudeDir, "settings.json");
  const source = JSON.parse(fs.readFileSync(SRC_SETTINGS, "utf8"));

  if (fs.existsSync(settingsPath)) {
    const existing = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    const merged = deepMerge(existing, source);
    console.log("\n  Merging into existing .claude/settings.json...");
    console.log("    Preserving your existing keys");
    console.log("    Adding missing deny rules");
    console.log("    Adding missing hooks");
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + "\n");
    console.log("    Done.");
  } else {
    fs.writeFileSync(settingsPath, JSON.stringify(source, null, 2) + "\n");
    console.log("\n  Created .claude/settings.json");
  }
}

function installStatusline(claudeDir) {
  const statuslinePath = path.join(claudeDir, "statusline.sh");
  const content = fs.readFileSync(SRC_STATUSLINE, "utf8");
  fs.writeFileSync(statuslinePath, content);
  fs.chmodSync(statuslinePath, 0o755);
  console.log("  Installed .claude/statusline.sh");
}

async function main() {
  const projectRoot = findProjectRoot(process.cwd());

  console.log("\n  @peersyst/agent-config\n");
  console.log("  Installs Claude Code defaults to project .claude/");
  console.log("  Project: " + projectRoot + "\n");

  const claudeDir = path.join(projectRoot, ".claude");

  const flags = parseArgs(process.argv);

  const prompt = flags.statusline
    ? "  Install settings.json + statusline? [Y/n] "
    : "  Install settings.json? [Y/n] ";

  const answer = await ask(prompt);

  if (answer === "n" || answer === "no") {
    console.log("\n  Aborted.\n");
    process.exit(0);
  }

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  installSettings(claudeDir);
  if (flags.statusline) {
    installStatusline(claudeDir);
  }

  console.log("\n  All done. Restart Claude Code to pick up changes.\n");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
