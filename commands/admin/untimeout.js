const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Remove timeout from a member')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to remove timeout from')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        
        if (!targetMember) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Member Not Found')
                .setDescription('This user is not in the server.')
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
        
        if (!targetMember.communicationDisabledUntil) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Not Timed Out')
                .setDescription(`${targetUser} is not currently timed out.`)
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
        
        try {
            await targetMember.timeout(null);
            
            // Try to DM the user
            const dmEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Timeout Removed')
                .setDescription(`Your timeout has been removed in **${interaction.guild.name}**`)
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            try {
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log(`Could not DM ${targetUser.tag}`);
            }
            
            const successEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Timeout Removed')
                .setDescription(`${targetUser} can now participate in the server again`)
                .addFields(
                    { name: 'Moderator', value: `${interaction.user}`, inline: true }
                )
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [successEmbed]
            });
            
            console.log(`[UNTIMEOUT] ${targetUser.tag} timeout removed by ${interaction.user.tag}`);
            
        } catch (error) {
            console.error('Error removing timeout:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Remove Timeout Failed')
                .setDescription('An error occurred while removing the timeout.')
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
    },
};
