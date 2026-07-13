// Mirrors the SlashCommandBuilder definitions registered in the bot's
// src/bot.ts, plus the permission checks in each command handler.
// Keep this in sync if commands change on the bot side.

export const COMMANDS = [
    {
        name: "say", category: "Messaging", perm: "botmanager",
        desc: "Speak through Dumbledore in the current channel.",
        full: "Sends a message as the bot in the current channel. The command author receives a DM with Edit and Delete controls for the sent message.",
        params: [
            { name: "message", type: "string", required: true, desc: "Message to send" },
            { name: "media", type: "attachment", required: false, desc: "Optional image or file" },
        ],
    },
    {
        name: "announce", category: "Messaging", perm: "botmanager",
        desc: "Post a formatted announcement embed.",
        full: "Creates a titled announcement embed with an optional message outside the embed and an optional image. The author gets DM controls to edit or delete it afterward.",
        params: [
            { name: "title", type: "string", required: true, desc: "Embed title" },
            { name: "body", type: "string", required: true, desc: "Embed body" },
            { name: "message", type: "string", required: false, desc: "Optional message outside the embed" },
            { name: "media", type: "attachment", required: false, desc: "Optional image" },
        ],
    },
    {
        name: "profile", category: "Community", perm: "everyone",
        desc: "View your XP, level and rank.",
        full: "Shows an ephemeral card with your current level, XP, server rank, title and total messages sent, plus progress toward your next level.",
        params: [],
    },
    {
        name: "sortme", category: "Community", perm: "everyone",
        desc: "Let the Sorting Hat choose your house.",
        full: "Starts an interactive Sorting Hat quiz. Based on your answers, you're placed into Gryffindor, Ravenclaw, Hufflepuff or Slytherin and awarded the matching role plus House Cup points.",
        params: [],
    },
    {
        name: "deluminator", category: "Community", perm: "everyone",
        desc: "Locate a member's most recent message.",
        full: "Searches the server for a user's latest message and jumps you to it, showing a preview, channel and timestamp. When used inside a mod channel, it can also search mod-only channels.",
        params: [
            { name: "user", type: "user", required: true, desc: "The user to locate" },
        ],
    },
    {
        name: "elderwand", category: "Community", perm: "everyone",
        desc: "Reveal the five oldest members.",
        full: "Ranks and displays the five longest-standing members of the server by join date, medal-style.",
        params: [],
    },
    {
        name: "leaderboard", category: "Community", perm: "everyone",
        desc: "View the server XP leaderboard.",
        full: "Displays the top 10 members ranked by level and XP earned from chatting.",
        params: [],
    },
    {
        name: "house-cup", category: "Community", perm: "everyone",
        desc: "View House Cup point standings.",
        full: "Shows current standings for all four Hogwarts houses, sorted by total points, with the current leader highlighted.",
        params: [],
    },
    {
        name: "configure-roles", category: "Community", perm: "everyone",
        desc: "Open the self-assign role picker.",
        full: "Opens a select menu of role categories (pronouns, region, etc.) so members can pick their own roles.",
        params: [],
    },
    {
        name: "manage-roles", category: "Server Config", perm: "botmanager",
        desc: "Open the admin role-category dashboard.",
        full: "Opens an interactive dashboard for creating, editing and deleting the role categories and options members see in /configure-roles.",
        params: [],
    },
    {
        name: "configure-starboard", category: "Server Config", perm: "manageserver",
        desc: "Enable/disable the starboard.",
        full: "Turns the starboard on or off and sets the channel where messages that earn enough ⭐ reactions get reposted.",
        params: [
            { name: "enabled", type: "boolean", required: true, desc: "Enable or disable the starboard" },
            { name: "channel", type: "channel", required: false, desc: "Channel where starred messages will be posted" },
            { name: "threshold", type: "integer", required: false, desc: "Number of ⭐ reactions needed to hit the starboard" },
        ],
    },
    {
        name: "configure-welcome", category: "Server Config", perm: "manageserver",
        desc: "Enable/disable welcome messages.",
        full: "Turns automatic welcome messages on or off for new members and sets which channel they post in.",
        params: [
            { name: "enabled", type: "boolean", required: true, desc: "Enable or disable welcome messages" },
            { name: "channel", type: "channel", required: false, desc: "Channel where welcome messages will be sent" },
        ],
    },
    {
        name: "configure-sorting-hat", category: "Server Config", perm: "manageserver",
        desc: "Enable/disable the Sorting Hat system.",
        full: "Turns the Sorting Hat on or off and sets which channel /sortme results get posted to. A channel is required when enabling.",
        params: [
            { name: "enabled", type: "boolean", required: true, desc: "Enable or disable the Sorting Hat" },
            { name: "channel", type: "channel", required: false, desc: "Channel where Sorting Hat results will be posted" },
        ],
    },
    {
        name: "configure-mod-channels", category: "Server Config", perm: "manageserver",
        desc: "Manage the Deluminator's mod-only channel list.",
        full: "Adds, removes, or lists the channels the Deluminator is allowed to search when used from within a mod channel.",
        params: [
            { name: "action", type: "string", required: true, desc: "add, remove, or list mod channels" },
            { name: "channel", type: "channel", required: false, desc: "The channel to add or remove (not needed for list)" },
        ],
    },
    {
        name: "configure-logs", category: "Server Config", perm: "manageserver",
        desc: "Enable/disable server logging.",
        full: "Turns on logging for message edits/deletes, member joins/leaves, bans/unbans and role changes, and sets the destination channel.",
        params: [
            { name: "enabled", type: "boolean", required: true, desc: "Enable or disable logging" },
            { name: "channel", type: "channel", required: false, desc: "Channel where logs will be sent" },
        ],
    },
    {
        name: "configure-azkaban", category: "Server Config", perm: "manageserver",
        desc: "Enable/disable the Azkaban system.",
        full: "Turns the Azkaban prison system on or off and sets which role gets applied to sentenced members.",
        params: [
            { name: "enabled", type: "boolean", required: true, desc: "Enable or disable Azkaban" },
            { name: "role", type: "role", required: false, desc: "The Azkaban Prisoner role" },
        ],
    },
    {
        name: "sentence", category: "Moderation", perm: "manageroles",
        desc: "Send a member to Azkaban.",
        full: "Strips the target's current roles (saving them for later), applies the Prisoner role, and logs the reason. Cannot be used on the server owner, bots, or yourself.",
        params: [
            { name: "user", type: "user", required: true, desc: "The prisoner" },
            { name: "reason", type: "string", required: true, desc: "Reason for the sentence" },
            { name: "media", type: "attachment", required: false, desc: "Optional image or GIF" },
        ],
    },
    {
        name: "pardon", category: "Moderation", perm: "manageroles",
        desc: "Release a prisoner from Azkaban.",
        full: "Removes the Prisoner role and restores the member's previously saved roles.",
        params: [
            { name: "user", type: "user", required: true, desc: "The prisoner to release" },
            { name: "media", type: "attachment", required: false, desc: "Optional image or GIF" },
        ],
    },
    {
        name: "set-avatar", category: "Bot Identity", perm: "botmanager",
        desc: "Set the bot's server avatar.",
        full: "Uploads a new server-specific avatar for the bot, visible only in this server.",
        params: [
            { name: "image", type: "attachment", required: true, desc: "Avatar image" },
        ],
    },
    {
        name: "reset-avatar", category: "Bot Identity", perm: "botmanager",
        desc: "Reset the bot's avatar to default.",
        full: "Removes the server-specific avatar override, reverting to the bot's global avatar.",
        params: [],
    },
    {
        name: "set-banner", category: "Bot Identity", perm: "botmanager",
        desc: "Set the bot's server banner.",
        full: "Uploads a new server-specific profile banner for the bot.",
        params: [
            { name: "image", type: "attachment", required: true, desc: "Banner image" },
        ],
    },
    {
        name: "reset-banner", category: "Bot Identity", perm: "botmanager",
        desc: "Reset the bot's banner to default.",
        full: "Removes the server-specific banner override, reverting to the bot's default banner.",
        params: [],
    },
    {
        name: "guild-settings", category: "Server Config", perm: "manageserver",
        desc: "Open the full server settings dashboard.",
        full: "Opens an interactive in-Discord dashboard for configuring access roles (Admin/Bot Manager), house roles, XP rate and cooldown, House Cup point value, and starboard threshold — the same settings this web dashboard's Settings tab edits.",
        params: [],
    },
];
