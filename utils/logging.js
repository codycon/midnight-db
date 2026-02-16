const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

/**
 * Get logging configuration for a guild
 */
function getLoggingConfig(guildId) {
    const logsPath = path.join(__dirname, '../data/logs.json');
    
    if (!fs.existsSync(logsPath)) {
        return null;
    }
    
    const logsConfig = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
    return logsConfig[guildId] || null;
}

/**
 * Check if a specific log type is enabled for a guild
 */
function isLogTypeEnabled(guildId, logType) {
    const config = getLoggingConfig(guildId);
    
    if (!config || !config.enabled || !config.channelId) {
        return false;
    }
    
    return config.types[logType] === true;
}

/**
 * Send a log embed to the configured logging channel
 */
async function sendLog(guild, logType, embed) {
    try {
        const config = getLoggingConfig(guild.id);
        
        if (!config || !config.enabled || !config.channelId) {
            return false;
        }
        
        if (!config.types[logType]) {
            return false;
        }
        
        const logChannel = await guild.channels.fetch(config.channelId).catch(() => null);
        
        if (!logChannel) {
            console.error(`[LOGGING] Log channel not found for guild ${guild.name}`);
            return false;
        }
        
        await logChannel.send({ embeds: [embed] });
        return true;
        
    } catch (error) {
        console.error('[LOGGING] Error sending log:', error.message);
        return false;
    }
}

/**
 * Create a standardized log embed
 */
function createLogEmbed(color, title, description, fields = []) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
    
    if (fields.length > 0) {
        embed.addFields(fields);
    }
    
    return embed;
}

/**
 * Format a user for logging
 */
function formatUser(user) {
    return `${user.tag} (${user.id})`;
}

/**
 * Truncate text if it's too long
 */
function truncate(text, maxLength = 1024) {
    if (!text) return 'None';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

module.exports = {
    getLoggingConfig,
    isLogTypeEnabled,
    sendLog,
    createLogEmbed,
    formatUser,
    truncate,
};
