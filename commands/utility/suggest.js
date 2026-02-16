const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggest')
        .setDescription('Submit a suggestion')
        .addStringOption(option =>
            option.setName('suggestion')
                .setDescription('Your suggestion')
                .setRequired(true)
                .setMaxLength(1024)),
    
    async execute(interaction) {
        const suggestion = interaction.options.getString('suggestion');
        
        // Load suggestions config
        const dataDir = path.join(__dirname, '../../data');
        const suggestionsPath = path.join(dataDir, 'suggestions.json');
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        let suggestionsConfig = {};
        if (fs.existsSync(suggestionsPath)) {
            suggestionsConfig = JSON.parse(fs.readFileSync(suggestionsPath, 'utf8'));
        }
        
        // Check if suggestions are configured
        if (!suggestionsConfig[interaction.guildId] || !suggestionsConfig[interaction.guildId].channelId) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Suggestions Not Configured')
                .setDescription('Suggestions have not been set up for this server.')
                .addFields({
                    name: 'Contact Administrator',
                    value: 'Ask a server admin to set up suggestions with `/suggestions setup`'
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
        
        const guildConfig = suggestionsConfig[interaction.guildId];
        
        // Check cooldown (24 hours)
        if (!guildConfig.cooldowns) {
            guildConfig.cooldowns = {};
        }
        
        const lastSuggestionTime = guildConfig.cooldowns[interaction.user.id] || 0;
        const now = Date.now();
        const cooldownTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const timeLeft = (lastSuggestionTime + cooldownTime) - now;
        
        if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            
            const cooldownEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Cooldown Active')
                .setDescription('You can only submit one suggestion per day.')
                .addFields({
                    name: 'Time Remaining',
                    value: hours > 0 
                        ? `${hours} hour(s) and ${minutes} minute(s)` 
                        : `${minutes} minute(s)`,
                    inline: true
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
        }
        
        // Get suggestions channel
        const suggestionsChannel = await interaction.guild.channels.fetch(guildConfig.channelId).catch(() => null);
        
        if (!suggestionsChannel) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Channel Not Found')
                .setDescription('The suggestions channel no longer exists.')
                .addFields({
                    name: 'Contact Administrator',
                    value: 'Ask a server admin to reconfigure suggestions'
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
        
        // Initialize suggestions array
        if (!guildConfig.suggestions) {
            guildConfig.suggestions = [];
        }
        
        // Generate suggestion ID
        const suggestionId = guildConfig.suggestions.length + 1;
        
        // Create suggestion embed
        const suggestionEmbed = new EmbedBuilder()
            .setColor('#6C5CE7')
            .setTitle(`Suggestion #${suggestionId}`)
            .setDescription(suggestion)
            .addFields(
                { name: 'Submitted By', value: `${interaction.user}`, inline: true },
                { name: 'Status', value: 'Pending', inline: true },
                { name: 'Votes', value: '👍 0 | 👎 0', inline: true }
            )
            .setFooter({ text: 'Midnight Bot • Suggestions' })
            .setTimestamp();
        
        try {
            // Send to suggestions channel
            const suggestionMessage = await suggestionsChannel.send({ embeds: [suggestionEmbed] });
            
            // Add reactions for voting
            await suggestionMessage.react('👍');
            await suggestionMessage.react('👎');
            
            // Save suggestion
            guildConfig.suggestions.push({
                id: suggestionId,
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                suggestion: suggestion,
                status: 'pending',
                messageId: suggestionMessage.id,
                channelId: suggestionsChannel.id,
                timestamp: Date.now()
            });
            
            // Set cooldown
            guildConfig.cooldowns[interaction.user.id] = now;
            
            fs.writeFileSync(suggestionsPath, JSON.stringify(suggestionsConfig, null, 2));
            
            // Confirm to user
            const confirmEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Suggestion Submitted')
                .setDescription('Your suggestion has been posted for community voting.')
                .addFields(
                    { name: 'Suggestion ID', value: `#${suggestionId}`, inline: true },
                    { name: 'Channel', value: `${suggestionsChannel}`, inline: true },
                    { name: 'Next Suggestion', value: 'Available in 24 hours', inline: false }
                )
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
            
            console.log(`[SUGGEST] ${interaction.user.tag} submitted suggestion #${suggestionId}`);
            
        } catch (error) {
            console.error('Error submitting suggestion:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Submission Failed')
                .setDescription('An error occurred while submitting your suggestion.')
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};
