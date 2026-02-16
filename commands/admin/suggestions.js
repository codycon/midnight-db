const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggestions')
        .setDescription('Manage the suggestions system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up suggestions channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for suggestions')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('approve')
                .setDescription('Approve a suggestion')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Suggestion ID')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('response')
                        .setDescription('Response message')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deny')
                .setDescription('Deny a suggestion')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Suggestion ID')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for denial')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('implement')
                .setDescription('Mark suggestion as implemented')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Suggestion ID')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('note')
                        .setDescription('Implementation note')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all suggestions')
                .addStringOption(option =>
                    option.setName('filter')
                        .setDescription('Filter by status')
                        .setRequired(false)
                        .addChoices(
                            { name: 'All', value: 'all' },
                            { name: 'Pending', value: 'pending' },
                            { name: 'Approved', value: 'approved' },
                            { name: 'Denied', value: 'denied' },
                            { name: 'Implemented', value: 'implemented' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable suggestions system'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        const dataDir = path.join(__dirname, '../../data');
        const suggestionsPath = path.join(dataDir, 'suggestions.json');
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        let suggestionsConfig = {};
        if (fs.existsSync(suggestionsPath)) {
            suggestionsConfig = JSON.parse(fs.readFileSync(suggestionsPath, 'utf8'));
        }
        
        if (!suggestionsConfig[interaction.guildId]) {
            suggestionsConfig[interaction.guildId] = {
                channelId: null,
                suggestions: []
            };
        }
        
        const subcommand = interaction.options.getSubcommand();
        const guildConfig = suggestionsConfig[interaction.guildId];
        
        if (subcommand === 'setup') {
            const channel = interaction.options.getChannel('channel');
            
            if (!channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks', 'AddReactions'])) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setTitle('Permission Error')
                    .setDescription(`Missing permissions in ${channel}`)
                    .addFields({
                        name: 'Required Permissions',
                        value: '• Send Messages\n• Embed Links\n• Add Reactions'
                    })
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
            
            guildConfig.channelId = channel.id;
            fs.writeFileSync(suggestionsPath, JSON.stringify(suggestionsConfig, null, 2));
            
            const setupEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Suggestions Configured')
                .setDescription('The suggestions system has been set up.')
                .addFields(
                    { name: 'Suggestions Channel', value: `${channel}`, inline: false },
                    { name: 'How to Use', value: 'Members can use `/suggest` to submit suggestions', inline: false },
                    { name: 'Management', value: 'Use `/suggestions approve/deny/implement` to manage submissions', inline: false }
                )
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [setupEmbed], ephemeral: true });
            
        } else if (subcommand === 'approve') {
            const id = interaction.options.getInteger('id');
            const response = interaction.options.getString('response') || 'This suggestion has been approved!';
            
            const suggestion = guildConfig.suggestions.find(s => s.id === id);
            
            if (!suggestion) {
                return interaction.reply({ content: `Suggestion #${id} not found`, ephemeral: true });
            }
            
            suggestion.status = 'approved';
            suggestion.respondedBy = interaction.user.tag;
            suggestion.response = response;
            suggestion.respondedAt = Date.now();
            
            // Update the message
            const channel = await interaction.guild.channels.fetch(suggestion.channelId).catch(() => null);
            if (channel) {
                const message = await channel.messages.fetch(suggestion.messageId).catch(() => null);
                if (message) {
                    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                        .setColor('#6C5CE7')
                        .spliceFields(1, 1, { name: 'Status', value: '✅ Approved', inline: true })
                        .addFields({ name: 'Response', value: response, inline: false });
                    
                    await message.edit({ embeds: [updatedEmbed] });
                }
            }
            
            fs.writeFileSync(suggestionsPath, JSON.stringify(suggestionsConfig, null, 2));
            
            const confirmEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Suggestion Approved')
                .setDescription(`Suggestion #${id} has been approved.`)
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
            
            // DM the suggester
            try {
                const user = await interaction.client.users.fetch(suggestion.userId);
                const dmEmbed = new EmbedBuilder()
                    .setColor('#6C5CE7')
                    .setTitle('Your Suggestion Was Approved')
                    .setDescription(`Your suggestion in **${interaction.guild.name}** has been approved!`)
                    .addFields(
                        { name: 'Suggestion', value: suggestion.suggestion, inline: false },
                        { name: 'Response', value: response, inline: false }
                    )
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                await user.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log(`Could not DM user ${suggestion.userTag}`);
            }
            
        } else if (subcommand === 'deny') {
            const id = interaction.options.getInteger('id');
            const reason = interaction.options.getString('reason') || 'This suggestion has been denied.';
            
            const suggestion = guildConfig.suggestions.find(s => s.id === id);
            
            if (!suggestion) {
                return interaction.reply({ content: `Suggestion #${id} not found`, ephemeral: true });
            }
            
            suggestion.status = 'denied';
            suggestion.respondedBy = interaction.user.tag;
            suggestion.response = reason;
            suggestion.respondedAt = Date.now();
            
            // Update the message
            const channel = await interaction.guild.channels.fetch(suggestion.channelId).catch(() => null);
            if (channel) {
                const message = await channel.messages.fetch(suggestion.messageId).catch(() => null);
                if (message) {
                    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                        .setColor('#2D1B69')
                        .spliceFields(1, 1, { name: 'Status', value: '❌ Denied', inline: true })
                        .addFields({ name: 'Reason', value: reason, inline: false });
                    
                    await message.edit({ embeds: [updatedEmbed] });
                }
            }
            
            fs.writeFileSync(suggestionsPath, JSON.stringify(suggestionsConfig, null, 2));
            
            const confirmEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Suggestion Denied')
                .setDescription(`Suggestion #${id} has been denied.`)
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
            
            // DM the suggester
            try {
                const user = await interaction.client.users.fetch(suggestion.userId);
                const dmEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setTitle('Your Suggestion Was Denied')
                    .setDescription(`Your suggestion in **${interaction.guild.name}** has been denied.`)
                    .addFields(
                        { name: 'Suggestion', value: suggestion.suggestion, inline: false },
                        { name: 'Reason', value: reason, inline: false }
                    )
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                await user.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log(`Could not DM user ${suggestion.userTag}`);
            }
            
        } else if (subcommand === 'implement') {
            const id = interaction.options.getInteger('id');
            const note = interaction.options.getString('note') || 'This suggestion has been implemented!';
            
            const suggestion = guildConfig.suggestions.find(s => s.id === id);
            
            if (!suggestion) {
                return interaction.reply({ content: `Suggestion #${id} not found`, ephemeral: true });
            }
            
            suggestion.status = 'implemented';
            suggestion.respondedBy = interaction.user.tag;
            suggestion.response = note;
            suggestion.respondedAt = Date.now();
            
            // Update the message
            const channel = await interaction.guild.channels.fetch(suggestion.channelId).catch(() => null);
            if (channel) {
                const message = await channel.messages.fetch(suggestion.messageId).catch(() => null);
                if (message) {
                    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                        .setColor('#5F4B8B')
                        .spliceFields(1, 1, { name: 'Status', value: '✨ Implemented', inline: true })
                        .addFields({ name: 'Note', value: note, inline: false });
                    
                    await message.edit({ embeds: [updatedEmbed] });
                }
            }
            
            fs.writeFileSync(suggestionsPath, JSON.stringify(suggestionsConfig, null, 2));
            
            const confirmEmbed = new EmbedBuilder()
                .setColor('#5F4B8B')
                .setTitle('Suggestion Implemented')
                .setDescription(`Suggestion #${id} has been marked as implemented.`)
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
            
            // DM the suggester
            try {
                const user = await interaction.client.users.fetch(suggestion.userId);
                const dmEmbed = new EmbedBuilder()
                    .setColor('#5F4B8B')
                    .setTitle('Your Suggestion Was Implemented')
                    .setDescription(`Your suggestion in **${interaction.guild.name}** has been implemented!`)
                    .addFields(
                        { name: 'Suggestion', value: suggestion.suggestion, inline: false },
                        { name: 'Note', value: note, inline: false }
                    )
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                await user.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log(`Could not DM user ${suggestion.userTag}`);
            }
            
        } else if (subcommand === 'list') {
            const filter = interaction.options.getString('filter') || 'all';
            
            let suggestions = guildConfig.suggestions;
            if (filter !== 'all') {
                suggestions = suggestions.filter(s => s.status === filter);
            }
            
            if (suggestions.length === 0) {
                return interaction.reply({ content: `No suggestions found with filter: ${filter}`, ephemeral: true });
            }
            
            const listEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Suggestions List')
                .setDescription(`Filter: ${filter.charAt(0).toUpperCase() + filter.slice(1)}`)
                .setFooter({ text: `Midnight Bot • ${suggestions.length} suggestion(s)` })
                .setTimestamp();
            
            suggestions.slice(0, 25).forEach(s => {
                const statusEmoji = {
                    pending: '⏳',
                    approved: '✅',
                    denied: '❌',
                    implemented: '✨'
                }[s.status];
                
                listEmbed.addFields({
                    name: `${statusEmoji} #${s.id} - ${s.userTag}`,
                    value: s.suggestion.substring(0, 100) + (s.suggestion.length > 100 ? '...' : ''),
                    inline: false
                });
            });
            
            if (suggestions.length > 25) {
                listEmbed.setDescription(listEmbed.data.description + `\n\nShowing 25 of ${suggestions.length} suggestions`);
            }
            
            await interaction.reply({ embeds: [listEmbed], ephemeral: true });
            
        } else if (subcommand === 'disable') {
            guildConfig.channelId = null;
            fs.writeFileSync(suggestionsPath, JSON.stringify(suggestionsConfig, null, 2));
            
            const disableEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Suggestions Disabled')
                .setDescription('The suggestions system has been disabled.')
                .addFields({
                    name: 'Re-enable',
                    value: 'Use `/suggestions setup` to turn it back on'
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [disableEmbed], ephemeral: true });
        }
    },
};
