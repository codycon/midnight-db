const { Events } = require('discord.js');
const { isLogTypeEnabled, sendLog, createLogEmbed } = require('../utils/logging');

module.exports = {
    name: Events.GuildUpdate,
    async execute(oldGuild, newGuild) {
        // Check if server logging is enabled
        if (!isLogTypeEnabled(newGuild.id, 'server')) return;
        
        const changes = [];
        
        // Check for name change
        if (oldGuild.name !== newGuild.name) {
            changes.push({ name: 'Name Changed', value: `${oldGuild.name} → ${newGuild.name}`, inline: false });
        }
        
        // Check for icon change
        if (oldGuild.iconURL() !== newGuild.iconURL()) {
            changes.push({ name: 'Icon Changed', value: 'Server icon was updated', inline: false });
        }
        
        // Check for banner change
        if (oldGuild.bannerURL() !== newGuild.bannerURL()) {
            changes.push({ name: 'Banner Changed', value: 'Server banner was updated', inline: false });
        }
        
        // Check for owner change
        if (oldGuild.ownerId !== newGuild.ownerId) {
            const newOwner = await newGuild.members.fetch(newGuild.ownerId).catch(() => null);
            changes.push({ 
                name: 'Owner Changed', 
                value: newOwner ? `<@${newOwner.id}>` : 'Unknown', 
                inline: false 
            });
        }
        
        // Check for verification level change
        if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
            changes.push({ 
                name: 'Verification Level', 
                value: `${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`, 
                inline: true 
            });
        }
        
        // Check for explicit content filter change
        if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
            changes.push({ 
                name: 'Content Filter', 
                value: `${oldGuild.explicitContentFilter} → ${newGuild.explicitContentFilter}`, 
                inline: true 
            });
        }
        
        // Check for AFK channel change
        if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
            const afkChannel = newGuild.afkChannel ? `${newGuild.afkChannel}` : 'None';
            changes.push({ 
                name: 'AFK Channel', 
                value: afkChannel, 
                inline: true 
            });
        }
        
        // Check for system channel change
        if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
            const systemChannel = newGuild.systemChannel ? `${newGuild.systemChannel}` : 'None';
            changes.push({ 
                name: 'System Channel', 
                value: systemChannel, 
                inline: true 
            });
        }
        
        // Only log if there were changes
        if (changes.length === 0) return;
        
        const embed = createLogEmbed(
            '#5F4B8B',
            'Server Settings Updated',
            null,
            changes
        );
        
        if (newGuild.iconURL()) {
            embed.setThumbnail(newGuild.iconURL());
        }
        
        await sendLog(newGuild, 'server', embed);
        
        console.log(`[LOG] Server settings updated in ${newGuild.name}`);
    },
};
