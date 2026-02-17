const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// Validate required environment variables
if (!process.env.DISCORD_TOKEN) {
    console.error('[ERROR] DISCORD_TOKEN is not set in .env file');
    process.exit(1);
}

// Create a new client instance with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration, // For ban/kick logs
    ],
});

// Initialize commands collection
client.commands = new Collection();

// Load command files
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`[LOAD] Command loaded: ${command.data.name}`);
            } else {
                console.warn(`[WARN] Command at ${filePath} is missing "data" or "execute" property`);
            }
        } catch (error) {
            console.error(`[ERROR] Failed to load command at ${filePath}:`, error);
        }
    }
}

// Load event files
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
        const event = require(filePath);
        
        // Handle both single event exports and array exports
        const events = Array.isArray(event) ? event : [event];
        
        for (const evt of events) {
            if (evt.once) {
                client.once(evt.name, (...args) => evt.execute(...args));
            } else {
                client.on(evt.name, (...args) => evt.execute(...args));
            }
            console.log(`[LOAD] Event loaded: ${evt.name}${evt.once ? ' (once)' : ''}`);
        }
    } catch (error) {
        console.error(`[ERROR] Failed to load event at ${filePath}:`, error);
    }
}

// Initialize scheduled tasks after bot is ready
client.once('ready', () => {
    console.log(`[READY] Logged in as ${client.user.tag}`);
    console.log(`[READY] Serving ${client.guilds.cache.size} guild(s)`);
    console.log(`[READY] Connected to ${client.users.cache.size} user(s)`);
    
    try {
        const ScheduledTasks = require('./utils/scheduledTasks');
        new ScheduledTasks(client);
        console.log('[READY] Automated tasks initialized');
    } catch (error) {
        console.error('[ERROR] Failed to initialize scheduled tasks:', error);
    }
});

// Error handling
client.on('error', (error) => {
    console.error('[ERROR] Discord client error:', error);
});

// Warning handler
client.on('warn', (warning) => {
    console.warn('[WARN] Discord client warning:', warning);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (error) => {
    console.error('[ERROR] Unhandled promise rejection:', error);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`\n[SHUTDOWN] Received ${signal}, shutting down gracefully...`);
    try {
        await client.destroy();
        console.log('[SHUTDOWN] Discord client destroyed');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Login to Discord
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('[FATAL] Failed to login:', error);
    process.exit(1);
});
