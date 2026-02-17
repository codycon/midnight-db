const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-badwords')
        .setDescription('Manage the bad words list')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a word/phrase to the bad words list')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('Word or phrase to block')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('match-type')
                        .setDescription('How to match the word')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Contains (matches anywhere in message)', value: 'contains' },
                            { name: 'Exact (must be a separate word)', value: 'exact' },
                            { name: 'Wildcard (use * for any characters)', value: 'wildcard' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a word from the bad words list')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('Word to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all bad words')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'add') {
                const word = interaction.options.getString('word');
                const matchType = interaction.options.getString('match-type');

                db.addBadWord(interaction.guild.id, word, matchType);

                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ Bad Word Added')
                    .addFields(
                        { name: 'Word/Phrase', value: `||${word}||`, inline: true },
                        { name: 'Match Type', value: matchType, inline: true }
                    )
                    .setFooter({ text: 'Make sure you have a "Bad Words" automod rule enabled!' });

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'remove') {
                const word = interaction.options.getString('word');

                const result = db.removeBadWord(interaction.guild.id, word);

                if (result.changes > 0) {
                    const embed = new EmbedBuilder()
                        .setColor(0xff9900)
                        .setTitle('✅ Bad Word Removed')
                        .setDescription(`Removed ||${word}|| from the bad words list`);

                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({
                        content: '❌ Word not found in the bad words list!'
                    });
                }

            } else if (subcommand === 'list') {
                const badWords = db.getBadWords(interaction.guild.id);

                if (badWords.length === 0) {
                    return await interaction.editReply({
                        content: '📋 No bad words configured yet.\nUse `/automod-badwords add` to add words!'
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('🚫 Bad Words List')
                    .setDescription(`Total: ${badWords.length} word(s)`);

                // Group by match type
                const byMatchType = {
                    contains: [],
                    exact: [],
                    wildcard: []
                };

                badWords.forEach(entry => {
                    byMatchType[entry.match_type].push(`||${entry.word}||`);
                });

                if (byMatchType.contains.length > 0) {
                    embed.addFields({
                        name: 'Contains',
                        value: byMatchType.contains.slice(0, 10).join(', ') + 
                               (byMatchType.contains.length > 10 ? ` (+${byMatchType.contains.length - 10} more)` : '')
                    });
                }

                if (byMatchType.exact.length > 0) {
                    embed.addFields({
                        name: 'Exact Match',
                        value: byMatchType.exact.slice(0, 10).join(', ') + 
                               (byMatchType.exact.length > 10 ? ` (+${byMatchType.exact.length - 10} more)` : '')
                    });
                }

                if (byMatchType.wildcard.length > 0) {
                    embed.addFields({
                        name: 'Wildcard',
                        value: byMatchType.wildcard.slice(0, 10).join(', ') + 
                               (byMatchType.wildcard.length > 10 ? ` (+${byMatchType.wildcard.length - 10} more)` : '')
                    });
                }

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[AUTOMOD] Error managing bad words:', error);
            await interaction.editReply({
                content: '❌ Failed to manage bad words. Please try again.'
            });
        }
    }
};
