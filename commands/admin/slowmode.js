const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set channel slowmode')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Slowmode delay in seconds (0 to disable)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)) // 6 hours max
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to set slowmode (defaults to current)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        const seconds = interaction.options.getInteger('seconds');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        
        // Check if channel is a text channel
        if (!channel.isTextBased() || channel.isDMBased()) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Invalid Channel')
                .setDescription('Slowmode can only be set on text channels.')
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
        
        try {
            await channel.setRateLimitPerUser(seconds);
            
            if (seconds === 0) {
                const successEmbed = new EmbedBuilder()
                    .setColor('#6C5CE7')
                    .setTitle('Slowmode Disabled')
                    .setDescription(`Members can now send messages freely in ${channel}`)
                    .addFields(
                        { name: 'Channel', value: `${channel}`, inline: true },
                        { name: 'Configured By', value: `${interaction.user}`, inline: true }
                    )
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                await interaction.reply({
                    embeds: [successEmbed]
                });
            } else {
                const successEmbed = new EmbedBuilder()
                    .setColor('#6C5CE7')
                    .setTitle('Slowmode Configured')
                    .setDescription(`Members must wait between messages in ${channel}`)
                    .addFields(
                        { name: 'Delay', value: `${seconds} second(s)`, inline: true },
                        { name: 'Channel', value: `${channel}`, inline: true },
                        { name: 'Configured By', value: `${interaction.user}`, inline: true }
                    )
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                await interaction.reply({
                    embeds: [successEmbed]
                });
            }
            
            console.log(`[SLOWMODE] ${channel.name} set to ${seconds}s by ${interaction.user.tag}`);
            
        } catch (error) {
            console.error('Error setting slowmode:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Slowmode Failed')
                .setDescription('An error occurred while setting slowmode.')
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
    },
};
