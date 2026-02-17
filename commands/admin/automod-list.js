'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');
const { formatRuleName, formatAction, formatDuration } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-list')
        .setDescription('List all automod rules configured in this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const rules = db.getRules(interaction.guild.id);

            if (!rules.length) {
                return interaction.editReply({ content: 'No automod rules configured yet. Use `/automod-setup` to create one.' });
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('Automod Rules')
                .setDescription(`${rules.length} rule(s) configured`)
                .setTimestamp();

            // Discord caps embeds at 25 fields
            for (const rule of rules.slice(0, 25)) {
                const lines = [
                    `**Action:** ${formatAction(rule.action)}`,
                    `**Status:** ${rule.enabled ? 'Enabled' : 'Disabled'}`,
                ];
                if (rule.threshold)       lines.push(`**Threshold:** ${rule.threshold}`);
                if (rule.violation_count > 1) lines.push(`**Violations:** ${rule.violation_count}`);
                if (rule.mute_duration)   lines.push(`**Mute Duration:** ${formatDuration(rule.mute_duration)}`);

                embed.addFields({
                    name:   `[${rule.id}] ${formatRuleName(rule.rule_type)}`,
                    value:  lines.join('\n'),
                    inline: true,
                });
            }

            if (rules.length > 25) {
                embed.setFooter({ text: `Showing first 25 of ${rules.length} rules` });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[AUTOMOD] Failed to list rules:', err);
            await interaction.editReply({ content: 'Failed to retrieve the rules list. Please try again.' });
        }
    },
};
