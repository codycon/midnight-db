const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

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
const guildId = process.env.GUILD_ID; // Optional - for testing only
const token = process.env.DISCORD_TOKEN;

const commands = [];

// Grab all the command folders from the commands directory
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`[LOAD] Loaded command: ${command.data.name}`);
            } else {
                console.warn(`[WARN] Command at ${filePath} is missing "data" or "execute" property`);
            }
        } catch (error) {
            console.error(`[ERROR] Failed to load command at ${filePath}:`, error);
        }
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// Deploy commands
(async () => {
    try {
        console.log(`[DEPLOY] Started refreshing ${commands.length} application (/) commands`);
        
        let data;
        
        if (guildId) {
            // Deploy to specific guild (instant, good for testing)
            console.log(`[DEPLOY] Deploying to guild: ${guildId}`);
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
        } else {
            // Deploy globally (takes up to 1 hour to propagate)
            console.log('[DEPLOY] Deploying globally (may take up to 1 hour)');
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
        }
        
        console.log(`[SUCCESS] Successfully reloaded ${data.length} application (/) commands`);
        
    } catch (error) {
        console.error('[ERROR] Failed to deploy commands:', error);
        process.exit(1);
    }
})();