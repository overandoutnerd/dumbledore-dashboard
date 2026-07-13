import { db } from "./db.js";

export function getUtcDateString(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function daysAgoDateString(days) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return getUtcDateString(d);
}

async function sumSince(table, column, guildId, sinceDate) {
    const { rows } = await db.query(
        `SELECT COALESCE(SUM(${column}), 0) AS total FROM ${table} WHERE guild_id = $1 AND date >= $2`,
        [guildId, sinceDate],
    );
    return Number(rows[0]?.total ?? 0);
}

async function sumBetween(table, column, guildId, fromDate, toDate) {
    const { rows } = await db.query(
        `SELECT COALESCE(SUM(${column}), 0) AS total FROM ${table} WHERE guild_id = $1 AND date >= $2 AND date <= $3`,
        [guildId, fromDate, toDate],
    );
    return Number(rows[0]?.total ?? 0);
}

export async function getMessageStats(guildId) {
    const [today, thisWeek, previousWeek, thisMonth, totals] = await Promise.all([
        sumSince("analytics_message_daily", "message_count", guildId, getUtcDateString()),
        sumBetween("analytics_message_daily", "message_count", guildId, daysAgoDateString(6), getUtcDateString()),
        sumBetween("analytics_message_daily", "message_count", guildId, daysAgoDateString(13), daysAgoDateString(7)),
        sumSince("analytics_message_daily", "message_count", guildId, daysAgoDateString(29)),
        getGuildTotals(guildId),
    ]);
    return {
        today,
        thisWeek, // rolling last 7 days, inclusive of today
        previousWeek, // the 7 days before that, for comparison
        weekDelta: thisWeek - previousWeek,
        thisMonth,
        total: totals.totalMessages,
    };
}

export async function getSummonStats(guildId) {
    const [today, thisWeek, thisMonth, totals] = await Promise.all([
        sumSince("analytics_summon_daily", "summon_count", guildId, getUtcDateString()),
        sumSince("analytics_summon_daily", "summon_count", guildId, daysAgoDateString(6)),
        sumSince("analytics_summon_daily", "summon_count", guildId, daysAgoDateString(29)),
        getGuildTotals(guildId),
    ]);
    return { today, thisWeek, thisMonth, total: totals.totalSummons };
}

export async function getDailyMessageGraph(guildId, days = 14) {
    const { rows } = await db.query(
        `SELECT date, message_count FROM analytics_message_daily WHERE guild_id = $1 AND date >= $2 ORDER BY date ASC`,
        [guildId, daysAgoDateString(days - 1)],
    );
    return rows.map((r) => ({ date: r.date, count: Number(r.message_count) }));
}

export async function getGuildTotals(guildId) {
    const { rows } = await db.query(
        `SELECT total_messages, total_commands, total_summons, total_joins, total_leaves FROM analytics_guild_totals WHERE guild_id = $1`,
        [guildId],
    );
    const r = rows[0] || {};
    return {
        totalMessages: Number(r.total_messages ?? 0),
        totalCommands: Number(r.total_commands ?? 0),
        totalSummons: Number(r.total_summons ?? 0),
        totalJoins: Number(r.total_joins ?? 0),
        totalLeaves: Number(r.total_leaves ?? 0),
    };
}

export async function getMostUsedCommands(guildId, limit = 8) {
    const { rows } = await db.query(
        `SELECT command_name, total_executions FROM analytics_command_totals WHERE guild_id = $1 ORDER BY total_executions DESC LIMIT $2`,
        [guildId, limit],
    );
    return rows.map((r) => ({ commandName: r.command_name, totalExecutions: Number(r.total_executions) }));
}

export async function getCommandUsageToday(guildId) {
    const { rows } = await db.query(
        `SELECT command_name, SUM(execution_count) AS total FROM analytics_command_daily WHERE guild_id = $1 AND date = $2 GROUP BY command_name`,
        [guildId, getUtcDateString()],
    );
    const map = {};
    for (const r of rows) map[r.command_name] = Number(r.total);
    return map;
}

export async function getLatestMemberSnapshot(guildId) {
    const { rows } = await db.query(
        `SELECT member_count FROM analytics_member_daily WHERE guild_id = $1 AND member_count IS NOT NULL ORDER BY date DESC LIMIT 1`,
        [guildId],
    );
    return rows.length ? Number(rows[0].member_count) : null;
}

async function memberGrowthOverDays(guildId, daysAgo) {
    const latest = await getLatestMemberSnapshot(guildId);
    if (latest === null) return null;

    const { rows } = await db.query(
        `SELECT member_count FROM analytics_member_daily WHERE guild_id = $1 AND member_count IS NOT NULL AND date <= $2 ORDER BY date DESC LIMIT 1`,
        [guildId, daysAgoDateString(daysAgo)],
    );
    if (!rows.length) return null;
    return latest - Number(rows[0].member_count);
}

export async function getMemberStats(guildId) {
    const [latest, weeklyGrowth, monthlyGrowth, totals] = await Promise.all([
        getLatestMemberSnapshot(guildId),
        memberGrowthOverDays(guildId, 7),
        memberGrowthOverDays(guildId, 30),
        getGuildTotals(guildId),
    ]);
    return {
        latestSnapshot: latest,
        weeklyGrowth,
        monthlyGrowth,
        totalJoins: totals.totalJoins,
        totalLeaves: totals.totalLeaves,
    };
}

export async function getMemberDailyRows(guildId, days = 14) {
    const { rows } = await db.query(
        `SELECT date, member_count, joins, leaves FROM analytics_member_daily WHERE guild_id = $1 AND date >= $2 ORDER BY date ASC`,
        [guildId, daysAgoDateString(days - 1)],
    );
    return rows.map((r) => ({
        date: r.date,
        memberCount: r.member_count === null ? null : Number(r.member_count),
        joins: Number(r.joins),
        leaves: Number(r.leaves),
    }));
}
