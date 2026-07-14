import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";

import { config } from "../config.js";
import { db, ensureGuildSettings } from "../db.js";
import {
    requireAuth,
    requireActiveGuild,
    requireManageGuild,
    requireManageRoles,
    requireBotManager,
} from "../auth.js";
import {
    getGuild,
    getGuildChannels,
    getGuildRoles,
    getGuildEmojis,
    getGuildMember,
    setMemberRoles,
    patchBotProfile,
    DiscordApiError,
} from "../discord.js";
import { ensureFresh, resolveMember, memberCount, searchCached } from "../memberCache.js";
import { COMMANDS } from "../commands.js";
import * as analytics from "../analytics.js";
import {
    getGuildSettingsSummary,
    getModChannelIds,
    addModChannel,
    removeModChannel,
    listWelcomeMessages,
    createWelcomeMessage,
    updateWelcomeMessage,
    deleteWelcomeMessage,
} from "../settingsService.js";
import { uploadImage, isR2Configured } from "../storage.js";

export const apiRouter = Router();
const upload = multer({ limits: { fileSize: 8 * 1024 * 1024 } }); // 8MB, Discord's own cap

/* ── /api/me — identity + which guild (if any) is active ──────────── */

apiRouter.get("/me", requireAuth, (req, res) => {
    const { discordAccessToken, ...safeUser } = req.user;
    res.json({ user: safeUser });
});

/* ── /api/commands (static reference, same list the bot registers; no guild needed) ── */

apiRouter.get("/commands", requireAuth, (_req, res) => {
    res.json({ commands: COMMANDS });
});

// Every route below operates on the signed-in user's currently selected
// guild (req.guildId, set once a guild is picked via /api/guilds/:id/select).
apiRouter.use(requireActiveGuild);

/* ── /api/stats — home tab summary ──────────────────────────────── */

apiRouter.get("/stats", requireAuth, async (req, res) => {
    try {
        await ensureFresh(req.guildId);

        const [guild, houseRes, prisonerRes, messageStats, summonStats] = await Promise.all([
            getGuild(req.guildId).catch(() => null),
            db.query(
                `SELECT house_name, points FROM house_points WHERE guild_id = $1 ORDER BY points DESC`,
                [req.guildId],
            ),
            db.query(
                `SELECT COUNT(*)::int AS count FROM azkaban_prisoners WHERE guild_id = $1 AND is_active = TRUE`,
                [req.guildId],
            ),
            analytics.getMessageStats(req.guildId),
            analytics.getSummonStats(req.guildId),
        ]);

        const leader = houseRes.rows[0] || null;
        const cachedCount = memberCount(req.guildId);

        res.json({
            memberCount: guild?.approximate_member_count ?? (cachedCount || null),
            messagesLast7Days: messageStats.thisWeek,
            messagesPrevious7Days: messageStats.previousWeek,
            messagesWeekDelta: messageStats.weekDelta,
            messagesToday: messageStats.today,
            messagesThisMonth: messageStats.thisMonth,
            messagesTotal: messageStats.total,
            summonsToday: summonStats.today,
            activePrisoners: prisonerRes.rows[0]?.count ?? 0,
            houseLeader: leader ? { house: leader.house_name, points: Number(leader.points) } : null,
        });
    } catch (err) {
        console.error("[api/stats]", err);
        res.status(502).json({ error: "upstream_error" });
    }
});

/* ── /api/analytics — full analytics dashboard data ───────────────── */

apiRouter.get("/analytics/overview", requireAuth, async (req, res) => {
    try {
        const [messages, summons, members, topCommands, totals] = await Promise.all([
            analytics.getMessageStats(req.guildId),
            analytics.getSummonStats(req.guildId),
            analytics.getMemberStats(req.guildId),
            analytics.getMostUsedCommands(req.guildId, 6),
            analytics.getGuildTotals(req.guildId),
        ]);
        res.json({ messages, summons, members, topCommands, totals });
    } catch (err) {
        console.error("[api/analytics/overview]", err);
        res.status(502).json({ error: "upstream_error" });
    }
});

apiRouter.get("/analytics/messages/daily", requireAuth, async (req, res) => {
    const days = Math.min(Number(req.query.days) || 14, 90);
    const graph = await analytics.getDailyMessageGraph(req.guildId, days);
    res.json({ graph });
});

apiRouter.get("/analytics/members/daily", requireAuth, async (req, res) => {
    const days = Math.min(Number(req.query.days) || 14, 90);
    const rows = await analytics.getMemberDailyRows(req.guildId, days);
    res.json({ rows });
});

apiRouter.get("/analytics/commands/top", requireAuth, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 10, 22);
    const [top, today] = await Promise.all([
        analytics.getMostUsedCommands(req.guildId, limit),
        analytics.getCommandUsageToday(req.guildId),
    ]);
    res.json({ top, today });
});

/* ── /api/houses — House Cup standings ──────────────────────────── */

apiRouter.get("/houses", requireAuth, async (req, res) => {
    const { rows } = await db.query(
        `SELECT house_name, points FROM house_points WHERE guild_id = $1 ORDER BY points DESC, house_name ASC`,
        [req.guildId],
    );

    const ALL_HOUSES = ["gryffindor", "ravenclaw", "hufflepuff", "slytherin"];
    const byName = new Map(rows.map((r) => [r.house_name, Number(r.points)]));

    const houses = ALL_HOUSES.map((name) => ({ house: name, points: byName.get(name) ?? 0 })).sort(
        (a, b) => b.points - a.points,
    );

    res.json({ houses });
});

apiRouter.post("/houses/:house/points", requireManageGuild, async (req, res) => {
    const { house } = req.params;
    const { delta } = req.body;

    if (!["gryffindor", "ravenclaw", "hufflepuff", "slytherin"].includes(house)) {
        return res.status(400).json({ error: "invalid_house" });
    }
    if (typeof delta !== "number" || !Number.isFinite(delta)) {
        return res.status(400).json({ error: "invalid_delta" });
    }

    const current = await db.query(
        `SELECT points FROM house_points WHERE guild_id = $1 AND house_name = $2`,
        [req.guildId, house],
    );

    const newPoints = Math.max(0, (Number(current.rows[0]?.points) || 0) + delta);

    await db.query(
        `
        INSERT INTO house_points (guild_id, house_name, points)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, house_name) DO UPDATE SET points = EXCLUDED.points
        `,
        [req.guildId, house, newPoints],
    );

    res.json({ house, points: newPoints });
});

/* ── /api/leaderboard ────────────────────────────────────────────── */

apiRouter.get("/leaderboard", requireAuth, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    await ensureFresh(req.guildId);

    const { rows } = await db.query(
        `
        SELECT user_id, xp, level, messages
        FROM users
        WHERE guild_id = $1
        ORDER BY xp DESC
        LIMIT $2
        `,
        [req.guildId, limit],
    );

    const leaderboard = rows.map((row, i) => {
        const member = resolveMember(req.guildId, row.user_id);
        return {
            rank: i + 1,
            userId: row.user_id,
            username: member.username,
            avatarUrl: member.avatarUrl,
            left: !!member.left,
            xp: Number(row.xp),
            level: Number(row.level),
            messages: Number(row.messages),
        };
    });

    res.json({ leaderboard });
});

/* ── /api/azkaban ─────────────────────────────────────────────────── */

apiRouter.get("/azkaban", requireAuth, async (req, res) => {
    await ensureFresh(req.guildId);

    const [activeRes, recentRes] = await Promise.all([
        db.query(
            `
            SELECT id, user_id, moderator_id, reason, jailed_at
            FROM azkaban_prisoners
            WHERE guild_id = $1 AND is_active = TRUE
            ORDER BY jailed_at DESC
            `,
            [req.guildId],
        ),
        db.query(
            `
            SELECT id, user_id, moderator_id, reason, jailed_at, released_at
            FROM azkaban_prisoners
            WHERE guild_id = $1 AND is_active = FALSE
            ORDER BY released_at DESC NULLS LAST
            LIMIT 10
            `,
            [req.guildId],
        ),
    ]);

    const mapRow = (row) => ({
        id: Number(row.id),
        user: resolveMember(req.guildId, row.user_id),
        moderator: resolveMember(req.guildId, row.moderator_id),
        reason: row.reason,
        jailedAt: Number(row.jailed_at),
        releasedAt: row.released_at ? Number(row.released_at) : null,
    });

    res.json({
        active: activeRes.rows.map(mapRow),
        recentReleases: recentRes.rows.map(mapRow),
    });
});

apiRouter.post("/azkaban/:id/pardon", requireManageRoles, async (req, res) => {
    const prisonerId = Number(req.params.id);

    try {
        const { rows } = await db.query(
            `SELECT * FROM azkaban_prisoners WHERE id = $1 AND guild_id = $2 AND is_active = TRUE`,
            [prisonerId, req.guildId],
        );

        const prisoner = rows[0];
        if (!prisoner) {
            return res.status(404).json({ error: "not_found_or_already_released" });
        }

        let savedRoles = [];
        try {
            savedRoles = JSON.parse(prisoner.roles_json || "[]");
        } catch {
            savedRoles = [];
        }

        // Restore roles via the bot's REST credentials (mirrors /pardon).
        await setMemberRoles(req.guildId, prisoner.user_id, savedRoles).catch((err) => {
            // A 404 here typically means the member left the server — DB state
            // should still be updated so the dashboard doesn't show a stuck prisoner.
            if (!(err instanceof DiscordApiError && err.status === 404)) throw err;
        });

        await db.query(
            `UPDATE azkaban_prisoners SET is_active = FALSE, released_at = $1 WHERE id = $2`,
            [Date.now(), prisonerId],
        );

        res.json({ ok: true, pardonedUserId: prisoner.user_id });
    } catch (err) {
        console.error("[api/azkaban/pardon]", err);
        res.status(502).json({ error: "pardon_failed" });
    }
});

apiRouter.post("/azkaban/sentence", requireManageRoles, async (req, res) => {
    const { userId, reason } = req.body;

    if (!userId || !reason || typeof reason !== "string") {
        return res.status(400).json({ error: "user_and_reason_required" });
    }
    if (userId === req.user.sub) {
        return res.status(400).json({ error: "cannot_sentence_self" });
    }

    try {
        const existing = await db.query(
            `SELECT 1 FROM azkaban_prisoners WHERE guild_id = $1 AND user_id = $2 AND is_active = TRUE`,
            [req.guildId, userId],
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "already_imprisoned" });
        }

        const [member, guild, settingsRes] = await Promise.all([
            getGuildMember(req.guildId, userId),
            getGuild(req.guildId, { withCounts: false }),
            db.query(`SELECT azkaban_enabled, azkaban_role_id FROM guild_settings WHERE guild_id = $1`, [
                req.guildId,
            ]),
        ]);

        if (!member) return res.status(404).json({ error: "member_not_found" });
        if (member.user?.bot) return res.status(400).json({ error: "cannot_sentence_bot" });
        if (userId === guild.owner_id) return res.status(400).json({ error: "cannot_sentence_owner" });

        const settings = settingsRes.rows[0];
        if (!settings?.azkaban_enabled || !settings?.azkaban_role_id) {
            return res.status(400).json({ error: "azkaban_not_configured" });
        }

        const savedRoles = (member.roles || []).filter((id) => id !== req.guildId);

        await db.query(
            `
            INSERT INTO azkaban_prisoners (guild_id, user_id, moderator_id, reason, jailed_at, released_at, is_active, roles_json)
            VALUES ($1, $2, $3, $4, $5, NULL, TRUE, $6)
            `,
            [req.guildId, userId, req.user.sub, reason, Date.now(), JSON.stringify(savedRoles)],
        );

        await setMemberRoles(req.guildId, userId, [settings.azkaban_role_id]);

        res.json({ ok: true });
    } catch (err) {
        console.error("[api/azkaban/sentence]", err);
        res.status(502).json({ error: "sentence_failed" });
    }
});

/* ── /api/members/search — user picker for the sentence form ─────── */

apiRouter.get("/members/search", requireManageRoles, async (req, res) => {
    await ensureFresh(req.guildId);
    const q = String(req.query.q || "");
    res.json({ results: searchCached(req.guildId, q) });
});

/* ── /api/activity — merged recent-activity feed for Home ────────── */

apiRouter.get("/activity", requireAuth, async (req, res) => {
    await ensureFresh(req.guildId);

    const [sorts, azkaban, stars, joins] = await Promise.all([
        db.query(
            `SELECT user_id, new_house, sorted_at FROM sorting_logs WHERE guild_id = $1 ORDER BY sorted_at DESC LIMIT 5`,
            [req.guildId],
        ),
        db.query(
            `SELECT user_id, moderator_id, reason, jailed_at, released_at, is_active FROM azkaban_prisoners WHERE guild_id = $1 ORDER BY jailed_at DESC LIMIT 5`,
            [req.guildId],
        ),
        db.query(
            `SELECT author_id, created_at FROM starboard_messages WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 5`,
            [req.guildId],
        ),
        db.query(
            `SELECT user_id, joined_at FROM member_history WHERE guild_id = $1 ORDER BY joined_at DESC LIMIT 5`,
            [req.guildId],
        ),
    ]);

    const events = [];

    for (const r of sorts.rows) {
        events.push({
            icon: "sortinghat",
            text: `${resolveMember(req.guildId, r.user_id).username} was sorted into ${cap(r.new_house)}`,
            time: Number(r.sorted_at),
        });
    }
    for (const r of azkaban.rows) {
        events.push({
            icon: "azkaban",
            text: `${resolveMember(req.guildId, r.user_id).username} was sent to Azkaban by ${resolveMember(req.guildId, r.moderator_id).username}`,
            time: Number(r.jailed_at),
        });
        if (r.released_at) {
            events.push({
                icon: "scroll",
                text: `${resolveMember(req.guildId, r.user_id).username} was released from Azkaban`,
                time: Number(r.released_at),
            });
        }
    }
    for (const r of stars.rows) {
        events.push({
            icon: "star",
            text: `A message from ${resolveMember(req.guildId, r.author_id).username} hit the starboard`,
            time: new Date(r.created_at).getTime(),
        });
    }
    for (const r of joins.rows) {
        events.push({
            icon: "join",
            text: `${resolveMember(req.guildId, r.user_id).username} joined the castle`,
            time: Number(r.joined_at),
        });
    }

    events.sort((a, b) => b.time - a.time);

    res.json({ activity: events.slice(0, 10) });
});

function cap(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/* ── /api/settings — server systems config ────────────────────────── */

apiRouter.get("/settings", requireAuth, async (req, res) => {
    const settings = await getGuildSettingsSummary(req.guildId);
    res.json(settings);
});

apiRouter.post("/settings", requireManageGuild, async (req, res) => {
    await ensureGuildSettings(req.guildId);

    const allowed = [
        ["logsEnabled", "logs_enabled", "bool"],
        ["logChannelId", "log_channel_id", "str"],
        ["welcomeEnabled", "welcome_enabled", "bool"],
        ["welcomeChannelId", "welcome_channel_id", "str"],
        ["starboardEnabled", "starboard_enabled", "bool"],
        ["starboardChannelId", "starboard_channel_id", "str"],
        ["azkabanEnabled", "azkaban_enabled", "bool"],
        ["azkabanRoleId", "azkaban_role_id", "str"],
        ["sortingHatEnabled", "sorting_hat_enabled", "bool"],
        ["sortingHatChannelId", "sorting_hat_channel_id", "str"],
        ["bumpEnabled", "bump_enabled", "bool"],
        ["levelingEnabled", "leveling_enabled", "bool"],

        // Access control — same fields /guild-settings edits in Discord.
        ["botManagerRoleId", "bot_manager_role_id", "str"],

        // House roles
        ["gryffindorRoleId", "gryffindor_role_id", "str"],
        ["ravenclawRoleId", "ravenclaw_role_id", "str"],
        ["hufflepuffRoleId", "hufflepuff_role_id", "str"],
        ["slytherinRoleId", "slytherin_role_id", "str"],

        // Tunables
        ["xpPerMessage", "xp_per_message", "int"],
        ["xpCooldownSeconds", "xp_cooldown_seconds", "int"],
        ["housePointValue", "house_point_value", "int"],
        ["starboardThreshold", "starboard_threshold", "int"],
    ];

    const sets = [];
    const values = [];
    let i = 1;

    for (const [bodyKey, column, kind] of allowed) {
        if (!(bodyKey in req.body)) continue;
        const raw = req.body[bodyKey];

        if (kind === "bool" && typeof raw !== "boolean") continue;
        if (kind === "str" && raw !== null && typeof raw !== "string") continue;
        if (kind === "int" && raw !== null && (typeof raw !== "number" || !Number.isFinite(raw))) continue;

        sets.push(`${column} = $${i}`);
        values.push(raw);
        i++;
    }

    if (sets.length === 0) {
        return res.status(400).json({ error: "no_valid_fields" });
    }

    values.push(req.guildId);
    await db.query(`UPDATE guild_settings SET ${sets.join(", ")} WHERE guild_id = $${i}`, values);

    res.json({ ok: true });
});

/* ── /api/channels & /api/roles — for settings dropdowns ──────────── */

apiRouter.get("/channels", requireAuth, async (req, res) => {
    try {
        const channels = await getGuildChannels(req.guildId);
        const textLike = channels
            .filter((c) => [0, 5, 15].includes(c.type)) // text, announcement, forum
            .map((c) => ({ id: c.id, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ channels: textLike });
    } catch (err) {
        console.error("[api/channels]", err);
        res.status(502).json({ error: "upstream_error" });
    }
});

apiRouter.get("/roles", requireAuth, async (req, res) => {
    try {
        const roles = await getGuildRoles(req.guildId);

        const assignable = roles
            .filter((r) => r.name !== "@everyone" && !r.managed)
            .map((r) => ({ id: r.id, name: r.name, color: r.color }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ roles: assignable });
    } catch (err) {
        console.error("[api/roles]", err);
        res.status(502).json({ error: "upstream_error" });
    }
});

apiRouter.get("/emojis", requireAuth, async (req, res) => {
    try {
        const emojis = await getGuildEmojis(req.guildId);

        const usable = emojis
            .filter((e) => e.available !== false)
            .map((e) => ({ id: e.id, name: e.name, animated: !!e.animated }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ emojis: usable });
    } catch (err) {
        console.error("[api/emojis]", err);
        res.status(502).json({ error: "upstream_error" });
    }
});

/* ── /api/mod-channels — Deluminator's mod-only search list ──────── */

apiRouter.get("/mod-channels", requireAuth, async (req, res) => {
    try {
        const [ids, allChannels] = await Promise.all([
            getModChannelIds(req.guildId),
            getGuildChannels(req.guildId),
        ]);
        const nameById = new Map(allChannels.map((c) => [c.id, c.name]));

        res.json({
            channels: ids.map((id) => ({ id, name: nameById.get(id) || null })),
        });
    } catch (err) {
        console.error("[api/mod-channels]", err);
        res.status(502).json({ error: "upstream_error" });
    }
});

apiRouter.post("/mod-channels", requireManageGuild, async (req, res) => {
    const { channelId } = req.body;
    if (!channelId || typeof channelId !== "string") {
        return res.status(400).json({ error: "channel_required" });
    }
    await addModChannel(req.guildId, channelId);
    res.json({ ok: true });
});

apiRouter.delete("/mod-channels/:channelId", requireManageGuild, async (req, res) => {
    await removeModChannel(req.guildId, req.params.channelId);
    res.json({ ok: true });
});

/* ── /api/bot — identity tab ──────────────────────────────────────── */

apiRouter.get("/bot", requireAuth, async (req, res) => {
    try {
        const [me, guild] = await Promise.all([
            getGuildMember(req.guildId, config.discord.clientId),
            getGuild(req.guildId),
        ]);

        res.json({
            username: me?.user?.username ?? "Dumbledore",
            globalAvatarUrl: me?.user?.avatar
                ? `https://cdn.discordapp.com/avatars/${me.user.id}/${me.user.avatar}.png?size=128`
                : null,
            guildAvatarUrl: me?.avatar
                ? `https://cdn.discordapp.com/guilds/${req.guildId}/users/${me.user.id}/avatars/${me.avatar}.png?size=128`
                : null,
            guildBannerUrl: me?.banner
                ? `https://cdn.discordapp.com/guilds/${req.guildId}/users/${me.user.id}/banners/${me.banner}.png?size=512`
                : null,
            nickname: me?.nick ?? null,
            guildName: guild?.name ?? null,
            memberCount: guild?.approximate_member_count ?? null,
        });
    } catch (err) {
        console.error("[api/bot]", err);
        res.status(502).json({ error: "upstream_error" });
    }
});

apiRouter.post("/bot/nickname", requireBotManager, async (req, res) => {
    const { nickname } = req.body;
    if (typeof nickname !== "string" || nickname.length > 32) {
        return res.status(400).json({ error: "invalid_nickname" });
    }

    try {
        await patchBotProfile(req.guildId, { nick: nickname || null });
        res.json({ ok: true });
    } catch (err) {
        res.status(502).json({ error: "discord_rejected", detail: err.body ?? String(err) });
    }
});

function fileToDataUri(file) {
    return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

/* ── /api/welcome-messages — custom welcome message builder ─────────
 * Replaces the bot's old hard-coded rotation. Each guild can have any
 * number of these; the bot picks one at random on every member join. */

apiRouter.get("/welcome-messages", requireAuth, async (req, res) => {
    const messages = await listWelcomeMessages(req.guildId);
    res.json({ messages });
});

apiRouter.post("/welcome-messages", requireManageGuild, async (req, res) => {
    const message = await createWelcomeMessage(req.guildId, req.body || {});
    res.json({ message });
});

apiRouter.patch("/welcome-messages/:id", requireManageGuild, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });

    const message = await updateWelcomeMessage(req.guildId, id, req.body || {});
    if (!message) return res.status(404).json({ error: "not_found" });
    res.json({ message });
});

apiRouter.delete("/welcome-messages/:id", requireManageGuild, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });

    await deleteWelcomeMessage(req.guildId, id);
    res.json({ ok: true });
});

// Welcome embed images/GIFs need a real HTTP(S) URL (Discord embeds can't
// use data: URIs the way the avatar/banner endpoints above do), so these
// are uploaded to Cloudflare R2 and served from its public bucket URL —
// keeps them alive across redeploys, unlike the old public/uploads disk
// storage this replaced.
const IMAGE_EXT_BY_MIME = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
};

apiRouter.post(
    "/welcome-messages/upload-image",
    requireManageGuild,
    upload.single("image"),
    async (req, res) => {
        const mimetype = req.file?.mimetype;
        const ext = mimetype && IMAGE_EXT_BY_MIME[mimetype];

        if (!req.file || !ext) {
            return res.status(400).json({ error: "image_required" });
        }

        if (!isR2Configured()) {
            console.error("[api/welcome-messages/upload-image] R2 is not configured");
            return res.status(503).json({ error: "storage_not_configured" });
        }

        try {
            const key = `${crypto.randomUUID()}${ext}`;
            const url = await uploadImage(req.file.buffer, key, mimetype);
            res.json({ url });
        } catch (err) {
            console.error("[api/welcome-messages/upload-image] R2 upload failed", err);
            res.status(502).json({ error: "upload_failed" });
        }
    },
);

apiRouter.post("/bot/avatar", requireBotManager, upload.single("image"), async (req, res) => {
    if (!req.file || !req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "image_required" });
    }
    try {
        await patchBotProfile(req.guildId, { avatar: fileToDataUri(req.file) });
        res.json({ ok: true });
    } catch (err) {
        res.status(502).json({ error: "discord_rejected", detail: err.body ?? String(err) });
    }
});

apiRouter.delete("/bot/avatar", requireBotManager, async (req, res) => {
    try {
        await patchBotProfile(req.guildId, { avatar: null });
        res.json({ ok: true });
    } catch (err) {
        res.status(502).json({ error: "discord_rejected", detail: err.body ?? String(err) });
    }
});

apiRouter.post("/bot/banner", requireBotManager, upload.single("image"), async (req, res) => {
    if (!req.file || !req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "image_required" });
    }
    try {
        await patchBotProfile(req.guildId, { banner: fileToDataUri(req.file) });
        res.json({ ok: true });
    } catch (err) {
        res.status(502).json({ error: "discord_rejected", detail: err.body ?? String(err) });
    }
});

apiRouter.delete("/bot/banner", requireBotManager, async (req, res) => {
    try {
        await patchBotProfile(req.guildId, { banner: null });
        res.json({ ok: true });
    } catch (err) {
        res.status(502).json({ error: "discord_rejected", detail: err.body ?? String(err) });
    }
});
