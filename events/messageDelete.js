const { Events } = require('discord.js');
const { isLogTypeEnabled, sendLog, createLogEmbed, formatUser, truncate } = require('../utils/logging');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // Ignore DMs
        if (!message.guild) return;
        
        // Ignore bot messages
        if (message.author?.bot) return;
        
        // Check if message logging is enabled
        if (!isLogTypeEnabled(message.guild.id, 'messages')) return;
        
        const embed = createLogEmbed(
            '#2D1B69',
            'Message Deleted',
            null,
            [
                { name: 'Author', value: message.author ? formatUser(message.author) : 'Unknown', inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Message ID', value: message.id, inline: true },
                { name: 'Content', value: truncate(message.content || '*No text content*'), inline: false },
            ]
        );
        
        // Add attachment info if present
        if (message.attachments.size > 0) {
            const attachments = message.attachments.map(a => a.name).join(', ');
            embed.addFields({ name: 'Attachments', value: truncate(attachments), inline: false });
        }
        
        await sendLog(message.guild, 'messages', embed);
        
        console.log(`[LOG] Message deleted in ${message.guild.name} - #${message.channel.name}`);
    },
};
