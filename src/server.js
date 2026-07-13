import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";
import { attachUser } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { guildsRouter } from "./routes/guilds.js";
import { apiRouter } from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.use("/auth", authRouter);
app.use("/api", guildsRouter);
app.use("/api", apiRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, "..", "public")));

// SPA-style fallback so refreshing on any tab still loads the dashboard.
app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/auth")) return next();
    res.sendFile(path.join(__dirname, "..", "public", "dashboard.html"));
});

app.listen(config.port, () => {
    console.log(`[server] Dumbledore mod dashboard listening on ${config.publicUrl}`);
    if (!config.databaseUrl || !config.discord.token) {
        console.warn(
            "[server] ⚠️  One or more required env vars are missing — check .env against .env.example.",
        );
    }
});
