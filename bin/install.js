#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const PKG_ROOT = path.join(__dirname, "..");
const SRC_SETTINGS = path.join(PKG_ROOT, "settings.json");
const SRC_STATUSLINE = path.join(PKG_ROOT, "scripts", "statusline.sh");

function printHelp(exitCode = 0) {
  console.log(`
  Usage: npx @peersyst/agent-config [options]

  Options:
    --statusline        Include the statusline script
    --no-statusline     Skip statusline installation (default)
    --help              Show this help message

  You will always be prompted for the install location
  (project .claude/ or global ~/.claude/).
`);
  process.exit(exitCode);
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
        printHelp(1);
    }
  }
  return args;
}

let _rl;
const _lineQueue = [];
const _lineWaiters = [];
function _initRl() {
  if (_rl) return;
  _rl = readline.createInterface({ input: process.stdin });
  _rl.on("line", (line) => {
    if (_lineWaiters.length) _lineWaiters.shift()(line);
    else _lineQueue.push(line);
  });
}
function ask(question) {
  _initRl();
  process.stdout.write(question);
  return new Promise((resolve) => {
    const handle = (line) => resolve(line.trim().toLowerCase());
    if (_lineQueue.length) handle(_lineQueue.shift());
    else _lineWaiters.push(handle);
  });
}

function closeRl() {
  if (_rl) _rl.close();
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

  const settingsPath = path.join(claudeDir, "settings.json");
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  settings.statusLine = {
    type: "command",
    command: ".claude/statusline.sh",
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log("  Enabled statusLine hook in .claude/settings.json");
}

async function main() {
  const flags = parseArgs(process.argv);

  const projectRoot = findProjectRoot(process.cwd());

  console.log("\n  @peersyst/agent-config\n");
  console.log("  Installs Claude Code defaults\n");

  const choice = await ask(
    "  Install location: [P]roject (.claude/) or [G]lobal (~/.claude/)? [P/g] ",
  );
  const scope = choice === "g" || choice === "global" ? "global" : "project";

  const claudeDir =
    scope === "global"
      ? path.join(os.homedir(), ".claude")
      : path.join(projectRoot, ".claude");

  console.log("  Target: " + claudeDir + "\n");

  const prompt = flags.statusline
    ? "  Install settings.json + statusline? [Y/n] "
    : "  Install settings.json? [Y/n] ";

  const answer = await ask(prompt);
  closeRl();

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
