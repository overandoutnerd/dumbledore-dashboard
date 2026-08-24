# Dumbledore Mod Dashboard — Backend

A real backend for the mod dashboard: Discord OAuth2 login, gated by your
server's actual roles/permissions, reading and writing the **same Postgres
database** your Dumbledore bot already uses.

Nothing here is mock data. Home, Commands, Bot, and Settings all read live
rows from `users`, `house_points`, `azkaban_prisoners`, `guild_settings`,
`sorting_logs`, `starboard_messages`, and `member_history`, and avatar/
banner/nickname/role changes go out over Discord's real REST API using your
bot's token.

## How it works

- **Auth**: "Continue with Discord" → OAuth2 (`identify` scope only) →
  the server looks up your member record and permissions in your guild
  *using the bot's token* (no extra Discord scopes needed) → if you have
  Administrator, Manage Server, Manage Roles, or the configured Admin/Bot
  Manager role, you get a signed, httpOnly session cookie (JWT, 12h expiry).
- **Data**: a `pg` Pool connects to the same `DATABASE_URL` as the bot.
  Nothing is duplicated — it's the same tables, live.
- **Bot identity / role changes**: proxied through Discord's REST API with
  your `DISCORD_TOKEN`, exactly like the bot's own `/set-avatar`, `/pardon`,
  `/sentence` commands do.
- **Permission gates**: every write endpoint re-checks the caller's Discord
  permissions server-side (never trusts the frontend). The UI also disables
  controls the signed-in user can't use, with a 🔒 note explaining why.

## 1. Install

```bash
npm install
```

## 2. Configure

```bash
cp .env.example .env
```

Fill in:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Same Postgres connection string your bot's `.env` uses |
| `DISCORD_TOKEN` | Same bot token from `.env` |
| `DISCORD_CLIENT_ID` | Discord Developer Portal → your app → General Information |
| `DISCORD_CLIENT_SECRET` | Same page → "Reset Secret" if you don't have it saved |
| `DISCORD_REDIRECT_URI` | e.g. `http://localhost:3001/auth/callback` — **must** also be added under OAuth2 → Redirects in the Developer Portal |
| `GUILD_ID` | Your DesiPotterheads server ID |
| `ADMIN_ROLE_ID` / `BOT_MANAGER_ROLE_ID` | Defaults already match `constants.ts` — change only if you edit the bot's roles |
| `SESSION_SECRET` | Any long random string, e.g. `openssl rand -hex 32` |

Two Discord Portal settings to double check:
1. **Privileged Gateway Intents → Server Members Intent** must be ON (your
   bot already needs this for the leaderboard/XP system, so it should
   already be enabled).
2. **OAuth2 → Redirects** must include your exact `DISCORD_REDIRECT_URI`.

## 3. Run

```bash
npm run dev      # auto-restarts on file changes
# or
npm start
```

Visit `http://localhost:3001`. You'll land on the login gate; sign in with
a Discord account that has Administrator, Manage Server, Manage Roles, or
one of the two configured roles in your server.

## 4. Deploy

Run it anywhere that can run Node 18+ and reach your Postgres database
(Railway, Render, Fly.io, a VPS next to the bot, etc.) — it's a normal
Express app, no special hosting requirements. Set `NODE_ENV=production` and
`PUBLIC_URL`/`DISCORD_REDIRECT_URI` to your real HTTPS URL, and update the
redirect in the Discord Developer Portal to match.

## What's real vs. what's a known gap

**Real / live:**
- House Cup points, XP leaderboard, Azkaban roster (active + release
  history), server settings, recent activity feed — all straight from
  Postgres.
- Sentencing and pardoning actually strip/restore Discord roles via the
  bot's REST credentials and update the database, same as the slash
  commands.
- Avatar, banner, and nickname changes call Discord's real
  `PATCH /guilds/{id}/members/@me` endpoint.
- Settings toggles/channels/roles write straight to `guild_settings` and
  take effect for the bot immediately (it reads the same table).

**Known gaps** (flagged in the UI rather than faked):
- There's no per-message timestamp log in the schema, so "messages today"
  isn't available — the dashboard shows lifetime total messages instead.
- Bot uptime/ping/gateway status isn't shown, since this server only holds
  Discord's REST credentials, not a live gateway connection to the bot
  process itself. (If you want this, the bot could write a heartbeat row
  to Postgres periodically and this server can read it — happy to wire
  that up if useful.)

## File map

```
src/
  config.js        env var loading
  db.js             Postgres pool (same DB as the bot)
  discord.js        Discord REST + OAuth helpers, permission math
  memberCache.js     5-minute in-memory guild member cache (usernames/avatars)
  auth.js            JWT session cookie + permission-gate middleware
  commands.js        static command reference (mirrors bot.ts)
  routes/auth.js      /auth/login, /auth/callback, /auth/logout
  routes/api.js        all /api/* endpoints
  server.js            Express app entry
public/
  dashboard.html      the dashboard UI (fetches everything from /api/*)
```
