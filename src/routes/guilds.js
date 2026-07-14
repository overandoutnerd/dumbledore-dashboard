import { Router } from "express";

import { requireAuth } from "../auth.js";
import { issueSession } from "../auth.js";
import {
    getUserGuilds,
    getBotGuilds,
    getGuild,
    getGuildMember,
    getGuildRoles,
    computePermissions,
    isBotManagerFor,
    PERMISSIONS,
} from "../discord.js";
import { getBotManagerRoleId } from "../settingsService.js";

export const guildsRouter = Router();

function iconUrl(guild) {
    if (!guild.icon) return null;
    const ext = guild.icon.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=64`;
}

/**
 * Every server where both (a) the bot is installed and (b) the signed-in
 * user has some form of mod access — Bot Manager (role, or Administrator
 * as fallback when no role is configured), Manage Server, or Manage
 * Roles. This is a best-effort *preview* list (cheap OAuth-permission-bit
 * check, with an extra role lookup only when needed); POST
 * /guilds/:id/select re-verifies properly with the bot's own credentials
 * before actually granting a session for that guild.
 */
guildsRouter.get("/guilds", requireAuth, async (req, res) => {
    if (!req.user.discordAccessToken) {
        return res.status(401).json({ error: "not_authenticated" });
    }

    try {
        const [userGuilds, botGuilds] = await Promise.all([
            getUserGuilds(req.user.discordAccessToken),
            getBotGuilds(),
        ]);

        const botGuildIds = new Set(botGuilds.map((g) => g.id));
        const mutual = userGuilds.filter((g) => botGuildIds.has(g.id));

        const results = await Promise.all(
            mutual.map(async (g) => {
                const perms = BigInt(g.permissions ?? "0");
                const nativeIsAdministrator =
                    g.owner || (perms & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR;
                const canManageGuild =
                    nativeIsAdministrator || (perms & PERMISSIONS.MANAGE_GUILD) === PERMISSIONS.MANAGE_GUILD;
                const canManageRoles =
                    nativeIsAdministrator || (perms & PERMISSIONS.MANAGE_ROLES) === PERMISSIONS.MANAGE_ROLES;

                let isBotManager = false;
                try {
                    const botManagerRoleId = await getBotManagerRoleId(g.id);
                    if (botManagerRoleId) {
                        const member = await getGuildMember(g.id, req.user.sub);
                        isBotManager = !!member && member.roles.includes(botManagerRoleId);
                    } else {
                        isBotManager = nativeIsAdministrator;
                    }
                } catch {
                    isBotManager = nativeIsAdministrator;
                }

                if (!isBotManager && !canManageGuild && !canManageRoles) return null;

                return {
                    id: g.id,
                    name: g.name,
                    iconUrl: iconUrl(g),
                    isOwner: !!g.owner,
                    isBotManager,
                };
            }),
        );

        res.json({ guilds: results.filter(Boolean) });
    } catch (err) {
        console.error("[api/guilds]", err);
        res.status(502).json({ error: "upstream_error" });
    }
});

/**
 * Authoritatively re-checks access to one guild using the bot's own
 * credentials (not just the cheap OAuth bit check from the list above),
 * then locks the session into that guild.
 */
guildsRouter.post("/guilds/:id/select", requireAuth, async (req, res) => {
    const guildId = req.params.id;

    try {
        const [member, roles, guild, botManagerRoleId] = await Promise.all([
            getGuildMember(guildId, req.user.sub),
            getGuildRoles(guildId),
            getGuild(guildId, { withCounts: true }),
            getBotManagerRoleId(guildId),
        ]);

        if (!member || !guild) {
            return res.status(404).json({ error: "not_a_member" });
        }

        const permissions = computePermissions(member, roles, guild);
        const isBotManager = isBotManagerFor(member, botManagerRoleId, permissions.isAdministrator);

        const hasDashboardAccess = isBotManager || permissions.canManageGuild || permissions.canManageRoles;

        if (!hasDashboardAccess) {
            return res.status(403).json({ error: "insufficient_permissions" });
        }

        issueSession(res, {
            sub: req.user.sub,
            username: req.user.username,
            handle: req.user.handle,
            avatar: req.user.avatar,
            nickname: member.nick || null,
            discordAccessToken: req.user.discordAccessToken,

            activeGuildId: guildId,
            guildName: guild.name,
            guildIcon: iconUrl(guild),
            canManageGuild: permissions.canManageGuild || isBotManager,
            canManageRoles: permissions.canManageRoles || isBotManager,
            isBotManager,
        });

        res.json({
            ok: true,
            guild: { id: guildId, name: guild.name, iconUrl: iconUrl(guild) },
        });
    } catch (err) {
        console.error("[api/guilds/select]", err);
        res.status(502).json({ error: "upstream_error" });
    }
});

/** Returns to the server picker without logging out entirely. */
guildsRouter.post("/guilds/deselect", requireAuth, (req, res) => {
    issueSession(res, {
        sub: req.user.sub,
        username: req.user.username,
        handle: req.user.handle,
        avatar: req.user.avatar,
        nickname: null,
        discordAccessToken: req.user.discordAccessToken,

        activeGuildId: null,
        guildName: null,
        guildIcon: null,
        canManageGuild: false,
        canManageRoles: false,
        isBotManager: false,
    });

    res.json({ ok: true });
});
