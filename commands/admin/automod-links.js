'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');
const { normaliseDomain } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-links')
        .setDescription('Manage allowed and blocked link domains')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s
            .setName('allow')
            .setDescription('Add a domain to the allowlist')
            .addStringOption(o => o
                .setName('domain')
                .setDescription('Domain to allow (e.g. youtube.com)')
                .setRequired(true)))
        .addSubcommand(s => s
            .setName('block')
            .setDescription('Add a domain to the blocklist')
            .addStringOption(o => o
                .setName('domain')
                .setDescription('Domain to block (e.g. scamsite.com)')
                .setRequired(true)))
        .addSubcommand(s => s
            .setName('list')
            .setDescription('List all configured domain filters')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const sub = interaction.options.getSubcommand();

        try {
            switch (sub) {
                case 'allow': return await this._allow(interaction);
                case 'block': return await this._block(interaction);
                case 'list':  return await this._list(interaction);
            }
        } catch (err) {
            console.error('[AUTOMOD] Error in automod-links:', err);
            await interaction.editReply({ content: 'Failed to manage link filters. Please try again.' });
        }
    },

    async _allow(interaction) {
        const domain = normaliseDomain(interaction.options.getString('domain'));
        db.addAllowedLink(interaction.guild.id, domain);

        const embed = new EmbedBuilder()
            .setColor(0x23A55A)
            .setTitle('Domain Allowed')
            .setDescription(`**${domain}** added to the allowlist.`)
            .addFields({ name: 'Note', value: 'To use the allowlist, create a "Links" rule with threshold set to 1 (allowlist mode).' });

        return interaction.editReply({ embeds: [embed] });
    },

    async _block(interaction) {
        const domain = normaliseDomain(interaction.options.getString('domain'));
        db.addBlockedLink(interaction.guild.id, domain);

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('Domain Blocked')
            .setDescription(`**${domain}** added to the blocklist.`)
            .addFields({ name: 'Note', value: 'Ensure a "Links" automod rule is enabled for this to take effect.' });

        return interaction.editReply({ embeds: [embed] });
    },

    async _list(interaction) {
        const allowed = db.getAllowedLinks(interaction.guild.id);
        const blocked = db.getBlockedLinks(interaction.guild.id);

        if (!allowed.length && !blocked.length) {
            return interaction.editReply({
                content: 'No domain filters configured. Use `/automod-links allow` or `/automod-links block` to add some.',
            });
        }

        const truncate = (arr) => {
            const shown = arr.slice(0, 20).map(d => `\`${d}\``).join(', ');
            return arr.length > 20 ? `${shown} (+${arr.length - 20} more)` : shown;
        };

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('Link Filters');

        if (allowed.length) embed.addFields({ name: `Allowed Domains (${allowed.length})`, value: truncate(allowed) });
        if (blocked.length) embed.addFields({ name: `Blocked Domains (${blocked.length})`, value: truncate(blocked) });

        return interaction.editReply({ embeds: [embed] });
    },
};
