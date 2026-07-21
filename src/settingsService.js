import { db, ensureGuildSettings } from "./db.js";
import { config } from "./config.js";

const HOUSE_COLUMNS = {
    gryffindor: "gryffindor_role_id",
    ravenclaw: "ravenclaw_role_id",
    hufflepuff: "hufflepuff_role_id",
    slytherin: "slytherin_role_id",
};

/**
 * Full settings summary. Mirrors the bot's own guildSettingsService.ts
 * exactly: numeric tunables fall back to the hard-coded constants when
 * unset, but role IDs (Bot Manager, house roles) have NO fallback ID —
 * they're either configured via /guild-settings or they're null. The bot
 * itself falls back to checking the native Discord Administrator
 * permission only when botManagerRoleId is null; it never invents a
 * default role ID, so neither do we.
 */
export async function getGuildSettingsSummary(guildId) {
    await ensureGuildSettings(guildId);

    const [{ rows }, botManagerRoleIds] = await Promise.all([
        db.query(`SELECT * FROM guild_settings WHERE guild_id = $1`, [guildId]),
        getBotManagerRoleIds(guildId),
    ]);
    const s = rows[0] || {};
    const d = config.defaults;

    return {
        // toggles / channels
        logsEnabled: !!s.logs_enabled,
        logChannelId: s.log_channel_id,
        welcomeEnabled: !!s.welcome_enabled,
        welcomeChannelId: s.welcome_channel_id,
        starboardEnabled: !!s.starboard_enabled,
        starboardChannelId: s.starboard_channel_id,
        azkabanEnabled: !!s.azkaban_enabled,
        azkabanRoleId: s.azkaban_role_id,
        sortingHatEnabled: !!s.sorting_hat_enabled,
        sortingHatChannelId: s.sorting_hat_channel_id,
        bumpEnabled: !!s.bump_enabled,
        levelingEnabled: !!s.leveling_enabled,
        aiResponseEnabled: !!s.ai_response_enabled,
        aiResponseProbability: s.ai_response_probability ?? 0.1,

        // access — any number of Bot Manager roles, no separate Admin role
        botManagerRoleIds,

        // house roles — no fallback ID, null means "not configured yet"
        gryffindorRoleId: s.gryffindor_role_id ?? null,
        ravenclawRoleId: s.ravenclaw_role_id ?? null,
        hufflepuffRoleId: s.hufflepuff_role_id ?? null,
        slytherinRoleId: s.slytherin_role_id ?? null,

        // numeric tunables — these DO have hard-coded fallback defaults on the bot
        xpPerMessage: s.xp_per_message ?? d.xpPerMessage,
        xpCooldownSeconds: s.xp_cooldown_seconds ?? d.xpCooldownSeconds,
        housePointValue: s.house_point_value ?? d.housePointValue,
        starboardThreshold: s.starboard_threshold ?? d.starboardThreshold,

        xpPerMessageIsDefault: s.xp_per_message == null,
        xpCooldownIsDefault: s.xp_cooldown_seconds == null,
        housePointValueIsDefault: s.house_point_value == null,
        starboardThresholdIsDefault: s.starboard_threshold == null,
    };
}

/** Bot Manager role IDs (guild_bot_manager_roles table) — used by the login
 * flow, kept cheap/focused. Anyone holding ANY one of these roles counts
 * as a Bot Manager; an empty list falls back to native Administrator. */
export async function getBotManagerRoleIds(guildId) {
    const { rows } = await db.query(`SELECT role_id FROM guild_bot_manager_roles WHERE guild_id = $1`, [
        guildId,
    ]);
    return rows.map((r) => r.role_id);
}

export async function addBotManagerRole(guildId, roleId) {
    await db.query(
        `INSERT INTO guild_bot_manager_roles (guild_id, role_id) VALUES ($1, $2) ON CONFLICT (guild_id, role_id) DO NOTHING`,
        [guildId, roleId],
    );
}

export async function removeBotManagerRole(guildId, roleId) {
    await db.query(`DELETE FROM guild_bot_manager_roles WHERE guild_id = $1 AND role_id = $2`, [
        guildId,
        roleId,
    ]);
}

export function houseColumn(house) {
    return HOUSE_COLUMNS[house] || null;
}

/* ── Deluminator mod-only channel list (guild_mod_channels table) ──── */

export async function getModChannelIds(guildId) {
    const { rows } = await db.query(`SELECT channel_id FROM guild_mod_channels WHERE guild_id = $1`, [
        guildId,
    ]);
    return rows.map((r) => r.channel_id);
}

export async function addModChannel(guildId, channelId) {
    await db.query(
        `INSERT INTO guild_mod_channels (guild_id, channel_id) VALUES ($1, $2) ON CONFLICT (guild_id, channel_id) DO NOTHING`,
        [guildId, channelId],
    );
}

export async function removeModChannel(guildId, channelId) {
    await db.query(`DELETE FROM guild_mod_channels WHERE guild_id = $1 AND channel_id = $2`, [
        guildId,
        channelId,
    ]);
}

/* ── Custom welcome messages (guild_welcome_messages table) ─────────
 * Replaces the bot's old hard-coded welcomeMessages.ts array. Each guild
 * can have any number of these, built via the dashboard's welcome message
 * editor; the bot picks one at random on every member join. */

function mapWelcomeMessageRow(row) {
    return {
        // pg returns bigint columns as strings; convert so the frontend's
        // `m.id === id` lookup (id passed in from an onclick handler, which
        // is a numeric literal) doesn't silently fail on a type mismatch.
        id: Number(row.id),
        outsideMessage: row.outside_message,
        embedAuthorName: row.embed_author_name,
        embedAuthorIconUrl: row.embed_author_icon_url,
        embedTitle: row.embed_title,
        embedDescription: row.embed_description,
        embedColor: row.embed_color,
        embedImageUrl: row.embed_image_url,
        embedThumbnailUrl: row.embed_thumbnail_url,
        embedFooterText: row.embed_footer_text,
        embedFooterIconUrl: row.embed_footer_icon_url,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
    };
}

export async function listWelcomeMessages(guildId) {
    const { rows } = await db.query(
        `SELECT * FROM guild_welcome_messages WHERE guild_id = $1 ORDER BY created_at ASC`,
        [guildId],
    );
    return rows.map(mapWelcomeMessageRow);
}

const WELCOME_MESSAGE_FIELDS = [
    ["outsideMessage", "outside_message"],
    ["embedAuthorName", "embed_author_name"],
    ["embedAuthorIconUrl", "embed_author_icon_url"],
    ["embedTitle", "embed_title"],
    ["embedDescription", "embed_description"],
    ["embedColor", "embed_color"],
    ["embedImageUrl", "embed_image_url"],
    ["embedThumbnailUrl", "embed_thumbnail_url"],
    ["embedFooterText", "embed_footer_text"],
    ["embedFooterIconUrl", "embed_footer_icon_url"],
];

export async function createWelcomeMessage(guildId, body) {
    const now = Date.now();
    const columns = ["guild_id", "created_at", "updated_at"];
    const values = [guildId, now, now];
    const placeholders = ["$1", "$2", "$3"];

    for (const [bodyKey, column] of WELCOME_MESSAGE_FIELDS) {
        columns.push(column);
        values.push(body[bodyKey] ?? null);
        placeholders.push(`$${values.length}`);
    }

    const { rows } = await db.query(
        `INSERT INTO guild_welcome_messages (${columns.join(", ")})
         VALUES (${placeholders.join(", ")})
         RETURNING *`,
        values,
    );
    return mapWelcomeMessageRow(rows[0]);
}

export async function updateWelcomeMessage(guildId, id, body) {
    const sets = ["updated_at = $1"];
    const values = [Date.now()];

    for (const [bodyKey, column] of WELCOME_MESSAGE_FIELDS) {
        if (!(bodyKey in body)) continue;
        values.push(body[bodyKey] ?? null);
        sets.push(`${column} = $${values.length}`);
    }

    values.push(guildId, id);
    const { rows } = await db.query(
        `UPDATE guild_welcome_messages
         SET ${sets.join(", ")}
         WHERE guild_id = $${values.length - 1} AND id = $${values.length}
         RETURNING *`,
        values,
    );
    return rows[0] ? mapWelcomeMessageRow(rows[0]) : null;
}

export async function deleteWelcomeMessage(guildId, id) {
    await db.query(`DELETE FROM guild_welcome_messages WHERE guild_id = $1 AND id = $2`, [
        guildId,
        id,
    ]);
}
