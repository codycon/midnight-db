const { Events } = require('discord.js');
const { isLogTypeEnabled, sendLog, createLogEmbed, formatUser } = require('../utils/logging');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        // Check if member logging is enabled
        if (!isLogTypeEnabled(member.guild.id, 'members')) return;
        
        const roles = member.roles.cache
            .filter(role => role.id !== member.guild.id) // Exclude @everyone
            .map(role => role.name)
            .join(', ') || 'None';
        
        const embed = createLogEmbed(
            '#2D1B69',
            'Member Left',
            null,
            [
                { name: 'User', value: formatUser(member.user), inline: true },
                { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
                { name: 'Joined Server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
                { name: 'Roles', value: roles, inline: false },
            ]
        );
        
        if (member.user.avatarURL()) {
            embed.setThumbnail(member.user.avatarURL());
        }
        
        await sendLog(member.guild, 'members', embed);
        
        console.log(`[LOG] Member left ${member.guild.name}: ${member.user.tag}`);
    },
};
