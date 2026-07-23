import { db } from "./db.js";

/**
 * Read-only access to the `interviews` table (written by the bot's
 * /interview and /close-interview commands — see the bot's
 * interviewService.ts). The dashboard never creates or mutates rows here,
 * it only lists interviews and serves the transcript_data a mod has
 * permission to view.
 */
function parseTranscriptData(value) {
    if (!value) return null;
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }
    return value;
}

function mapInterviewRow(row) {
    return {
        id: Number(row.id),
        publicId: row.public_id,
        guildId: row.guild_id,
        number: row.number,
        channelId: row.channel_id,
        creatorId: row.creator_id,
        targetUserId: row.target_user_id,
        modIds: row.mod_ids || [],
        status: row.status,
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        closedBy: row.closed_by,
        // Legacy pre-rendered HTML, only present on interviews closed
        // before transcript_data existed.
        transcriptHtml: row.transcript_html,
        transcriptData: parseTranscriptData(row.transcript_data),
    };
}

export async function getInterviewByPublicId(publicId) {
    const { rows } = await db.query(
        `SELECT * FROM interviews WHERE public_id = $1`,
        [publicId],
    );

    const row = rows[0];
    return row ? mapInterviewRow(row) : null;
}

/** Newest first, by interview number (== creation order within a guild). */
export async function listInterviewsForGuild(guildId, limit = 100) {
    const { rows } = await db.query(
        `SELECT * FROM interviews WHERE guild_id = $1 ORDER BY number DESC LIMIT $2`,
        [guildId, limit],
    );

    return rows.map(mapInterviewRow);
}
