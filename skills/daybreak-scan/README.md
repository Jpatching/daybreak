# Daybreak Scan — Automaton Skill

Scan Solana token deployers for rug history, reputation scores, and on-chain risk signals.

## Installation

### 1. Get a Bot API Key

Contact [@JPatchedit](https://x.com/JPatchedit) to request a `DAYBREAK_BOT_KEY`.

### 2. Set Environment Variable

Add to your automaton's environment (e.g. `~/.automaton/.env`):

```
DAYBREAK_BOT_KEY=your_key_here
```

### 3. Install the Skill

From your automaton's shell or via the agent:

```
install_skill(source="git", name="daybreak-scan", url="https://github.com/Jpatching/daybreak", path="skills/daybreak-scan")
```

Or manually copy `SKILL.md` to `~/.automaton/skills/daybreak-scan/SKILL.md`.

## What It Does

Once installed, your automaton can:

- **Scan any Solana token** by its mint address to get the deployer's reputation
- **Scan any wallet** to see their full deployment history and rug rate
- **Generate report card PNGs** for visual sharing

The skill instructs the agent to use `curl` with the bot key to call the Daybreak API. No SDK or library dependencies required.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/bot/deployer/:token` | GET | Scan token deployer |
| `/api/v1/bot/wallet/:wallet` | GET | Scan wallet directly |
| `/api/v1/report/bot/:token` | POST | Generate report card |
| `/api/v1/report/:token/twitter.png` | GET | Fetch report card PNG |

## Verdicts

| Verdict | Score Range | Meaning |
|---------|------------|---------|
| CLEAN | 60-100 | Low rug rate, healthy history |
| SUSPICIOUS | 30-59 | Moderate risk signals |
| SERIAL_RUGGER | 0-29 | High rug rate, many dead tokens |

## Links

- API: https://api.daybreakscan.com
- Web: https://www.daybreakscan.com
- GitHub: https://github.com/Jpatching/daybreak
