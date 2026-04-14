# @peersyst/agent-config

Opinionated Claude Code defaults for Peersyst engineers. Installs security-hardened settings and a statusline to your project's `.claude/` directory.

## Quick start

Run from your project root:

```bash
npx @peersyst/agent-config
```

## What it installs

### Settings (`.claude/settings.json`)

- **Conversation history** kept for 365 days (default is 30)
- **Stable update channel** to avoid mid-task breakage
- **Project MCP servers disabled by default** to prevent untrusted repos from running arbitrary MCP servers

#### Permission deny rules

Blocks Claude from reading or modifying sensitive files:

| Category | What's blocked |
|----------|---------------|
| Destructive commands | `rm -rf`, `sudo`, `mkfs`, `dd`, pipe-to-shell (`curl/wget \| bash`) |
| Force operations | `git push --force`, `git reset --hard` |
| Shell config | Edits to `~/.bashrc`, `~/.zshrc`, `~/.profile`, `~/.bash_profile`, `~/.ssh/` |
| Credentials | Reads from `~/.ssh/`, `~/.gnupg/`, `~/.aws/`, `~/.azure/`, `~/.kube/`, `~/.docker/config.json`, `~/.git-credentials`, `~/.config/gh/` |
| Package manager tokens | `~/.npmrc`, `~/.npm/`, `~/.pypirc`, `~/.gem/credentials` |
| Wallet data (macOS) | Keychains, MetaMask, Electrum extension data |
| Wallet data (Linux) | Chrome, Chromium, Brave, and Firefox extension data |

#### Hooks

- **Block direct push to main/master** — enforces feature branch workflow
- **Block staging .env files** — prevents accidental secret commits

### Statusline (`.claude/statusline.sh`)

A two-line status bar at the bottom of your terminal:

```
[Opus 4.6] 📁 my-project │ 🌿 feat/new-api
████████⣿⣿⣿⣿ 67% │ $1.42 │ ⏳ 23m │ 🔄 85%
```

- **Context usage** — color-coded progress bar (green/yellow/red)
- **Session cost** — total API spend in USD
- **Duration** — how long the session has been running
- **Cache rate** — percentage of tokens served from prompt cache

Requires `jq`.

## Publishing

1. Bump the version in `package.json`
2. Create a GitHub release with a matching `vX.Y.Z` tag (e.g., `v0.1.0`)
3. The `publish.yml` workflow will automatically publish to npm

Requires an `NPM_TOKEN` secret in the repo (Settings > Secrets > Actions) with publish access to the `@peersyst` scope.

## Customization

The installer merges settings into your existing `.claude/settings.json` — it won't overwrite your project config. To customize after install, edit `.claude/settings.json` directly.

For project-specific instructions (toolchains, testing, conventions), use `/init` inside each repo.
