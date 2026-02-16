const { Events } = require('discord.js');
const { isLogTypeEnabled, sendLog, createLogEmbed, formatUser } = require('../utils/logging');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        // Check for role changes
        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
            if (!isLogTypeEnabled(newMember.guild.id, 'roles')) return;
            
            const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
            const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
            
            if (addedRoles.size > 0) {
                const embed = createLogEmbed(
                    '#6C5CE7',
                    'Role Added',
                    null,
                    [
                        { name: 'Member', value: formatUser(newMember.user), inline: true },
                        { name: 'Role', value: addedRoles.map(r => `${r}`).join(', '), inline: true },
                    ]
                );
                
                await sendLog(newMember.guild, 'roles', embed);
                console.log(`[LOG] Role added to ${newMember.user.tag}: ${addedRoles.map(r => r.name).join(', ')}`);
            }
            
            if (removedRoles.size > 0) {
                const embed = createLogEmbed(
                    '#2D1B69',
                    'Role Removed',
                    null,
                    [
                        { name: 'Member', value: formatUser(newMember.user), inline: true },
                        { name: 'Role', value: removedRoles.map(r => `${r}`).join(', '), inline: true },
                    ]
                );
                
                await sendLog(newMember.guild, 'roles', embed);
                console.log(`[LOG] Role removed from ${newMember.user.tag}: ${removedRoles.map(r => r.name).join(', ')}`);
            }
        }
        
        // Check for nickname changes
        if (oldMember.nickname !== newMember.nickname) {
            if (!isLogTypeEnabled(newMember.guild.id, 'members')) return;
            
            const embed = createLogEmbed(
                '#5F4B8B',
                'Nickname Changed',
                null,
                [
                    { name: 'Member', value: formatUser(newMember.user), inline: true },
                    { name: 'Before', value: oldMember.nickname || '*No nickname*', inline: true },
                    { name: 'After', value: newMember.nickname || '*No nickname*', inline: true },
                ]
            );
            
            await sendLog(newMember.guild, 'members', embed);
            console.log(`[LOG] Nickname changed for ${newMember.user.tag}: ${oldMember.nickname} → ${newMember.nickname}`);
        }
        
        // Check for timeout changes
        if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
            if (!isLogTypeEnabled(newMember.guild.id, 'moderation')) return;
            
            if (newMember.communicationDisabledUntil) {
                const embed = createLogEmbed(
                    '#2D1B69',
                    'Member Timed Out',
                    null,
                    [
                        { name: 'Member', value: formatUser(newMember.user), inline: true },
                        { name: 'Until', value: `<t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:F>`, inline: true },
                    ]
                );
                
                await sendLog(newMember.guild, 'moderation', embed);
                console.log(`[LOG] Member timed out: ${newMember.user.tag}`);
            } else {
                const embed = createLogEmbed(
                    '#6C5CE7',
                    'Timeout Removed',
                    null,
                    [
                        { name: 'Member', value: formatUser(newMember.user), inline: true },
                    ]
                );
                
                await sendLog(newMember.guild, 'moderation', embed);
                console.log(`[LOG] Timeout removed: ${newMember.user.tag}`);
            }
        }
    },
};
