import { config } from "./config.js";

const API = "https://discord.com/api/v10";

class DiscordApiError extends Error {
    constructor(status, body) {
        super(`Discord API error ${status}: ${JSON.stringify(body)}`);
        this.status = status;
        this.body = body;
    }
}

async function botFetch(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            Authorization: `Bot ${config.discord.token}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new DiscordApiError(res.status, body);
    }

    if (res.status === 204) return null;
    return res.json();
}

/* ── OAuth2 (user-side) ─────────────────────────────────────── */

export function buildAuthorizeUrl(state) {
    const params = new URLSearchParams({
        client_id: config.discord.clientId,
        redirect_uri: config.discord.redirectUri,
        response_type: "code",
        scope: "identify guilds",
        state,
        prompt: "none",
    });

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
    const body = new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.discord.redirectUri,
    });

    const res = await fetch(`${API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new DiscordApiError(res.status, errBody);
    }

    return res.json(); // { access_token, token_type, expires_in, refresh_token, scope }
}

export async function getOAuthUser(accessToken) {
    const res = await fetch(`${API}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
        throw new DiscordApiError(res.status, await res.json().catch(() => ({})));
    }

    return res.json(); // { id, username, global_name, avatar, ... }
}

/**
 * Every guild the signed-in Discord user belongs to, using their OAuth
 * token (requires the `guilds` scope). Each entry includes Discord's own
 * precomputed `permissions` bitfield for that user in that guild, so we
 * don't need a bot-token role lookup just to check Administrator/Manage
 * Server for the server picker.
 */
export async function getUserGuilds(accessToken) {
    const res = await fetch(`${API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
        throw new DiscordApiError(res.status, await res.json().catch(() => ({})));
    }

    return res.json(); // [{ id, name, icon, owner, permissions, ... }]
}

let botGuildsCache = { at: 0, data: [] };
const BOT_GUILDS_TTL_MS = 60 * 1000;

/** Every guild the bot itself is in, cached briefly since the picker can be opened often. */
export async function getBotGuilds() {
    if (Date.now() - botGuildsCache.at < BOT_GUILDS_TTL_MS) {
        return botGuildsCache.data;
    }

    const data = await botFetch(`/users/@me/guilds`);
    botGuildsCache = { at: Date.now(), data };
    return data;
}

/* ── Bot-side (privileged) ──────────────────────────────────── */

export function getGuild(guildId, { withCounts = true } = {}) {
    return botFetch(`/guilds/${guildId}${withCounts ? "?with_counts=true" : ""}`);
}

export function getGuildRoles(guildId) {
    return botFetch(`/guilds/${guildId}/roles`);
}

export function getGuildChannels(guildId) {
    return botFetch(`/guilds/${guildId}/channels`);
}

export function getGuildMember(guildId, userId) {
    return botFetch(`/guilds/${guildId}/members/${userId}`).catch((err) => {
        if (err.status === 404) return null;
        throw err;
    });
}

export function listGuildMembers(guildId, limit = 1000) {
    return botFetch(`/guilds/${guildId}/members?limit=${limit}`);
}

export function searchGuildMembers(guildId, query, limit = 10) {
    return botFetch(
        `/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    );
}

export function setMemberRoles(guildId, userId, roleIds) {
    return botFetch(`/guilds/${guildId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ roles: roleIds }),
    });
}

export function patchBotProfile(guildId, patch) {
    // patch: { nick?, avatar?: dataUri|null, banner?: dataUri|null }
    return botFetch(`/guilds/${guildId}/members/@me`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
}

/* ── Permission math ────────────────────────────────────────── */

export const PERMISSIONS = {
    ADMINISTRATOR: 0x8n,
    MANAGE_GUILD: 0x20n,
    MANAGE_ROLES: 1n << 28n,
};

export function computePermissions(member, guildRoles, guild) {
    const roleMap = new Map(guildRoles.map((r) => [r.id, r]));
    const everyone = roleMap.get(guild.id);

    let perms = BigInt(everyone?.permissions ?? "0");

    for (const roleId of member.roles) {
        const role = roleMap.get(roleId);
        if (role) perms |= BigInt(role.permissions);
    }

    if (member.user?.id === guild.owner_id) {
        perms |= PERMISSIONS.ADMINISTRATOR;
    }

    if ((perms & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR) {
        // Administrator implies everything.
        return {
            raw: perms,
            isAdministrator: true,
            canManageGuild: true,
            canManageRoles: true,
        };
    }

    return {
        raw: perms,
        isAdministrator: false,
        canManageGuild: (perms & PERMISSIONS.MANAGE_GUILD) === PERMISSIONS.MANAGE_GUILD,
        canManageRoles: (perms & PERMISSIONS.MANAGE_ROLES) === PERMISSIONS.MANAGE_ROLES,
    };
}

export { DiscordApiError };

/**
 * Exact mirror of the bot's own src/utils/permissions.ts isBotManager().
 * If a guild has configured a Bot Manager role, ONLY that role counts —
 * native Administrator does not override it. If no role is configured,
 * native Administrator is the fallback. No other tier exists.
 */
export function isBotManagerFor(member, botManagerRoleId, nativeIsAdministrator) {
    if (botManagerRoleId) {
        return member.roles.includes(botManagerRoleId);
    }
    return nativeIsAdministrator;
}
