import { db } from "./db.js";
import { ensureFresh, countMembersWithRole, countMembersWithRoleIn } from "./memberCache.js";
import { getGuildSettingsSummary } from "./settingsService.js";
import { createMessage, editMessage } from "./discord.js";

const ALL_HOUSES = ["gryffindor", "ravenclaw", "hufflepuff", "slytherin"];

const HOUSE_ROLE_FIELD = {
    gryffindor: "gryffindorRoleId",
    ravenclaw: "ravenclawRoleId",
    hufflepuff: "hufflepuffRoleId",
    slytherin: "slytherinRoleId",
};

// Mirrors utils/house.ts on the bot — kept in sync manually since these
// two codebases don't share source.
const HOUSE_DISPLAY = {
    gryffindor: { name: "Gryffindor", emoji: "🦁" },
    ravenclaw: { name: "Ravenclaw", emoji: "🦅" },
    hufflepuff: { name: "Hufflepuff", emoji: "🦡" },
    slytherin: { name: "Slytherin", emoji: "🐍" },
};

const EMBED_COLOR = 0xe46c32;

/**
 * House Cup standings: for each house, the average XP of its contributing
 * members (SUM of that house's banked XP in house_xp / count of *current*
 * role members who have also banked xp > 0 for that house — not every
 * current member) plus any manual bonus points a mod has awarded
 * (house_points table). This is a straight port of the bot's
 * houseCupService.ts — same tables, same formula — just computed here
 * instead of round-tripping through the bot.
 *
 * A house's banked XP total in house_xp intentionally includes XP earned
 * by members who have since left that house (see house_xp's schema
 * comment) — leaving a house doesn't erase what you already contributed,
 * it just stops counting you towards that house's member count.
 */
export async function getHouseCupStandings(guildId) {
    const [settings, xpRes, bonusRes, contributorRes] = await Promise.all([
        getGuildSettingsSummary(guildId),
        db.query(
            `SELECT house_name, COALESCE(SUM(xp), 0) AS total FROM house_xp WHERE guild_id = $1 GROUP BY house_name`,
            [guildId],
        ),
        db.query(`SELECT house_name, points FROM house_points WHERE guild_id = $1`, [guildId]),
        db.query(
            `SELECT house_name, user_id FROM house_xp WHERE guild_id = $1 AND xp > 0`,
            [guildId],
        ),
    ]);

    await ensureFresh(guildId);

    const xpByHouse = new Map(xpRes.rows.map((r) => [r.house_name, Number(r.total)]));
    const bonusByHouse = new Map(bonusRes.rows.map((r) => [r.house_name, Number(r.points)]));

    const contributorsByHouse = new Map();
    for (const row of contributorRes.rows) {
        let set = contributorsByHouse.get(row.house_name);
        if (!set) {
            set = new Set();
            contributorsByHouse.set(row.house_name, set);
        }
        set.add(row.user_id);
    }

    return ALL_HOUSES.map((house) => {
        const roleId = settings[HOUSE_ROLE_FIELD[house]];
        const memberCount = countMembersWithRole(guildId, roleId);
        const contributorIds = contributorsByHouse.get(house) ?? new Set();
        const contributorCount = countMembersWithRoleIn(guildId, roleId, contributorIds);
        const totalXp = xpByHouse.get(house) ?? 0;
        const bonusPoints = bonusByHouse.get(house) ?? 0;
        const averageXp = contributorCount === 0 ? 0 : totalXp / contributorCount;

        return {
            house,
            totalXp,
            memberCount,
            contributorCount,
            averageXp,
            bonusPoints,
            totalPoints: averageXp + bonusPoints,
        };
    }).sort((a, b) => b.totalPoints - a.totalPoints);
}

function fmtPts(n) {
    return Math.round(n * 10) / 10;
}

/**
 * Same embed shape as the bot's buildHouseCupEmbed() in
 * houseCupService.ts, since the bot's scheduler and this dashboard both
 * edit the same board message and it should look identical either way.
 */
export async function buildHouseCupEmbedPayload(guildId) {
    const standings = await getHouseCupStandings(guildId);
    const leader = standings[0];

    const description = standings
        .map((entry, i) => {
            const meta = HOUSE_DISPLAY[entry.house];
            const bonusNote = entry.bonusPoints ? ` + ${entry.bonusPoints} bonus` : "";
            return (
                `${i + 1}. ${meta.emoji} ${meta.name} • ${fmtPts(entry.totalPoints)} pts` +
                ` (${fmtPts(entry.averageXp)} avg XP${bonusNote} • ${entry.memberCount} member${entry.memberCount === 1 ? "" : "s"})`
            );
        })
        .join("\n");

    return {
        embeds: [
            {
                color: EMBED_COLOR,
                title: "🏆 House Cup Standings",
                description,
                fields: [
                    {
                        name: "Current Leader",
                        value: `${HOUSE_DISPLAY[leader.house].emoji} ${HOUSE_DISPLAY[leader.house].name}`,
                    },
                ],
                footer: {
                    text: `Points = average XP per contributing house member, plus any bonus points awarded by mods · updated ${new Date().toLocaleString(
                        "en-US",
                        { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
                    )}`,
                },
            },
        ],
    };
}

/**
 * If a House Cup board message exists for this guild (posted via the
 * bot's /house-cup command), edits it in place with fresh standings.
 * Called right after a mod manually awards bonus points from here, so
 * the board doesn't wait for the bot's next scheduled refresh to reflect
 * it. Silently does nothing if no board has been posted yet — the
 * dashboard never creates one itself, only /house-cup does that.
 */
export async function refreshHouseCupBoardIfExists(guildId) {
    const { rows } = await db.query(
        `SELECT channel_id, message_id FROM house_cup_board WHERE guild_id = $1`,
        [guildId],
    );

    const board = rows[0];
    if (!board) return;

    try {
        const payload = await buildHouseCupEmbedPayload(guildId);
        await editMessage(board.channel_id, board.message_id, payload);
    } catch (err) {
        // The message/channel may have been deleted since — not fatal,
        // the bot's own scheduler will notice and clean up the row on
        // its next pass. Just log and move on.
        console.error("[houseCupService] failed to refresh House Cup board", err);
    }
}

/**
 * Posts a log entry to guild_settings.house_cup_log_channel_id (if
 * configured) recording a manual bonus-point award: who awarded it, to
 * which house, how much, and why.
 */
export async function logHousePointsAward(guildId, { moderator, house, delta, reason, newTotal }) {
    const settings = await getGuildSettingsSummary(guildId);
    if (!settings.houseCupLogChannelId) return;

    const meta = HOUSE_DISPLAY[house];
    const sign = delta > 0 ? "+" : "";

    const payload = {
        embeds: [
            {
                color: EMBED_COLOR,
                title: `🏆 House Points ${delta >= 0 ? "Awarded" : "Deducted"}`,
                fields: [
                    { name: "House", value: `${meta.emoji} ${meta.name}`, inline: true },
                    { name: "Points", value: `${sign}${delta} (now ${newTotal} bonus)`, inline: true },
                    { name: "Moderator", value: `<@${moderator.id}> (${moderator.username})`, inline: true },
                    { name: "Reason", value: reason },
                ],
                timestamp: new Date().toISOString(),
            },
        ],
    };

    try {
        await createMessage(settings.houseCupLogChannelId, payload);
    } catch (err) {
        console.error("[houseCupService] failed to post House Cup log", err);
    }
}
