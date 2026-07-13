import { Pool } from "pg";
import { config } from "./config.js";

export const db = new Pool({
    connectionString: config.databaseUrl,
});

db.on("error", (error) => {
    console.error("[db] Unexpected Postgres error:", error);
});

// Make sure guild_settings has a row for our guild so reads never 404.
export async function ensureGuildSettings(guildId) {
    await db.query(
        `
        INSERT INTO guild_settings (guild_id)
        VALUES ($1)
        ON CONFLICT (guild_id) DO NOTHING
        `,
        [guildId],
    );
}
