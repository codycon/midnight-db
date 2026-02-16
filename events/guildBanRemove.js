const { Events } = require('discord.js');
const { isLogTypeEnabled, sendLog, createLogEmbed, formatUser } = require('../utils/logging');

module.exports = {
    name: Events.GuildBanRemove,
    async execute(ban) {
        // Check if moderation logging is enabled
        if (!isLogTypeEnabled(ban.guild.id, 'moderation')) return;
        
        const embed = createLogEmbed(
            '#6C5CE7',
            'Member Unbanned',
            null,
            [
                { name: 'User', value: formatUser(ban.user), inline: true },
            ]
        );
        
        if (ban.user.avatarURL()) {
            embed.setThumbnail(ban.user.avatarURL());
        }
        
        await sendLog(ban.guild, 'moderation', embed);
        
        console.log(`[LOG] User unbanned from ${ban.guild.name}: ${ban.user.tag}`);
    },
};
