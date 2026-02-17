'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');
const { formatRuleName, formatAction } = require('../../utils/constants');

// Default threshold values per rule type, used when the user omits --threshold.
const DEFAULT_THRESHOLDS = {
    all_caps:           70,
    newlines:           10,
    character_count:  2000,
    emoji_spam:         10,
    fast_message_spam:   5,
    image_spam:          3,
    mass_mentions:       5,
    mentions_cooldown:   5,
    links_cooldown:      3,
    sticker_cooldown:    3,
};

// Default violation counts for accumulation-based actions.
const DEFAULT_VIOLATIONS = {
    auto_mute: 3,
    auto_ban:  5,
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-setup')
        .setDescription('Create a new automod rule')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('rule').setDescription('Rule type').setRequired(true)
            .addChoices(
                { name: 'All Caps',             value: 'all_caps' },
                { name: 'Bad Words',            value: 'bad_words' },
                { name: 'Chat Clearing Newlines', value: 'newlines' },
                { name: 'Duplicate Text',       value: 'duplicate_text' },
                { name: 'Character Count',      value: 'character_count' },
                { name: 'Emoji Spam',           value: 'emoji_spam' },
                { name: 'Fast Message Spam',    value: 'fast_message_spam' },
                { name: 'Image Spam',           value: 'image_spam' },
                { name: 'Invite Links',         value: 'invite_links' },
                { name: 'Known Phishing Links', value: 'phishing_links' },
                { name: 'Links',                value: 'links' },
                { name: 'Links Cooldown',       value: 'links_cooldown' },
                { name: 'Mass Mentions',        value: 'mass_mentions' },
                { name: 'Mentions Cooldown',    value: 'mentions_cooldown' },
                { name: 'Spoilers',             value: 'spoilers' },
                { name: 'Masked Links',         value: 'masked_links' },
                { name: 'Stickers',             value: 'stickers' },
                { name: 'Sticker Cooldown',     value: 'sticker_cooldown' },
                { name: 'Zalgo Text',           value: 'zalgo' }
            ))
        .addStringOption(o => o.setName('action').setDescription('Action to take on violation').setRequired(true)
            .addChoices(
                { name: 'Warn (in-channel)',            value: 'warn' },
                { name: 'Delete',                      value: 'delete' },
                { name: 'Warn + Delete',               value: 'warn_delete' },
                { name: 'Auto Mute (after X violations)', value: 'auto_mute' },
                { name: 'Auto Ban (after X violations)',  value: 'auto_ban' },
                { name: 'Instant Mute',                value: 'instant_mute' },
                { name: 'Instant Ban',                 value: 'instant_ban' }
            ))
        .addIntegerOption(o => o.setName('threshold').setDescription('Trigger threshold (meaning depends on rule type)').setRequired(false))
        .addIntegerOption(o => o.setName('violations').setDescription('Violations required before action triggers (auto_mute / auto_ban only)').setRequired(false).setMinValue(1).setMaxValue(10))
        .addIntegerOption(o => o.setName('mute-duration').setDescription('Timeout duration in seconds (default: 300)').setRequired(false).setMinValue(60).setMaxValue(2419200))
        .addChannelOption(o => o.setName('log-channel').setDescription('Override the default log channel for this rule').setRequired(false))
        .addStringOption(o => o.setName('custom-message').setDescription('Custom text for warn messages').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const ruleType    = interaction.options.getString('rule');
        const action      = interaction.options.getString('action');
        const threshold   = interaction.options.getInteger('threshold') ?? DEFAULT_THRESHOLDS[ruleType] ?? null;
        const violations  = interaction.options.getInteger('violations') ?? DEFAULT_VIOLATIONS[action] ?? 1;
        const logChannel  = interaction.options.getChannel('log-channel');

        try {
            const result = db.createRule(interaction.guild.id, ruleType, {
                enabled:        true,
                threshold,
                action,
                violationCount: violations,
                muteDuration:   interaction.options.getInteger('mute-duration') ?? 300,
                customMessage:  interaction.options.getString('custom-message'),
                logChannelId:   logChannel?.id ?? null,
            });

            const embed = new EmbedBuilder()
                .setColor(0x23A55A)
                .setTitle('Automod Rule Created')
                .addFields(
                    { name: 'Rule',    value: formatRuleName(ruleType),       inline: true },
                    { name: 'Action',  value: formatAction(action),           inline: true },
                    { name: 'Rule ID', value: `${result.lastInsertRowid}`,    inline: true },
                );

            if (threshold != null)  embed.addFields({ name: 'Threshold',          value: `${threshold}`,  inline: true });
            if (violations > 1)     embed.addFields({ name: 'Violations Required', value: `${violations}`, inline: true });
            if (logChannel)         embed.addFields({ name: 'Log Channel',         value: `${logChannel}`, inline: true });

            embed.addFields({ name: 'Next Steps', value: [
                '`/automod-filter add` — configure affected or ignored roles and channels',
                '`/automod-list`       — view all configured rules',
                '`/automod-toggle`     — enable or disable a rule',
            ].join('\n') });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[AUTOMOD] Failed to create rule:', err);
            await interaction.editReply({ content: 'Failed to create the automod rule. Please try again.' });
        }
    },
};
