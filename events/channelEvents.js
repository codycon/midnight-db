const { Events } = require('discord.js');
const { isLogTypeEnabled, sendLog, createLogEmbed } = require('../utils/logging');

// Channel Created
const channelCreate = {
    name: Events.ChannelCreate,
    async execute(channel) {
        // Ignore DM channels
        if (!channel.guild) return;
        
        if (!isLogTypeEnabled(channel.guild.id, 'channels')) return;
        
        const embed = createLogEmbed(
            '#6C5CE7',
            'Channel Created',
            null,
            [
                { name: 'Channel', value: `${channel}`, inline: true },
                { name: 'Type', value: channel.type, inline: true },
                { name: 'Channel ID', value: channel.id, inline: true },
            ]
        );
        
        if (channel.parent) {
            embed.addFields({ name: 'Category', value: channel.parent.name, inline: true });
        }
        
        await sendLog(channel.guild, 'channels', embed);
        
        console.log(`[LOG] Channel created in ${channel.guild.name}: #${channel.name}`);
    },
};

// Channel Deleted
const channelDelete = {
    name: Events.ChannelDelete,
    async execute(channel) {
        // Ignore DM channels
        if (!channel.guild) return;
        
        if (!isLogTypeEnabled(channel.guild.id, 'channels')) return;
        
        const embed = createLogEmbed(
            '#2D1B69',
            'Channel Deleted',
            null,
            [
                { name: 'Channel Name', value: channel.name, inline: true },
                { name: 'Type', value: channel.type, inline: true },
                { name: 'Channel ID', value: channel.id, inline: true },
            ]
        );
        
        if (channel.parent) {
            embed.addFields({ name: 'Category', value: channel.parent.name, inline: true });
        }
        
        await sendLog(channel.guild, 'channels', embed);
        
        console.log(`[LOG] Channel deleted from ${channel.guild.name}: #${channel.name}`);
    },
};

// Channel Updated
const channelUpdate = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        // Ignore DM channels
        if (!newChannel.guild) return;
        
        if (!isLogTypeEnabled(newChannel.guild.id, 'channels')) return;
        
        const changes = [];
        
        // Check for name change
        if (oldChannel.name !== newChannel.name) {
            changes.push({ name: 'Name Changed', value: `${oldChannel.name} → ${newChannel.name}`, inline: false });
        }
        
        // Check for topic change
        if (oldChannel.topic !== newChannel.topic) {
            changes.push({ 
                name: 'Topic Changed', 
                value: `Before: ${oldChannel.topic || '*None*'}\nAfter: ${newChannel.topic || '*None*'}`, 
                inline: false 
            });
        }
        
        // Check for NSFW change
        if (oldChannel.nsfw !== newChannel.nsfw) {
            changes.push({ name: 'NSFW', value: newChannel.nsfw ? 'Enabled' : 'Disabled', inline: true });
        }
        
        // Check for slowmode change
        if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
            changes.push({ 
                name: 'Slowmode', 
                value: `${oldChannel.rateLimitPerUser}s → ${newChannel.rateLimitPerUser}s`, 
                inline: true 
            });
        }
        
        // Only log if there were changes
        if (changes.length === 0) return;
        
        const embed = createLogEmbed(
            '#5F4B8B',
            'Channel Updated',
            null,
            [
                { name: 'Channel', value: `${newChannel}`, inline: true },
                { name: 'Channel ID', value: newChannel.id, inline: true },
                ...changes
            ]
        );
        
        await sendLog(newChannel.guild, 'channels', embed);
        
        console.log(`[LOG] Channel updated in ${newChannel.guild.name}: #${newChannel.name}`);
    },
};

module.exports = [channelCreate, channelDelete, channelUpdate];
