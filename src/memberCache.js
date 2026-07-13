import { listGuildMembers } from "./discord.js";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

// One cache bucket per guild, since a single dashboard deployment can now
// serve many servers (whichever ones the signed-in user picks).
const buckets = new Map(); // guildId -> { members: Map<userId,...>, lastFetch, inflight }

function getBucket(guildId) {
    let bucket = buckets.get(guildId);
    if (!bucket) {
        bucket = { members: new Map(), lastFetch: 0, inflight: null };
        buckets.set(guildId, bucket);
    }
    return bucket;
}

function avatarUrlFor(user) {
    if (user.avatar) {
        const ext = user.avatar.startsWith("a_") ? "gif" : "png";
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=64`;
    }

    // Default avatar (new username-based index system).
    const index = Number(BigInt(user.id) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

async function refresh(guildId, bucket) {
    const members = await listGuildMembers(guildId, 1000);
    const next = new Map();

    for (const m of members) {
        if (!m.user) continue;

        next.set(m.user.id, {
            id: m.user.id,
            // Guild nickname wins if set — this is what shows up in the
            // leaderboard, activity feed, Azkaban roster, and member
            // search, matching what members actually see in this server.
            username: m.nick || m.user.global_name || m.user.username,
            handle: m.user.username,
            avatarUrl: avatarUrlFor(m.user),
            bot: !!m.user.bot,
        });
    }

    bucket.members = next;
    bucket.lastFetch = Date.now();
}

export async function ensureFresh(guildId) {
    const bucket = getBucket(guildId);
    if (Date.now() - bucket.lastFetch < TTL_MS) return;

    if (!bucket.inflight) {
        bucket.inflight = refresh(guildId, bucket)
            .catch((err) => {
                console.error(`[memberCache] refresh failed for guild ${guildId}:`, err.message);
            })
            .finally(() => {
                bucket.inflight = null;
            });
    }

    await bucket.inflight;
}

export function resolveMember(guildId, userId) {
    const bucket = getBucket(guildId);
    return (
        bucket.members.get(userId) || {
            id: userId,
            username: `Unknown Wizard`,
            handle: userId.slice(0, 6),
            displayName: "Unknown Wizard",
            avatarUrl: `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) >> 22n) % 6}.png`,
            bot: false,
            left: true,
        }
    );
}

export function memberCount(guildId) {
    const bucket = getBucket(guildId);
    return [...bucket.members.values()].filter((m) => !m.bot).length;
}

export function searchCached(guildId, query, limit = 8) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const bucket = getBucket(guildId);
    return [...bucket.members.values()]
        .filter((m) => !m.bot && m.username.toLowerCase().includes(q))
        .slice(0, limit);
}
