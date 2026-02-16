const { Events } = require('discord.js');
const { isLogTypeEnabled, sendLog, createLogEmbed, formatUser, truncate } = require('../utils/logging');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        // Ignore DMs
        if (!newMessage.guild) return;
        
        // Ignore bot messages
        if (newMessage.author?.bot) return;
        
        // Ignore if content didn't change (could be embed update)
        if (oldMessage.content === newMessage.content) return;
        
        // Check if message logging is enabled
        if (!isLogTypeEnabled(newMessage.guild.id, 'messages')) return;
        
        const embed = createLogEmbed(
            '#6C5CE7',
            'Message Edited',
            null,
            [
                { name: 'Author', value: formatUser(newMessage.author), inline: true },
                { name: 'Channel', value: `${newMessage.channel}`, inline: true },
                { name: 'Message ID', value: newMessage.id, inline: true },
                { name: 'Before', value: truncate(oldMessage.content || '*No content*'), inline: false },
                { name: 'After', value: truncate(newMessage.content || '*No content*'), inline: false },
                { name: 'Link', value: `[Jump to Message](${newMessage.url})`, inline: false },
            ]
        );
        
        await sendLog(newMessage.guild, 'messages', embed);
        
        console.log(`[LOG] Message edited in ${newMessage.guild.name} - #${newMessage.channel.name}`);
    },
};
