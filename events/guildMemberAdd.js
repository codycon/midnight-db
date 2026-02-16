const { Events, EmbedBuilder } = require('discord.js');
const { isLogTypeEnabled, sendLog, createLogEmbed, formatUser } = require('../utils/logging');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        console.log(`\n=== New Member Joined ===`);
        console.log(`User: ${member.user.tag}`);
        console.log(`Server: ${member.guild.name}`);
        
        // Note: With verification system enabled, roles are assigned when user clicks verify button
        // Auto-roles are no longer assigned on join
        console.log(`User must verify to receive role`);
        
        // Log member join
        if (isLogTypeEnabled(member.guild.id, 'members')) {
            const logEmbed = createLogEmbed(
                '#6C5CE7',
                'Member Joined',
                null,
                [
                    { name: 'User', value: formatUser(member.user), inline: true },
                    { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
                    { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                ]
            );
            
            if (member.user.avatarURL()) {
                logEmbed.setThumbnail(member.user.avatarURL());
            }
            
            await sendLog(member.guild, 'members', logEmbed);
        }
        
        // Create a welcome embed
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#6C5CE7')
            .setTitle(`Welcome to ${member.guild.name}`)
            .setDescription(`Hello ${member.user}! Thank you for joining our community.`)
            .addFields(
                { name: 'Verification Required', value: 'Please complete verification to gain full access to the server.', inline: false },
                { name: 'Server', value: member.guild.name, inline: true },
                { name: 'Members', value: `${member.guild.memberCount}`, inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: 'Midnight Bot' })
            .setTimestamp();
        
        // Try to send DM to the new member
        try {
            await member.send({ 
                content: `Welcome, ${member.user}!`,
                embeds: [welcomeEmbed] 
            });
            console.log(`Welcome DM sent to ${member.user.tag}`);
        } catch (error) {
            console.error(`Could not send DM to ${member.user.tag}: ${error.message}`);
        }
        
        console.log(`=== End Member Join ===\n`);
    },
};
