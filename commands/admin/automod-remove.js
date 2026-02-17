const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-remove')
        .setDescription('Delete an automod rule')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option =>
            option.setName('rule-id')
                .setDescription('Rule ID to delete (from /automod-list)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const ruleId = interaction.options.getInteger('rule-id');

        try {
            const rules = db.getRules(interaction.guild.id);
            const rule = rules.find(r => r.id === ruleId);

            if (!rule) {
                return await interaction.editReply({
                    content: '❌ Rule not found! Use `/automod-list` to see valid rule IDs.'
                });
            }

            db.deleteRule(ruleId);

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🗑️ Rule Deleted')
                .setDescription(`Successfully deleted rule #${ruleId}`)
                .addFields({
                    name: 'Rule Type',
                    value: this.formatRuleName(rule.rule_type)
                });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[AUTOMOD] Error deleting rule:', error);
            await interaction.editReply({
                content: '❌ Failed to delete rule. Please try again.'
            });
        }
    },

    formatRuleName(ruleType) {
        return ruleType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
};
