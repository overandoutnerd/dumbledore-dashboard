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

    const { rows } = await db.query(`SELECT * FROM guild_settings WHERE guild_id = $1`, [guildId]);
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

        // access — single Bot Manager role, no separate Admin role anymore
        botManagerRoleId: s.bot_manager_role_id ?? null,
        botManagerRoleIsSet: s.bot_manager_role_id != null,

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

/** Just the Bot Manager role ID — used by the login flow, kept cheap/focused. */
export async function getBotManagerRoleId(guildId) {
    const { rows } = await db.query(`SELECT bot_manager_role_id FROM guild_settings WHERE guild_id = $1`, [
        guildId,
    ]);
    return rows[0]?.bot_manager_role_id ?? null;
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
