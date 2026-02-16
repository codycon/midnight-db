const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Send verification message to a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the verification message')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        
        // Check if bot can send messages in the channel
        if (!channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Permission Error')
                .setDescription(`Missing permissions in ${channel}`)
                .addFields({
                    name: 'Required Permissions',
                    value: '• Send Messages\n• Embed Links'
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
        
        // Create verification embed
        const verifyEmbed = new EmbedBuilder()
            .setColor('#6C5CE7')
            .setTitle('Server Verification')
            .setDescription('Welcome! Click the button below to verify your account and gain access to the server.')
            .addFields(
                { name: 'Why Verify?', value: 'Verification helps us maintain a safe community and prevent automated accounts.' }
            )
            .setFooter({ text: 'Midnight Bot • Verification System' })
            .setTimestamp();
        
        // Create verification button
        const verifyButton = new ButtonBuilder()
            .setCustomId('verify_button')
            .setLabel('Verify Account')
            .setStyle(ButtonStyle.Primary);
        
        const row = new ActionRowBuilder()
            .addComponents(verifyButton);
        
        // Send verification message
        try {
            await channel.send({
                embeds: [verifyEmbed],
                components: [row]
            });
            
            const successEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Verification System Deployed')
                .setDescription(`Verification message has been sent to ${channel}`)
                .addFields(
                    { name: 'Important', value: 'Make sure you have configured an autorole with `/autorole`', inline: false },
                    { name: 'Channel', value: `${channel}`, inline: true },
                    { name: 'Status', value: 'Active', inline: true }
                )
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [successEmbed],
                ephemeral: true
            });
            
            console.log(`Verification message sent to ${channel.name} in ${interaction.guild.name}`);
            
        } catch (error) {
            console.error('Error sending verification message:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Deployment Failed')
                .setDescription('Unable to send verification message')
                .addFields({
                    name: 'Error',
                    value: error.message || 'Unknown error occurred'
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
    },
};
