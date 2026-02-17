'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-info')
        .setDescription('Show an overview of the automod system'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('Automod System')
            .addFields(
                {
                    name: 'Rule Types (19)',
                    value:
                        '**Content:** All Caps, Bad Words, Duplicate Text, Character Count, ' +
                        'Newlines, Emoji Spam, Zalgo Text, Spoilers\n' +
                        '**Links:** Invite Links, Phishing Links, Links, Masked Links, Links Cooldown\n' +
                        '**Spam:** Fast Message Spam, Image Spam, Mass Mentions, ' +
                        'Mentions Cooldown, Stickers, Sticker Cooldown',
                },
                {
                    name: 'Actions (7)',
                    value:
                        'Warn, Delete, Warn + Delete, ' +
                        'Auto Mute (after X violations), Auto Ban (after X violations), ' +
                        'Instant Mute, Instant Ban',
                },
                {
                    name: 'Key Features',
                    value:
                        'Per-rule role and channel scoping\n' +
                        'Global ignored roles and channels\n' +
                        'Custom log channel per rule\n' +
                        '5-minute violation windows\n' +
                        'Wildcard pattern matching for bad words\n' +
                        'Link allowlists and blocklists',
                },
                {
                    name: 'Quick Start',
                    value:
                        '1. `/automod-settings log-channel` — set a log channel\n' +
                        '2. `/automod-setup` — create your first rule\n' +
                        '3. `/automod-list` — view all rules\n' +
                        '4. `/automod-badwords add` — add filtered words\n' +
                        '5. `/automod-filter add` — configure rule scoping',
                }
            );

        return interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
