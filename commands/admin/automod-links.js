const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-links')
        .setDescription('Manage allowed and blocked link domains')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('allow')
                .setDescription('Add a domain to the allowlist')
                .addStringOption(option =>
                    option.setName('domain')
                        .setDescription('Domain to allow (e.g., youtube.com)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('block')
                .setDescription('Add a domain to the blocklist')
                .addStringOption(option =>
                    option.setName('domain')
                        .setDescription('Domain to block (e.g., scamsite.com)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all allowed and blocked domains')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'allow') {
                const domain = interaction.options.getString('domain').toLowerCase().replace(/^https?:\/\//, '');

                db.addAllowedLink(interaction.guild.id, domain);

                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ Domain Allowed')
                    .setDescription(`Added **${domain}** to the allowlist`)
                    .addFields({
                        name: 'Note',
                        value: 'To use the allowlist, create a "Links" rule with threshold set to 1 (allowlist mode)'
                    });

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'block') {
                const domain = interaction.options.getString('domain').toLowerCase().replace(/^https?:\/\//, '');

                db.addBlockedLink(interaction.guild.id, domain);

                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('🚫 Domain Blocked')
                    .setDescription(`Added **${domain}** to the blocklist`)
                    .addFields({
                        name: 'Note',
                        value: 'Make sure you have a "Links" automod rule enabled!'
                    });

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'list') {
                const allowedLinks = db.getAllowedLinks(interaction.guild.id);
                const blockedLinks = db.getBlockedLinks(interaction.guild.id);

                if (allowedLinks.length === 0 && blockedLinks.length === 0) {
                    return await interaction.editReply({
                        content: '📋 No link filters configured yet.\nUse `/automod-links allow` or `/automod-links block`!'
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('🔗 Link Filters');

                if (allowedLinks.length > 0) {
                    embed.addFields({
                        name: `✅ Allowed Domains (${allowedLinks.length})`,
                        value: allowedLinks.slice(0, 20).map(d => `\`${d}\``).join(', ') +
                               (allowedLinks.length > 20 ? ` (+${allowedLinks.length - 20} more)` : '')
                    });
                }

                if (blockedLinks.length > 0) {
                    embed.addFields({
                        name: `🚫 Blocked Domains (${blockedLinks.length})`,
                        value: blockedLinks.slice(0, 20).map(d => `\`${d}\``).join(', ') +
                               (blockedLinks.length > 20 ? ` (+${blockedLinks.length - 20} more)` : '')
                    });
                }

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[AUTOMOD] Error managing links:', error);
            await interaction.editReply({
                content: '❌ Failed to manage links. Please try again.'
            });
        }
    }
};
