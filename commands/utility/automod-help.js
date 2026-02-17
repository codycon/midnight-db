const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-help')
        .setDescription('Get help with automod commands')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('Specific command to get help with')
                .setRequired(false)
                .addChoices(
                    { name: 'setup', value: 'setup' },
                    { name: 'list', value: 'list' },
                    { name: 'toggle', value: 'toggle' },
                    { name: 'remove', value: 'remove' },
                    { name: 'filter', value: 'filter' },
                    { name: 'badwords', value: 'badwords' },
                    { name: 'links', value: 'links' },
                    { name: 'settings', value: 'settings' }
                )),

    async execute(interaction) {
        const command = interaction.options.getString('command');

        if (!command) {
            // General help
            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('📖 Automod Help')
                .setDescription('Comprehensive automod command reference')
                .addFields(
                    {
                        name: '🔧 Setup & Management',
                        value:
                            '`/automod-setup` — Create a new rule\n' +
                            '`/automod-list` — View all rules\n' +
                            '`/automod-toggle` — Enable/disable rules\n' +
                            '`/automod-remove` — Delete a rule\n' +
                            '`/automod-info` — System information'
                    },
                    {
                        name: '🎯 Configuration',
                        value:
                            '`/automod-filter` — Rule filters (roles/channels)\n' +
                            '`/automod-settings` — Global settings\n' +
                            '`/automod-badwords` — Manage word filters\n' +
                            '`/automod-links` — Manage link filters'
                    },
                    {
                        name: '💡 Quick Tips',
                        value:
                            '• Use `/automod-help <command>` for detailed help\n' +
                            '• Rules are checked in order of creation\n' +
                            '• Violations expire after 5 minutes\n' +
                            '• Server owner & admins are always ignored'
                    },
                    {
                        name: '🚀 Quick Start',
                        value:
                            '1. Set log channel: `/automod-settings log-channel`\n' +
                            '2. Create rule: `/automod-setup rule:all_caps action:warn_delete`\n' +
                            '3. Test it: Send an ALL CAPS MESSAGE\n' +
                            '4. View rules: `/automod-list`'
                    }
                );

            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Specific command help
        let embed;

        switch (command) {
            case 'setup':
                embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('📝 /automod-setup')
                    .setDescription('Create a new automod rule')
                    .addFields(
                        {
                            name: 'Required Options',
                            value:
                                '• `rule` — Type of rule (see below)\n' +
                                '• `action` — What happens when violated'
                        },
                        {
                            name: 'Optional Settings',
                            value:
                                '• `threshold` — Trigger value (depends on rule)\n' +
                                '• `violations` — Count before auto-action (default: 3 for mute, 5 for ban)\n' +
                                '• `mute-duration` — Timeout length in seconds (default: 300)\n' +
                                '• `log-channel` — Override default log channel\n' +
                                '• `custom-message` — Custom warning text'
                        },
                        {
                            name: 'Rule Types with Thresholds',
                            value:
                                '• `all_caps` — % of caps (default: 70)\n' +
                                '• `newlines` — Number of newlines (default: 10)\n' +
                                '• `character_count` — Max message length (default: 2000)\n' +
                                '• `emoji_spam` — Max emojis (default: 10)\n' +
                                '• `fast_message_spam` — Messages in 5s (default: 5)\n' +
                                '• `image_spam` — Images in 10s (default: 3)\n' +
                                '• `mass_mentions` — Max mentions (default: 5)'
                        },
                        {
                            name: 'Examples',
                            value:
                                '```\n' +
                                '/automod-setup rule:all_caps action:warn_delete threshold:80\n\n' +
                                '/automod-setup rule:fast_message_spam action:auto_mute violations:3\n\n' +
                                '/automod-setup rule:phishing_links action:instant_ban\n' +
                                '```'
                        }
                    );
                break;

            case 'filter':
                embed = new EmbedBuilder()
                    .setColor(0x9900ff)
                    .setTitle('🎯 /automod-filter')
                    .setDescription('Configure which roles/channels a rule applies to')
                    .addFields(
                        {
                            name: 'Filter Types',
                            value:
                                '• `affected` — Rule ONLY applies to these\n' +
                                '• `ignored` — Rule does NOT apply to these'
                        },
                        {
                            name: 'Target Types',
                            value:
                                '• `role` — Filter by role\n' +
                                '• `channel` — Filter by channel'
                        },
                        {
                            name: 'Examples',
                            value:
                                '```\n' +
                                '# Only apply to #general\n' +
                                '/automod-filter add rule-id:1 filter-type:affected target-type:channel target-id:#general\n\n' +
                                '# Ignore moderators\n' +
                                '/automod-filter add rule-id:1 filter-type:ignored target-type:role target-id:@Moderator\n\n' +
                                '# View filters\n' +
                                '/automod-filter list rule-id:1\n' +
                                '```'
                        },
                        {
                            name: '💡 Tip',
                            value: 'Get rule IDs from `/automod-list`'
                        }
                    );
                break;

            case 'badwords':
                embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('🚫 /automod-badwords')
                    .setDescription('Manage filtered words and phrases')
                    .addFields(
                        {
                            name: 'Match Types',
                            value:
                                '• `contains` — Matches anywhere in message\n' +
                                '  Example: "bad" matches "badword", "not bad", etc.\n\n' +
                                '• `exact` — Must be a separate word\n' +
                                '  Example: "bad" matches "this is bad" but not "badword"\n\n' +
                                '• `wildcard` — Use * for any characters\n' +
                                '  Example: "bad*word" matches "badword", "bad123word", etc.'
                        },
                        {
                            name: 'Examples',
                            value:
                                '```\n' +
                                '# Add word (contains)\n' +
                                '/automod-badwords add word:spam match-type:contains\n\n' +
                                '# Add exact match\n' +
                                '/automod-badwords add word:noob match-type:exact\n\n' +
                                '# Add wildcard\n' +
                                '/automod-badwords add word:f*ck match-type:wildcard\n\n' +
                                '# View list\n' +
                                '/automod-badwords list\n\n' +
                                '# Remove word\n' +
                                '/automod-badwords remove word:spam\n' +
                                '```'
                        },
                        {
                            name: '⚠️ Important',
                            value: 'You must create a "Bad Words" rule with `/automod-setup` for this to work!'
                        }
                    );
                break;

            case 'links':
                embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('🔗 /automod-links')
                    .setDescription('Manage link allowlists and blocklists')
                    .addFields(
                        {
                            name: 'How It Works',
                            value:
                                '• **Blocklist** — Specific domains to block\n' +
                                '• **Allowlist** — Only these domains allowed (set rule threshold to 1)'
                        },
                        {
                            name: 'Examples',
                            value:
                                '```\n' +
                                '# Block a domain\n' +
                                '/automod-links block domain:scamsite.com\n\n' +
                                '# Allow safe domains\n' +
                                '/automod-links allow domain:youtube.com\n' +
                                '/automod-links allow domain:twitter.com\n\n' +
                                '# View all\n' +
                                '/automod-links list\n' +
                                '```'
                        },
                        {
                            name: 'Using Allowlist Mode',
                            value:
                                '1. Add allowed domains with `/automod-links allow`\n' +
                                '2. Create rule: `/automod-setup rule:links action:delete threshold:1`\n' +
                                '3. Now only allowed domains work!'
                        }
                    );
                break;

            case 'settings':
                embed = new EmbedBuilder()
                    .setColor(0xffaa00)
                    .setTitle('⚙️ /automod-settings')
                    .setDescription('Configure global automod settings')
                    .addFields(
                        {
                            name: 'Available Settings',
                            value:
                                '• `log-channel` — Default log channel for all rules\n' +
                                '• `ignore-role` — Add globally ignored role\n' +
                                '• `ignore-channel` — Add globally ignored channel\n' +
                                '• `view` — View current settings'
                        },
                        {
                            name: 'Examples',
                            value:
                                '```\n' +
                                '# Set log channel\n' +
                                '/automod-settings log-channel channel:#mod-logs\n\n' +
                                '# Ignore moderators globally\n' +
                                '/automod-settings ignore-role role:@Moderator\n\n' +
                                '# Ignore staff channel\n' +
                                '/automod-settings ignore-channel channel:#staff-chat\n\n' +
                                '# View settings\n' +
                                '/automod-settings view\n' +
                                '```'
                        },
                        {
                            name: 'Always Ignored',
                            value: 'Server owner, administrators, and Dyno roles are always ignored'
                        }
                    );
                break;

            case 'list':
                embed = new EmbedBuilder()
                    .setColor(0x00aaff)
                    .setTitle('📋 /automod-list')
                    .setDescription('View all configured automod rules')
                    .addFields(
                        {
                            name: 'What It Shows',
                            value:
                                '• Rule ID (use for other commands)\n' +
                                '• Rule type and status\n' +
                                '• Configured action\n' +
                                '• Threshold values\n' +
                                '• Violation counts'
                        },
                        {
                            name: 'Example Output',
                            value:
                                '```\n' +
                                '1. All Caps\n' +
                                '   Action: Warn + Delete\n' +
                                '   Threshold: 70\n' +
                                '   Status: ✅ Enabled\n' +
                                '```'
                        }
                    );
                break;

            case 'toggle':
                embed = new EmbedBuilder()
                    .setColor(0xffaa00)
                    .setTitle('🔄 /automod-toggle')
                    .setDescription('Enable or disable a rule without deleting it')
                    .addFields(
                        {
                            name: 'Usage',
                            value: '`/automod-toggle rule-id:<id> enabled:<true/false>`'
                        },
                        {
                            name: 'Examples',
                            value:
                                '```\n' +
                                '# Disable rule #1\n' +
                                '/automod-toggle rule-id:1 enabled:false\n\n' +
                                '# Re-enable rule #1\n' +
                                '/automod-toggle rule-id:1 enabled:true\n' +
                                '```'
                        }
                    );
                break;

            case 'remove':
                embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('🗑️ /automod-remove')
                    .setDescription('Permanently delete an automod rule')
                    .addFields(
                        {
                            name: 'Usage',
                            value: '`/automod-remove rule-id:<id>`'
                        },
                        {
                            name: 'Example',
                            value: '```\n/automod-remove rule-id:1\n```'
                        },
                        {
                            name: '⚠️ Warning',
                            value: 'This permanently deletes the rule. Use `/automod-toggle` to temporarily disable instead.'
                        }
                    );
                break;
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
