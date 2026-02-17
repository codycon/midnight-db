const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// Stub out runtime-only modules so commands can be loaded just for their
// slash-command schema without needing the database or Discord client.
const Module = require('module');
const _originalLoad = Module._load;
const STUBS = [
    'utils/ticketDatabase',
    'utils/ticketManager',
    'utils/transcriptGenerator',
    'utils/database',
    'utils/automodChecker',
    'utils/automodActions',
    'utils/scheduledTasks',
    'better-sqlite3',
];
Module._load = function (request, parent, isMain) {
    if (STUBS.some(s => request.includes(s))) return {};
    return _originalLoad.apply(this, arguments);
};

// Validate required environment variables
if (!process.env.DISCORD_CLIENT_ID) {
    console.error('[ERROR] DISCORD_CLIENT_ID is not set in .env file');
    process.exit(1);
}

if (!process.env.DISCORD_TOKEN) {
    console.error('[ERROR] DISCORD_TOKEN is not set in .env file');
    process.exit(1);
}

const clientId = process.env.DISCORD_CLIENT_ID;
const guildId  = process.env.GUILD_ID; // Optional — instant deploy for testing
const token    = process.env.DISCORD_TOKEN;

const commands = [];

const foldersPath   = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`[LOAD] ${command.data.name}`);
            } else {
                console.warn(`[WARN] Skipping ${filePath} — missing "data" or "execute"`);
            }
        } catch (error) {
            console.error(`[ERROR] Failed to load ${filePath}:`, error.message);
        }
    }
}

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`\n[DEPLOY] Registering ${commands.length} command(s)...`);

        let data;
        if (guildId) {
            console.log(`[DEPLOY] Guild deploy → ${guildId} (instant)`);
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
        } else {
            console.log('[DEPLOY] Global deploy (up to 1 hour to propagate)');
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
        }

        console.log(`[SUCCESS] Registered ${data.length} command(s).`);
    } catch (error) {
        console.error('[ERROR] Deploy failed:', error);
        process.exit(1);
    }
})();
