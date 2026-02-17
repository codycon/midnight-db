const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-filter')
        .setDescription('Add filters to automod rules (affected/ignored roles/channels)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a filter to a rule')
                .addIntegerOption(option =>
                    option.setName('rule-id')
                        .setDescription('The rule ID (from /automod-list)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('filter-type')
                        .setDescription('Filter type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Affected (only applies to these)', value: 'affected' },
                            { name: 'Ignored (does not apply to these)', value: 'ignored' }
                        ))
                .addStringOption(option =>
                    option.setName('target-type')
                        .setDescription('What to filter')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Role', value: 'role' },
                            { name: 'Channel', value: 'channel' }
                        ))
                .addStringOption(option =>
                    option.setName('target-id')
                        .setDescription('Role/Channel ID or mention')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List filters for a rule')
                .addIntegerOption(option =>
                    option.setName('rule-id')
                        .setDescription('The rule ID')
                        .setRequired(true))),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'add') {
                const ruleId = interaction.options.getInteger('rule-id');
                const filterType = interaction.options.getString('filter-type');
                const targetType = interaction.options.getString('target-type');
                let targetId = interaction.options.getString('target-id');

                // Extract ID from mention format if needed
                targetId = targetId.replace(/[<@&#>]/g, '');

                // Verify rule exists and belongs to this guild
                const rules = db.getRules(interaction.guild.id);
                const rule = rules.find(r => r.id === ruleId);

                if (!rule) {
                    return await interaction.editReply({
                        content: '❌ Rule not found! Use `/automod-list` to see valid rule IDs.'
                    });
                }

                // Add the filter
                db.addFilter(ruleId, filterType, targetType, targetId);

                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ Filter Added')
                    .setDescription(`Added ${filterType} ${targetType} filter to rule #${ruleId}`)
                    .addFields(
                        { name: 'Rule', value: this.formatRuleName(rule.rule_type) },
                        { name: 'Filter', value: `${filterType.toUpperCase()} ${targetType}` },
                        { name: 'Target', value: targetType === 'role' ? `<@&${targetId}>` : `<#${targetId}>` }
                    );

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'list') {
                const ruleId = interaction.options.getInteger('rule-id');

                const rules = db.getRules(interaction.guild.id);
                const rule = rules.find(r => r.id === ruleId);

                if (!rule) {
                    return await interaction.editReply({
                        content: '❌ Rule not found!'
                    });
                }

                const filters = db.getFilters(ruleId);

                if (filters.length === 0) {
                    return await interaction.editReply({
                        content: `📋 No filters configured for rule #${ruleId} (${this.formatRuleName(rule.rule_type)})`
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle(`🔍 Filters for Rule #${ruleId}`)
                    .setDescription(`**Rule:** ${this.formatRuleName(rule.rule_type)}`);

                const affectedRoles = filters.filter(f => f.filter_type === 'affected' && f.target_type === 'role');
                const affectedChannels = filters.filter(f => f.filter_type === 'affected' && f.target_type === 'channel');
                const ignoredRoles = filters.filter(f => f.filter_type === 'ignored' && f.target_type === 'role');
                const ignoredChannels = filters.filter(f => f.filter_type === 'ignored' && f.target_type === 'channel');

                if (affectedRoles.length > 0) {
                    embed.addFields({
                        name: 'Affected Roles',
                        value: affectedRoles.map(f => `<@&${f.target_id}>`).join(', ')
                    });
                }

                if (affectedChannels.length > 0) {
                    embed.addFields({
                        name: 'Affected Channels',
                        value: affectedChannels.map(f => `<#${f.target_id}>`).join(', ')
                    });
                }

                if (ignoredRoles.length > 0) {
                    embed.addFields({
                        name: 'Ignored Roles',
                        value: ignoredRoles.map(f => `<@&${f.target_id}>`).join(', ')
                    });
                }

                if (ignoredChannels.length > 0) {
                    embed.addFields({
                        name: 'Ignored Channels',
                        value: ignoredChannels.map(f => `<#${f.target_id}>`).join(', ')
                    });
                }

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[AUTOMOD] Error managing filters:', error);
            await interaction.editReply({
                content: '❌ Failed to manage filters. Please try again.'
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
