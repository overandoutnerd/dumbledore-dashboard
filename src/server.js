import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";
import { attachUser } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { guildsRouter } from "./routes/guilds.js";
import { apiRouter } from "./routes/api.js";
import { interviewsRouter } from "./routes/interviews.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.use("/auth", authRouter);
app.use("/api", guildsRouter);
app.use("/api", apiRouter);
app.use("/api", interviewsRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, "..", "public")));

// SPA-style fallback so refreshing on any tab still loads the dashboard.
// This also serves /interviews/:publicId — a mod clicking "Read
// Transcript" on the embed the bot posts in Discord lands in the actual
// dashboard app, which opens that interview directly (see the
// PENDING_INTERVIEW_ID handling in app.js/auth.js) using the same session
// cookie and login gate as everywhere else, rather than a separate
// standalone page with its own auth flow.
app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/auth")) return next();
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(config.port, () => {
    console.log(`[server] Dumbledore mod dashboard listening on ${config.publicUrl}`);
    if (!config.databaseUrl || !config.discord.token) {
        console.warn(
            "[server] ⚠️  One or more required env vars are missing — check .env against .env.example.",
        );
    }
});
