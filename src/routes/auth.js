import { Router } from "express";
import crypto from "node:crypto";

import { config } from "../config.js";
import { buildAuthorizeUrl, exchangeCodeForToken, getOAuthUser } from "../discord.js";
import { issueSession, clearSession } from "../auth.js";

export const authRouter = Router();

const STATE_COOKIE = "dpd_oauth_state";
const RETURN_TO_COOKIE = "dpd_return_to";

/** Only ever redirect back to a relative path on our own site — never an
 * absolute/external URL — so this can't be turned into an open redirect. */
function safeReturnTo(value) {
    if (typeof value !== "string") return null;
    if (!value.startsWith("/") || value.startsWith("//")) return null;
    return value;
}

authRouter.get("/login", (req, res) => {
    const state = crypto.randomBytes(16).toString("hex");

    res.cookie(STATE_COOKIE, state, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: "lax",
        domain: config.cookieDomain,
        maxAge: 5 * 60 * 1000,
    });

    const returnTo = safeReturnTo(req.query.returnTo);
    if (returnTo) {
        res.cookie(RETURN_TO_COOKIE, returnTo, {
            httpOnly: true,
            secure: config.isProd,
            sameSite: "lax",
            domain: config.cookieDomain,
            maxAge: 5 * 60 * 1000,
        });
    }

    res.redirect(buildAuthorizeUrl(state));
});

authRouter.get("/callback", async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.redirect(`/?authError=${encodeURIComponent(String(error))}`);
    }

    const expectedState = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { domain: config.cookieDomain });

    const returnTo = safeReturnTo(req.cookies?.[RETURN_TO_COOKIE]);
    res.clearCookie(RETURN_TO_COOKIE, { domain: config.cookieDomain });

    if (!code || !state || state !== expectedState) {
        return res.redirect("/?authError=invalid_state");
    }

    try {
        const token = await exchangeCodeForToken(String(code));
        const discordUser = await getOAuthUser(token.access_token);

        // Stage 1 only identifies who's signing in. Which server(s) they
        // can manage is resolved next by GET /api/guilds using this
        // access token, then locked in by POST /api/guilds/:id/select.
        issueSession(res, {
            sub: discordUser.id,
            username: discordUser.global_name || discordUser.username,
            handle: discordUser.username,
            avatar: discordUser.avatar
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=64`
                : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discordUser.id) >> 22n) % 6}.png`,
            nickname: null,

            discordAccessToken: token.access_token,

            activeGuildId: null,
            guildName: null,
            guildIcon: null,
            canManageGuild: false,
            canManageRoles: false,
            isBotManager: false,
        });

        res.redirect(returnTo || "/");
    } catch (err) {
        console.error("[auth] callback failed:", err);
        res.redirect("/?authError=server_error");
    }
});

authRouter.post("/logout", (req, res) => {
    clearSession(res);
    res.json({ ok: true });
});

authRouter.get("/logout", (req, res) => {
    clearSession(res);
    res.redirect("/");
});
