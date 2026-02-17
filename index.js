const fs   = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

if (!process.env.DISCORD_TOKEN) {
    console.error('[FATAL] DISCORD_TOKEN is not set in .env');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration,
    ],
});

client.commands = new Collection();

// Load commands
const commandsRoot = path.join(__dirname, 'commands');
for (const folder of fs.readdirSync(commandsRoot)) {
    const folderPath = path.join(commandsRoot, folder);
    for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))) {
        const filePath = path.join(folderPath, file);
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`[COMMANDS] Loaded: ${command.data.name}`);
            } else {
                console.warn(`[COMMANDS] Missing data/execute in ${filePath}`);
            }
        } catch (err) {
            console.error(`[COMMANDS] Failed to load ${filePath}:`, err);
        }
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    const filePath = path.join(eventsPath, file);
    try {
        const event = require(filePath);
        const events = Array.isArray(event) ? event : [event];
        for (const evt of events) {
            const register = evt.once ? 'once' : 'on';
            client[register](evt.name, (...args) => evt.execute(...args));
            console.log(`[EVENTS] Registered: ${evt.name}${evt.once ? ' (once)' : ''}`);
        }
    } catch (err) {
        console.error(`[EVENTS] Failed to load ${filePath}:`, err);
    }
}

client.on('error', err  => console.error('[CLIENT] Error:', err));
client.on('warn',  msg  => console.warn('[CLIENT] Warning:', msg));

process.on('unhandledRejection', err => console.error('[PROCESS] Unhandled rejection:', err));
process.on('uncaughtException',  err => {
    console.error('[PROCESS] Uncaught exception:', err);
    process.exit(1);
});

const shutdown = async (signal) => {
    console.log(`[SHUTDOWN] ${signal} received, shutting down...`);
    try {
        await client.destroy();
        process.exit(0);
    } catch (err) {
        console.error('[SHUTDOWN] Error during shutdown:', err);
        process.exit(1);
    }
};
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('[FATAL] Login failed:', err);
    process.exit(1);
});
