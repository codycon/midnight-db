const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-list')
        .setDescription('List all automod rules')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const rules = db.getRules(interaction.guild.id);

            if (rules.length === 0) {
                return await interaction.editReply({
                    content: '📋 No automod rules configured yet.\nUse `/automod-setup` to create your first rule!'
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('🛡️ Automod Rules')
                .setDescription(`Total: ${rules.length} rule(s)`)
                .setTimestamp();

            for (const rule of rules.slice(0, 25)) { // Discord limit
                const status = rule.enabled ? '✅' : '❌';
                let value = `**Action:** ${this.formatAction(rule.action)}\n`;
                
                if (rule.threshold) {
                    value += `**Threshold:** ${rule.threshold}\n`;
                }
                
                if (rule.violation_count > 1) {
                    value += `**Violations:** ${rule.violation_count}\n`;
                }

                if (rule.mute_duration) {
                    value += `**Mute Duration:** ${this.formatDuration(rule.mute_duration)}\n`;
                }

                value += `**Status:** ${status} ${rule.enabled ? 'Enabled' : 'Disabled'}`;

                embed.addFields({
                    name: `${rule.id}. ${this.formatRuleName(rule.rule_type)}`,
                    value: value,
                    inline: true
                });
            }

            if (rules.length > 25) {
                embed.setFooter({ text: `Showing first 25 of ${rules.length} rules` });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[AUTOMOD] Error listing rules:', error);
            await interaction.editReply({
                content: '❌ Failed to list automod rules. Please try again.'
            });
        }
    },

    formatRuleName(ruleType) {
        return ruleType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    },

    formatAction(action) {
        const actions = {
            warn: 'Warn',
            delete: 'Delete',
            warn_delete: 'Warn + Delete',
            auto_mute: 'Auto Mute',
            auto_ban: 'Auto Ban',
            instant_mute: 'Instant Mute',
            instant_ban: 'Instant Ban'
        };
        return actions[action] || action;
    },

    formatDuration(seconds) {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    }
};
