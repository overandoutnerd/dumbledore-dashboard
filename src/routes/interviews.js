import { Router } from "express";

import { requireAuth } from "../auth.js";
import { getGuild, getGuildMember, getGuildRoles, computePermissions, isBotManagerFor } from "../discord.js";
import { getBotManagerRoleIds } from "../settingsService.js";
import { getInterviewByPublicId } from "../interviewsService.js";

export const interviewsRouter = Router();

/**
 * GET /api/interviews/:publicId — serves a single interview transcript.
 * Used by the SPA (tab-interviews.js) both for the in-dashboard Settings →
 * Interviews list and for the /interviews/:publicId deep link the bot's
 * "Read Transcript" embed button points at — both land in the same app.
 *
 * Deliberately NOT nested under requireActiveGuild (see routes/api.js):
 * a mod clicking "Read Transcript" from a Discord embed has no reason to
 * have that guild selected as their *active* dashboard guild, so this
 * route resolves the guild from the interview row itself and re-checks
 * membership + permission fresh, the same way /api/guilds/:id/select
 * does for the guild picker.
 */
interviewsRouter.get("/interviews/:publicId", requireAuth, async (req, res) => {
    try {
        const interview = await getInterviewByPublicId(req.params.publicId);

        if (!interview || (!interview.transcriptData && !interview.transcriptHtml)) {
            return res.status(404).json({ error: "not_found" });
        }

        const [member, guildRoles, guild, botManagerRoleIds] = await Promise.all([
            getGuildMember(interview.guildId, req.user.sub),
            getGuildRoles(interview.guildId),
            getGuild(interview.guildId, { withCounts: false }),
            getBotManagerRoleIds(interview.guildId),
        ]);

        if (!member || !guild) {
            return res.status(403).json({ error: "not_a_member" });
        }

        const permissions = computePermissions(member, guildRoles, guild);
        // Same access rule as every other dashboard system: Bot Manager role
        // or native Administrator. No separate "viewer role" concept.
        const isBotManager = isBotManagerFor(member, botManagerRoleIds, permissions.isAdministrator);

        if (!isBotManager) {
            return res.status(403).json({ error: "missing_permission" });
        }

        res.json({
            interviewNumber: interview.number,
            status: interview.status,
            // Structured transcript for the Discord-style renderer. Only
            // absent on interviews closed before this column existed, in
            // which case legacyHtml is sent instead.
            data: interview.transcriptData,
            legacyHtml: interview.transcriptData ? null : interview.transcriptHtml,
        });
    } catch (err) {
        console.error("[api/interviews]", err);
        res.status(502).json({ error: "upstream_error" });
    }
});
