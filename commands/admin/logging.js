const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('Configure server logging')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set a channel for logging')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send logs to')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Disable logging'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        const dataDir = path.join(__dirname, '../../data');
        const logsPath = path.join(dataDir, 'logs.json');
        
        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Load existing logs config
        let logsConfig = {};
        if (fs.existsSync(logsPath)) {
            logsConfig = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
        }
        
        // Initialize guild config if it doesn't exist
        if (!logsConfig[interaction.guildId]) {
            logsConfig[interaction.guildId] = {
                channelId: null,
                enabled: true,
                types: {
                    messages: true,
                    members: true,
                    roles: true,
                    channels: true,
                    moderation: true,
                    server: true,
                    voice: true,
                }
            };
        }
        
        const subcommand = interaction.options.getSubcommand();
        const guildConfig = logsConfig[interaction.guildId];
        
        if (subcommand === 'setup') {
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
            
            guildConfig.channelId = channel.id;
            guildConfig.enabled = true;
            
            fs.writeFileSync(logsPath, JSON.stringify(logsConfig, null, 2));
            
            // Send test log to the channel
            const testEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Logging System Enabled')
                .setDescription('This channel will now receive all server activity logs.')
                .addFields(
                    { name: 'Configured By', value: `${interaction.user}`, inline: true },
                    { name: 'Server', value: interaction.guild.name, inline: true },
                    { name: 'Status', value: 'Active', inline: true }
                )
                .setFooter({ text: 'Midnight Bot • Logging System' })
                .setTimestamp();
            
            await channel.send({ embeds: [testEmbed] });
            
            const successEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Logging Configured')
                .setDescription('All server events will be logged to the specified channel.')
                .addFields(
                    { name: 'Log Channel', value: `${channel}`, inline: false },
                    { name: 'Events Tracked', value: '• Messages\n• Members\n• Roles\n• Channels\n• Moderation\n• Voice\n• Server Settings', inline: false }
                )
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [successEmbed],
                ephemeral: true
            });
            
            console.log(`[LOG] Enabled for ${interaction.guild.name} in ${channel.name}`);
            
        } else if (subcommand === 'stop') {
            if (!guildConfig.channelId) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setTitle('Logging Not Configured')
                    .setDescription('Logging is not currently set up for this server.')
                    .addFields({
                        name: 'Setup',
                        value: 'Use `/log setup` to enable logging'
                    })
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                return interaction.reply({
                    embeds: [errorEmbed],
                    ephemeral: true
                });
            }
            
            guildConfig.enabled = false;
            fs.writeFileSync(logsPath, JSON.stringify(logsConfig, null, 2));
            
            const successEmbed = new EmbedBuilder()
                .setColor('#5F4B8B')
                .setTitle('Logging Disabled')
                .setDescription('Server logging has been stopped.')
                .addFields({
                    name: 'Re-enable',
                    value: 'Use `/log setup` to turn logging back on'
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [successEmbed],
                ephemeral: true
            });
            
            console.log(`[LOG] Disabled for ${interaction.guild.name}`);
        }
    },
};
