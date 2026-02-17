const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-info')
        .setDescription('Get information about the automod system'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🛡️ Automod System Information')
            .setDescription('Comprehensive Discord automoderation with 19 rule types')
            .addFields(
                {
                    name: '📋 Available Rule Types',
                    value: 
                        '**Content Rules:**\n' +
                        '• All Caps, Bad Words, Duplicate Text, Character Count\n' +
                        '• Newlines, Emoji Spam, Zalgo Text, Spoilers\n\n' +
                        '**Link Rules:**\n' +
                        '• Invite Links, Phishing Links, Links, Masked Links\n' +
                        '• Links Cooldown\n\n' +
                        '**Spam Rules:**\n' +
                        '• Fast Message Spam, Image Spam, Mass Mentions\n' +
                        '• Mentions Cooldown, Stickers, Sticker Cooldown'
                },
                {
                    name: '⚡ Available Actions',
                    value: 
                        '• **Warn** — Auto-deleting in-channel warning\n' +
                        '• **Delete** — Remove the message\n' +
                        '• **Warn + Delete** — Both at once\n' +
                        '• **Auto Mute** — Mute after X violations\n' +
                        '• **Auto Ban** — Ban after X violations\n' +
                        '• **Instant Mute** — Immediate timeout\n' +
                        '• **Instant Ban** — Immediate ban'
                },
                {
                    name: '🎯 Key Features',
                    value:
                        '• Per-rule role/channel scoping\n' +
                        '• Global ignored roles/channels\n' +
                        '• Custom log channels per rule\n' +
                        '• 5-minute violation windows\n' +
                        '• Wildcard pattern matching\n' +
                        '• Link allowlists/blocklists'
                },
                {
                    name: '📚 Getting Started',
                    value:
                        '1. `/automod-settings log-channel` — Set log channel\n' +
                        '2. `/automod-setup` — Create your first rule\n' +
                        '3. `/automod-list` — View all rules\n' +
                        '4. `/automod-badwords add` — Add filtered words\n' +
                        '5. `/automod-filter add` — Configure rule filters'
                },
                {
                    name: '🔗 Quick Links',
                    value:
                        '[Setup Guide](https://github.com/repo/SETUP.md) • ' +
                        '[Full Documentation](https://github.com/repo/README.md) • ' +
                        '[Command Reference](https://github.com/repo#commands)'
                }
            )
            .setFooter({ text: 'Use /help <command> for detailed command help' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
