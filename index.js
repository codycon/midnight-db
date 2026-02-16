const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

// Create a new client instance with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // REQUIRED for welcome messages and auto-roles
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions, // REQUIRED for suggestion voting
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
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`Loaded command: ${command.data.name}`);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing "data" or "execute" property.`);
        }
    }
}

// Load event files
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    // Handle both single event exports and array exports
    const events = Array.isArray(event) ? event : [event];
    
    for (const evt of events) {
        if (evt.once) {
            client.once(evt.name, (...args) => evt.execute(...args));
        } else {
            client.on(evt.name, (...args) => evt.execute(...args));
        }
        console.log(`Loaded event: ${evt.name}`);
    }
}

// Initialize scheduled tasks after bot is ready
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
    console.log(`👥 Connected to ${client.users.cache.size} users`);
    
    const ScheduledTasks = require('./utils/scheduledTasks');
    new ScheduledTasks(client);
    console.log('[SCHEDULED] Automated tasks initialized');
});

// Error handling
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

// Warning handler
client.on('warn', (warning) => {
    console.warn('Discord client warning:', warning);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[SHUTDOWN] Received SIGINT, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[SHUTDOWN] Received SIGTERM, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Login to Discord
client.login(token);
