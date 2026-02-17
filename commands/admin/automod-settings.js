const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-settings')
        .setDescription('Configure global automod settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('log-channel')
                .setDescription('Set the default log channel for all rules')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to log violations')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ignore-role')
                .setDescription('Add a role that bypasses all automod rules')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to ignore')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ignore-channel')
                .setDescription('Add a channel that bypasses all automod rules')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to ignore')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current automod settings')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'log-channel') {
                const channel = interaction.options.getChannel('channel');

                let settings = db.getSettings(interaction.guild.id) || {
                    ignoredRoles: [],
                    ignoredChannels: []
                };

                settings.defaultLogChannel = channel.id;
                db.updateSettings(interaction.guild.id, settings);

                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ Log Channel Set')
                    .setDescription(`Default log channel set to ${channel}`)
                    .addFields({
                        name: 'Note',
                        value: 'Individual rules can override this with their own log channel'
                    });

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'ignore-role') {
                const role = interaction.options.getRole('role');

                let settings = db.getSettings(interaction.guild.id) || {
                    ignoredRoles: [],
                    ignoredChannels: []
                };

                if (!settings.ignoredRoles.includes(role.id)) {
                    settings.ignoredRoles.push(role.id);
                    db.updateSettings(interaction.guild.id, settings);

                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ Role Ignored')
                        .setDescription(`Users with ${role} will bypass all automod rules`)
                        .addFields({
                            name: 'Note',
                            value: 'Server owner and administrators are always ignored'
                        });

                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({
                        content: `⚠️ ${role} is already in the ignore list!`
                    });
                }

            } else if (subcommand === 'ignore-channel') {
                const channel = interaction.options.getChannel('channel');

                let settings = db.getSettings(interaction.guild.id) || {
                    ignoredRoles: [],
                    ignoredChannels: []
                };

                if (!settings.ignoredChannels.includes(channel.id)) {
                    settings.ignoredChannels.push(channel.id);
                    db.updateSettings(interaction.guild.id, settings);

                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ Channel Ignored')
                        .setDescription(`${channel} will bypass all automod rules`);

                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({
                        content: `⚠️ ${channel} is already in the ignore list!`
                    });
                }

            } else if (subcommand === 'view') {
                const settings = db.getSettings(interaction.guild.id);

                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('⚙️ Automod Settings');

                if (!settings) {
                    embed.setDescription('No settings configured yet. Use the other subcommands to set up automod!');
                } else {
                    if (settings.default_log_channel) {
                        embed.addFields({
                            name: 'Default Log Channel',
                            value: `<#${settings.default_log_channel}>`
                        });
                    }

                    if (settings.ignored_roles && settings.ignored_roles.length > 0) {
                        embed.addFields({
                            name: `Ignored Roles (${settings.ignored_roles.length})`,
                            value: settings.ignored_roles.map(id => `<@&${id}>`).join(', ')
                        });
                    }

                    if (settings.ignored_channels && settings.ignored_channels.length > 0) {
                        embed.addFields({
                            name: `Ignored Channels (${settings.ignored_channels.length})`,
                            value: settings.ignored_channels.map(id => `<#${id}>`).join(', ')
                        });
                    }

                    embed.addFields({
                        name: 'Always Ignored',
                        value: '• Server Owner\n• Administrators\n• Mod roles (if applicable)'
                    });
                }

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[AUTOMOD] Error managing settings:', error);
            await interaction.editReply({
                content: '❌ Failed to manage settings. Please try again.'
            });
        }
    }
};
