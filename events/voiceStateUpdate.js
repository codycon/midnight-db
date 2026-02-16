const { Events } = require('discord.js');
const { isLogTypeEnabled, sendLog, createLogEmbed, formatUser } = require('../utils/logging');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        // Check if voice logging is enabled
        if (!isLogTypeEnabled(newState.guild.id, 'voice')) return;
        
        const member = newState.member;
        
        // User joined a voice channel
        if (!oldState.channel && newState.channel) {
            const embed = createLogEmbed(
                '#6C5CE7',
                'Joined Voice',
                null,
                [
                    { name: 'Member', value: formatUser(member.user), inline: true },
                    { name: 'Channel', value: `${newState.channel}`, inline: true },
                ]
            );
            
            await sendLog(newState.guild, 'voice', embed);
            console.log(`[LOG] ${member.user.tag} joined voice channel: ${newState.channel.name}`);
        }
        
        // User left a voice channel
        else if (oldState.channel && !newState.channel) {
            const embed = createLogEmbed(
                '#2D1B69',
                'Left Voice',
                null,
                [
                    { name: 'Member', value: formatUser(member.user), inline: true },
                    { name: 'Channel', value: `${oldState.channel}`, inline: true },
                ]
            );
            
            await sendLog(newState.guild, 'voice', embed);
            console.log(`[LOG] ${member.user.tag} left voice channel: ${oldState.channel.name}`);
        }
        
        // User switched voice channels
        else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            const embed = createLogEmbed(
                '#5F4B8B',
                'Switched Voice',
                null,
                [
                    { name: 'Member', value: formatUser(member.user), inline: true },
                    { name: 'From', value: `${oldState.channel}`, inline: true },
                    { name: 'To', value: `${newState.channel}`, inline: true },
                ]
            );
            
            await sendLog(newState.guild, 'voice', embed);
            console.log(`[LOG] ${member.user.tag} switched voice channels: ${oldState.channel.name} → ${newState.channel.name}`);
        }
        
        // User muted/unmuted
        else if (oldState.serverMute !== newState.serverMute) {
            const embed = createLogEmbed(
                newState.serverMute ? '#2D1B69' : '#6C5CE7',
                newState.serverMute ? 'Server Muted' : 'Server Unmuted',
                null,
                [
                    { name: 'Member', value: formatUser(member.user), inline: true },
                    { name: 'Channel', value: `${newState.channel}`, inline: true },
                ]
            );
            
            await sendLog(newState.guild, 'voice', embed);
            console.log(`[LOG] ${member.user.tag} was ${newState.serverMute ? 'muted' : 'unmuted'}`);
        }
        
        // User deafened/undeafened
        else if (oldState.serverDeaf !== newState.serverDeaf) {
            const embed = createLogEmbed(
                newState.serverDeaf ? '#2D1B69' : '#6C5CE7',
                newState.serverDeaf ? 'Server Deafened' : 'Server Undeafened',
                null,
                [
                    { name: 'Member', value: formatUser(member.user), inline: true },
                    { name: 'Channel', value: `${newState.channel}`, inline: true },
                ]
            );
            
            await sendLog(newState.guild, 'voice', embed);
            console.log(`[LOG] ${member.user.tag} was ${newState.serverDeaf ? 'deafened' : 'undeafened'}`);
        }
    },
};
