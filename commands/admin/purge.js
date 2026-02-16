const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete multiple messages at once')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-1000)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Only delete messages from this user')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('bots')
                .setDescription('Only delete messages from bots')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');
        const botsOnly = interaction.options.getBoolean('bots') || false;
        
        // Defer reply since fetching and deleting messages takes time
        await interaction.deferReply({ ephemeral: true });
        
        try {
            let deletedCount = 0;
            let oldMessagesCount = 0;
            const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
            
            // Discord limits bulk delete to 100 at a time, so we need to loop
            let remaining = amount;
            
            while (remaining > 0 && deletedCount < amount) {
                const fetchAmount = Math.min(remaining, 100);
                const messages = await interaction.channel.messages.fetch({ limit: fetchAmount });
                
                if (messages.size === 0) break;
                
                // Filter messages based on options
                let messagesToDelete = Array.from(messages.values());
                
                if (targetUser) {
                    messagesToDelete = messagesToDelete.filter(msg => msg.author.id === targetUser.id);
                }
                
                if (botsOnly) {
                    messagesToDelete = messagesToDelete.filter(msg => msg.author.bot);
                }
                
                // Filter out messages older than 14 days
                const recentMessages = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
                oldMessagesCount += messagesToDelete.length - recentMessages.length;
                
                if (recentMessages.length === 0) break;
                
                // Bulk delete messages
                const deleted = await interaction.channel.bulkDelete(recentMessages, true);
                deletedCount += deleted.size;
                remaining -= fetchAmount;
                
                // Small delay to avoid rate limits
                if (remaining > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            if (deletedCount === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setTitle('No Messages Deleted')
                    .setDescription('No messages found matching your criteria.')
                    .addFields({
                        name: 'Note',
                        value: 'Messages must be less than 14 days old to be deleted.'
                    })
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Build success embed
            const fields = [
                { name: 'Messages Deleted', value: `${deletedCount}`, inline: true },
                { name: 'Channel', value: `${interaction.channel}`, inline: true },
                { name: 'Moderator', value: `${interaction.user}`, inline: true }
            ];
            
            if (targetUser) {
                fields.push({ name: 'Target User', value: `${targetUser}`, inline: true });
            }
            if (botsOnly) {
                fields.push({ name: 'Filter', value: 'Bots only', inline: true });
            }
            if (oldMessagesCount > 0) {
                fields.push({ 
                    name: 'Skipped', 
                    value: `${oldMessagesCount} message(s) older than 14 days`, 
                    inline: false 
                });
            }
            
            const successEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Messages Purged')
                .setDescription('Successfully deleted messages from the channel.')
                .addFields(fields)
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [successEmbed] });
            
            // Log the purge action
            console.log(`[PURGE] ${interaction.user.tag} deleted ${deletedCount} messages in #${interaction.channel.name}`);
            if (targetUser) {
                console.log(`[PURGE] Target user: ${targetUser.tag}`);
            }
            if (botsOnly) {
                console.log(`[PURGE] Bots only filter enabled`);
            }
            
        } catch (error) {
            console.error('Error purging messages:', error);
            
            let errorDescription = 'An error occurred while deleting messages.';
            
            if (error.code === 50013) {
                errorDescription = 'Missing permissions to delete messages in this channel.';
            } else if (error.code === 50034) {
                errorDescription = 'Messages must be less than 14 days old to be bulk deleted.';
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Purge Failed')
                .setDescription(errorDescription)
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
