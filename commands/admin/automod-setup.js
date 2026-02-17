const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-setup')
        .setDescription('Create a new automod rule')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('rule')
                .setDescription('Type of rule to create')
                .setRequired(true)
                .addChoices(
                    { name: 'All Caps', value: 'all_caps' },
                    { name: 'Bad Words', value: 'bad_words' },
                    { name: 'Chat Clearing Newlines', value: 'newlines' },
                    { name: 'Duplicate Text', value: 'duplicate_text' },
                    { name: 'Character Count', value: 'character_count' },
                    { name: 'Emoji Spam', value: 'emoji_spam' },
                    { name: 'Fast Message Spam', value: 'fast_message_spam' },
                    { name: 'Image Spam', value: 'image_spam' },
                    { name: 'Invite Links', value: 'invite_links' },
                    { name: 'Known Phishing Links', value: 'phishing_links' },
                    { name: 'Links', value: 'links' },
                    { name: 'Links Cooldown', value: 'links_cooldown' },
                    { name: 'Mass Mentions', value: 'mass_mentions' },
                    { name: 'Mentions Cooldown', value: 'mentions_cooldown' },
                    { name: 'Spoilers', value: 'spoilers' },
                    { name: 'Masked Links', value: 'masked_links' },
                    { name: 'Stickers', value: 'stickers' },
                    { name: 'Sticker Cooldown', value: 'sticker_cooldown' },
                    { name: 'Zalgo Text', value: 'zalgo' }
                ))
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to take when rule is violated')
                .setRequired(true)
                .addChoices(
                    { name: 'Warn (in-channel)', value: 'warn' },
                    { name: 'Delete', value: 'delete' },
                    { name: 'Warn + Delete', value: 'warn_delete' },
                    { name: 'Auto Mute (after X violations)', value: 'auto_mute' },
                    { name: 'Auto Ban (after X violations)', value: 'auto_ban' },
                    { name: 'Instant Mute', value: 'instant_mute' },
                    { name: 'Instant Ban', value: 'instant_ban' }
                ))
        .addIntegerOption(option =>
            option.setName('threshold')
                .setDescription('Threshold value (depends on rule type)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('violations')
                .setDescription('Number of violations before action (for auto_mute/auto_ban)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10))
        .addIntegerOption(option =>
            option.setName('mute-duration')
                .setDescription('Mute duration in seconds (default: 300 = 5 minutes)')
                .setRequired(false)
                .setMinValue(60)
                .setMaxValue(2419200)) // 28 days max
        .addChannelOption(option =>
            option.setName('log-channel')
                .setDescription('Channel to log violations (overrides default)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('custom-message')
                .setDescription('Custom warning message')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const ruleType = interaction.options.getString('rule');
        const action = interaction.options.getString('action');
        const threshold = interaction.options.getInteger('threshold');
        const violations = interaction.options.getInteger('violations');
        const muteDuration = interaction.options.getInteger('mute-duration');
        const logChannel = interaction.options.getChannel('log-channel');
        const customMessage = interaction.options.getString('custom-message');

        // Get default thresholds
        const defaultThresholds = {
            all_caps: 70,
            newlines: 10,
            character_count: 2000,
            emoji_spam: 10,
            fast_message_spam: 5,
            image_spam: 3,
            mass_mentions: 5,
            mentions_cooldown: 5,
            links_cooldown: 3,
            sticker_cooldown: 3
        };

        const finalThreshold = threshold || defaultThresholds[ruleType] || null;

        try {
            const result = db.createRule(interaction.guild.id, ruleType, {
                enabled: true,
                threshold: finalThreshold,
                action: action,
                violationCount: violations || (action === 'auto_mute' ? 3 : action === 'auto_ban' ? 5 : 1),
                muteDuration: muteDuration || 300,
                customMessage: customMessage,
                logChannelId: logChannel?.id || null
            });

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Automod Rule Created')
                .setDescription(`Successfully created **${this.formatRuleName(ruleType)}** rule`)
                .addFields(
                    { name: 'Action', value: this.formatAction(action), inline: true },
                    { name: 'Rule ID', value: `${result.lastInsertRowid}`, inline: true }
                );

            if (finalThreshold) {
                embed.addFields({ name: 'Threshold', value: `${finalThreshold}`, inline: true });
            }

            if (violations) {
                embed.addFields({ name: 'Violations Required', value: `${violations}`, inline: true });
            }

            if (logChannel) {
                embed.addFields({ name: 'Log Channel', value: `${logChannel}`, inline: true });
            }

            embed.addFields({
                name: 'Next Steps',
                value: '• Use `/automod-filter add` to configure affected/ignored roles/channels\n' +
                       '• Use `/automod-list` to view all rules\n' +
                       '• Use `/automod-toggle` to enable/disable rules'
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[AUTOMOD] Error creating rule:', error);
            await interaction.editReply({
                content: '❌ Failed to create automod rule. Please try again.',
                ephemeral: true
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
    }
};
