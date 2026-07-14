import "dotenv/config";

function required(name) {
    const value = process.env[name];

    if (!value) {
        console.warn(
            `[config] ⚠️  Missing env var ${name} — the dashboard will not work correctly until it's set.`,
        );
    }

    return value ?? "";
}

export const config = {
    databaseUrl: required("DATABASE_URL"),

    discord: {
        token: required("DISCORD_TOKEN"),
        clientId: required("DISCORD_CLIENT_ID"),
        clientSecret: required("DISCORD_CLIENT_SECRET"),
        redirectUri: required("DISCORD_REDIRECT_URI"),
    },

    // No longer required — the dashboard now lists every mutual guild
    // (bot + user) and lets the user pick one after login.
    defaultGuildId: process.env.GUILD_ID || "",

    // Fallback numeric defaults only — mirrors src/config/constants.ts on
    // the bot exactly. The bot has NO hard-coded default role IDs anymore
    // (Bot Manager role, house roles): those are either configured per
    // guild via /guild-settings or simply unset (null). We do the same —
    // no invented role ID fallbacks anywhere in this dashboard.
    defaults: {
        xpPerMessage: 5,
        xpCooldownSeconds: 60,
        housePointValue: 50,
        starboardThreshold: 1,
    },

    sessionSecret: required("SESSION_SECRET"),
    sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 12),

    // Cloudflare R2 (S3-compatible) — used to store welcome-message embed
    // images/GIFs so they survive redeploys instead of living on local
    // disk under public/uploads. All four must be set for uploads to work;
    // accountId + bucket also build the public bucket URL if PUBLIC_URL
    // isn't overridden per-file.
    r2: {
        accountId: process.env.R2_ACCOUNT_ID || "",
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
        bucket: process.env.R2_BUCKET || "",
        // The bucket's public URL — either an r2.dev dev subdomain or a
        // custom domain you've mapped to the bucket. No trailing slash.
        publicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, ""),
    },

    port: Number(process.env.PORT || 3001),
    publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`,
    isProd: process.env.NODE_ENV === "production",

    // Session cookies were being set host-only (no Domain attribute), so a
    // cookie issued on "dumbledore.online" was invisible on
    // "www.dumbledore.online" and vice versa. The site is reachable on both
    // (www redirects to apex), and some navigations — notably Chrome's
    // "Request Desktop Site" reload on Android — can momentarily resolve
    // the other host before the redirect settles, which looked like a
    // random logout. Setting an explicit leading-dot domain makes the
    // cookie valid across both hosts. Only meaningful in prod; leave unset
    // for localhost (cookies don't support Domain=localhost).
    cookieDomain: (() => {
        if (!config_isProdHost()) return undefined;
        try {
            const host = new URL(process.env.PUBLIC_URL).hostname.replace(/^www\./, "");
            return `.${host}`;
        } catch {
            return undefined;
        }
    })(),
};

function config_isProdHost() {
    return process.env.NODE_ENV === "production" && !!process.env.PUBLIC_URL;
}
