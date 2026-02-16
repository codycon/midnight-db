const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

async function handleReaction(reaction, user) {
    // Ignore bot reactions
    if (user.bot) return;
    
    // Fetch partial reactions
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }
    
    // Load suggestions config
    const dataDir = path.join(__dirname, '../data');
    const suggestionsPath = path.join(dataDir, 'suggestions.json');
    
    if (!fs.existsSync(suggestionsPath)) return;
    
    const suggestionsConfig = JSON.parse(fs.readFileSync(suggestionsPath, 'utf8'));
    const guildId = reaction.message.guild.id;
    
    if (!suggestionsConfig[guildId]) return;
    
    // Check if this is a suggestion message
    const suggestion = suggestionsConfig[guildId].suggestions?.find(
        s => s.messageId === reaction.message.id
    );
    
    if (!suggestion) return;
    
    // Only update for thumbs up and thumbs down
    if (reaction.emoji.name !== '👍' && reaction.emoji.name !== '👎') return;
    
    try {
        // Get current vote counts
        const message = reaction.message;
        const upvotes = message.reactions.cache.get('👍')?.count - 1 || 0; // Subtract bot's reaction
        const downvotes = message.reactions.cache.get('👎')?.count - 1 || 0; // Subtract bot's reaction
        
        // Update the embed
        const currentEmbed = message.embeds[0];
        
        if (!currentEmbed) return;
        
        const updatedEmbed = EmbedBuilder.from(currentEmbed);
        
        // Find and update the Votes field (should be field index 2)
        const fields = updatedEmbed.data.fields;
        const votesFieldIndex = fields.findIndex(f => f.name === 'Votes');
        
        if (votesFieldIndex !== -1) {
            updatedEmbed.spliceFields(votesFieldIndex, 1, {
                name: 'Votes',
                value: `👍 ${upvotes} | 👎 ${downvotes}`,
                inline: true
            });
            
            await message.edit({ embeds: [updatedEmbed] });
        }
        
    } catch (error) {
        console.error('Error updating suggestion votes:', error);
    }
}

module.exports = [
    {
        name: Events.MessageReactionAdd,
        async execute(reaction, user) {
            await handleReaction(reaction, user);
        }
    },
    {
        name: Events.MessageReactionRemove,
        async execute(reaction, user) {
            await handleReaction(reaction, user);
        }
    }
];
