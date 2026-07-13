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

    port: Number(process.env.PORT || 3001),
    publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`,
    isProd: process.env.NODE_ENV === "production",
};
