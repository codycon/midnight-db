const { Events } = require('discord.js');
const { isLogTypeEnabled, sendLog, createLogEmbed, formatUser } = require('../utils/logging');

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban) {
        // Check if moderation logging is enabled
        if (!isLogTypeEnabled(ban.guild.id, 'moderation')) return;
        
        const embed = createLogEmbed(
            '#2D1B69',
            'Member Banned',
            null,
            [
                { name: 'User', value: formatUser(ban.user), inline: true },
                { name: 'Reason', value: ban.reason || 'No reason provided', inline: false },
            ]
        );
        
        if (ban.user.avatarURL()) {
            embed.setThumbnail(ban.user.avatarURL());
        }
        
        await sendLog(ban.guild, 'moderation', embed);
        
        console.log(`[LOG] User banned from ${ban.guild.name}: ${ban.user.tag}`);
    },
};
