const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-toggle')
        .setDescription('Enable or disable an automod rule')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option =>
            option.setName('rule-id')
                .setDescription('Rule ID (from /automod-list)')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('enabled')
                .setDescription('Enable or disable the rule')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const ruleId = interaction.options.getInteger('rule-id');
        const enabled = interaction.options.getBoolean('enabled');

        try {
            const rules = db.getRules(interaction.guild.id);
            const rule = rules.find(r => r.id === ruleId);

            if (!rule) {
                return await interaction.editReply({
                    content: '❌ Rule not found! Use `/automod-list` to see valid rule IDs.'
                });
            }

            db.updateRule(ruleId, { enabled });

            const embed = new EmbedBuilder()
                .setColor(enabled ? 0x00ff00 : 0xff9900)
                .setTitle(enabled ? '✅ Rule Enabled' : '⏸️ Rule Disabled')
                .setDescription(`Rule #${ruleId}: ${this.formatRuleName(rule.rule_type)}`)
                .addFields({
                    name: 'Status',
                    value: enabled ? '🟢 Active' : '🔴 Inactive'
                });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[AUTOMOD] Error toggling rule:', error);
            await interaction.editReply({
                content: '❌ Failed to toggle rule. Please try again.'
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
