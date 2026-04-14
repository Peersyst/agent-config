# agent-config

npm package (`@peersyst/agent-config`) that installs opinionated Claude Code defaults for Peersyst engineers.

## Structure

- `settings.json` — Claude Code settings template (permissions, hooks, statusline config)
- `scripts/statusline.sh` — single-line terminal status bar, requires `jq`
- `bin/install.js` — interactive installer that merges settings into `~/.claude/`
- `package.json` — npm package with bin entry for `npx @peersyst/agent-config`

## Rules

- `settings.json` is the source of truth for org-wide security defaults — never weaken deny rules or remove hooks without explicit approval
- The installer must merge into existing user config, never overwrite
- `statusline.sh` must work with only `jq` as a dependency
- Keep the package zero-dependency — the installer uses only Node built-ins
