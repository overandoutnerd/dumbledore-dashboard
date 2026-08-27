import jwt from "jsonwebtoken";
import { config } from "./config.js";

const COOKIE_NAME = "dpd_session";

export function issueSession(res, payload) {
    const token = jwt.sign(payload, config.sessionSecret, {
        expiresIn: `${config.sessionTtlHours}h`,
    });

    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: "lax",
        domain: config.cookieDomain,
        maxAge: config.sessionTtlHours * 60 * 60 * 1000,
    });
}

export function clearSession(res) {
    res.clearCookie(COOKIE_NAME, { domain: config.cookieDomain });
}

function readSession(req) {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
        console.log(
            `[auth] no session cookie — host="${req.headers.host}" path="${req.path}" ` +
                `cookiesPresent=[${Object.keys(req.cookies || {}).join(",")}] ` +
                `ua="${req.headers["user-agent"]}"`,
        );
        return null;
    }

    try {
        return jwt.verify(token, config.sessionSecret);
    } catch (err) {
        console.log(
            `[auth] session cookie present but invalid — host="${req.headers.host}" ` +
                `path="${req.path}" reason="${err.name}: ${err.message}"`,
        );
        return null;
    }
}

/** Attaches req.user if a valid session cookie is present. Never blocks. */
export function attachUser(req, _res, next) {
    req.user = readSession(req);
    next();
}

/** Blocks unauthenticated requests. */
export function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: "not_authenticated" });
    }
    next();
}

/** Blocks requests that haven't picked a server yet (post-login, pre-selection). */
export function requireActiveGuild(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "not_authenticated" });
    if (!req.user.activeGuildId) {
        return res.status(409).json({ error: "no_active_guild" });
    }
    req.guildId = req.user.activeGuildId;
    next();
}

/** Blocks users without the Manage Server permission (or Administrator). */
export function requireManageGuild(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "not_authenticated" });
    if (!req.user.activeGuildId) return res.status(409).json({ error: "no_active_guild" });
    if (!req.user.canManageGuild) {
        return res.status(403).json({ error: "missing_permission", need: "Manage Server" });
    }
    req.guildId = req.user.activeGuildId;
    next();
}

/** Blocks users without the Manage Roles permission (or Administrator). */
export function requireManageRoles(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "not_authenticated" });
    if (!req.user.activeGuildId) return res.status(409).json({ error: "no_active_guild" });
    if (!req.user.canManageRoles) {
        return res.status(403).json({ error: "missing_permission", need: "Manage Roles" });
    }
    req.guildId = req.user.activeGuildId;
    next();
}

/** Blocks anyone who isn't the guild's Bot Manager (bot identity is server-wide, high blast radius). */
export function requireBotManager(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "not_authenticated" });
    if (!req.user.activeGuildId) return res.status(409).json({ error: "no_active_guild" });
    if (!req.user.isBotManager) {
        return res.status(403).json({ error: "missing_permission", need: "Bot Manager" });
    }
    req.guildId = req.user.activeGuildId;
    next();
}

export { COOKIE_NAME };
