const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a member')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to timeout')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration in minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320)) // 28 days max
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for timeout')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
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
        
        // Check if target is moderatable
        if (!targetMember.moderatable) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Cannot Timeout Member')
                .setDescription(`${targetUser} has higher permissions than the bot.`)
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
        
        // Check if user is trying to timeout themselves
        if (targetUser.id === interaction.user.id) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Invalid Action')
                .setDescription('You cannot timeout yourself.')
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
        
        // Check role hierarchy
        if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Insufficient Permissions')
                .setDescription('You cannot timeout someone with equal or higher role than you.')
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
        
        try {
            // Calculate duration in milliseconds
            const durationMs = duration * 60 * 1000;
            
            await targetMember.timeout(durationMs, reason);
            
            // Try to DM the user
            const dmEmbed = new EmbedBuilder()
                .setColor('#5F4B8B')
                .setTitle('You Have Been Timed Out')
                .setDescription(`You have been timed out in **${interaction.guild.name}**`)
                .addFields(
                    { name: 'Duration', value: `${duration} minute(s)`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            try {
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log(`Could not DM ${targetUser.tag}`);
            }
            
            const successEmbed = new EmbedBuilder()
                .setColor('#5F4B8B')
                .setTitle('Member Timed Out')
                .setDescription(`${targetUser} has been timed out`)
                .addFields(
                    { name: 'Duration', value: `${duration} minute(s)`, inline: true },
                    { name: 'Moderator', value: `${interaction.user}`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [successEmbed]
            });
            
            console.log(`[TIMEOUT] ${targetUser.tag} timed out for ${duration} minutes by ${interaction.user.tag}`);
            
        } catch (error) {
            console.error('Error timing out member:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Timeout Failed')
                .setDescription('An error occurred while timing out the member.')
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
    },
};
