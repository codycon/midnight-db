const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Configure automatic moderation')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Enable automod with default settings'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable automod'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('Configure automod settings')
                .addStringOption(option =>
                    option.setName('setting')
                        .setDescription('Setting to configure')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Bad Words Filter', value: 'badwords' },
                            { name: 'Spam Filter', value: 'spam' },
                            { name: 'Link Filter', value: 'links' },
                            { name: 'Mention Spam', value: 'mentions' }
                        ))
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable this filter')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('words')
                .setDescription('Manage filtered words')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Add or remove words')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add Word', value: 'add' },
                            { name: 'Remove Word', value: 'remove' },
                            { name: 'List Words', value: 'list' }
                        ))
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('Word to add or remove')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View automod configuration'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        const dataDir = path.join(__dirname, '../../data');
        const automodPath = path.join(dataDir, 'automod.json');
        
        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Load automod config
        let automodConfig = {};
        if (fs.existsSync(automodPath)) {
            automodConfig = JSON.parse(fs.readFileSync(automodPath, 'utf8'));
        }
        
        // Initialize guild config
        if (!automodConfig[interaction.guildId]) {
            automodConfig[interaction.guildId] = {
                enabled: false,
                filters: {
                    badwords: true,
                    spam: true,
                    links: false,
                    mentions: true
                },
                badwords: [
                    // Racial slurs - Black/African
                    'nigger', 'nigga', 'nig', 'coon', 'jigaboo', 'porch monkey',
                    // Racial slurs - Asian
                    'chink', 'gook', 'zipperhead', 'slope', 'nip', 'jap',
                    // Racial slurs - Middle Eastern/South Asian
                    'towelhead', 'sand nigger', 'camel jockey', 'raghead', 'curry muncher', 'paki',
                    // Racial slurs - Hispanic/Latino
                    'wetback', 'beaner', 'spic', 'pablo', 'border hopper', 'greaser',
                    // Racial slurs - Jewish
                    'kike', 'yid', 'heeb',
                    // Racial slurs - Italian
                    'wop', 'dago', 'guido', 'guinea',
                    // Racial slurs - Irish
                    'mick', 'paddy', 'taig', 'fenian',
                    // Racial slurs - Romani
                    'pikey', 'gypo', 'gypsy',
                    // Racial slurs - White
                    'cracker', 'honky', 'whitey',
                    // Homophobic slurs
                    'faggot', 'fag', 'dyke', 'poof', 'fairy', 'pansy', 'nancy', 'homo', 'sodomite',
                    // Transphobic slurs
                    'tranny', 'shemale', 'ladyboy', 'heshe',
                    // Ableist slurs
                    'retard', 'retarded', 'spaz', 'spastic', 'mongoloid', 'cripple', 'gimp',
                    // Hate speech and extremist terms
                    'nazi', 'heil hitler', 'white power', 'kkk', 'kys', 'kill yourself', 'gas the'
                ],
                spamThreshold: 5, // messages in 5 seconds
                mentionLimit: 5 // max mentions per message
            };
        }
        
        const subcommand = interaction.options.getSubcommand();
        const guildConfig = automodConfig[interaction.guildId];
        
        if (subcommand === 'setup') {
            guildConfig.enabled = true;
            fs.writeFileSync(automodPath, JSON.stringify(automodConfig, null, 2));
            
            const embed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Automod Enabled')
                .setDescription('Automatic moderation is now active with default settings.')
                .addFields(
                    { name: 'Bad Words Filter', value: guildConfig.filters.badwords ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Spam Filter', value: guildConfig.filters.spam ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Link Filter', value: guildConfig.filters.links ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Mention Spam', value: guildConfig.filters.mentions ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Configuration', value: 'Use `/automod config` to customize settings', inline: false }
                )
                .setFooter({ text: 'Midnight Bot • Automod' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } else if (subcommand === 'disable') {
            guildConfig.enabled = false;
            fs.writeFileSync(automodPath, JSON.stringify(automodConfig, null, 2));
            
            const embed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Automod Disabled')
                .setDescription('Automatic moderation has been turned off.')
                .addFields({
                    name: 'Re-enable',
                    value: 'Use `/automod setup` to turn it back on'
                })
                .setFooter({ text: 'Midnight Bot • Automod' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } else if (subcommand === 'config') {
            const setting = interaction.options.getString('setting');
            const enabled = interaction.options.getBoolean('enabled');
            
            guildConfig.filters[setting] = enabled;
            fs.writeFileSync(automodPath, JSON.stringify(automodConfig, null, 2));
            
            const settingNames = {
                badwords: 'Bad Words Filter',
                spam: 'Spam Filter',
                links: 'Link Filter',
                mentions: 'Mention Spam'
            };
            
            const embed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Automod Updated')
                .setDescription(`${settingNames[setting]} has been ${enabled ? 'enabled' : 'disabled'}.`)
                .addFields({
                    name: 'Current Status',
                    value: enabled ? 'Active' : 'Inactive'
                })
                .setFooter({ text: 'Midnight Bot • Automod' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } else if (subcommand === 'words') {
            const action = interaction.options.getString('action');
            const word = interaction.options.getString('word');
            
            if (action === 'list') {
                const embed = new EmbedBuilder()
                    .setColor('#6C5CE7')
                    .setTitle('Filtered Words')
                    .setDescription(`**Total:** ${guildConfig.badwords.length} words`)
                    .addFields({
                        name: 'Word List',
                        value: guildConfig.badwords.length > 0 ? '```' + guildConfig.badwords.join(', ') + '```' : 'No words filtered'
                    })
                    .setFooter({ text: 'Midnight Bot • Automod' })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
                
            } else if (action === 'add') {
                if (!word) {
                    return interaction.reply({ content: 'Please provide a word to add', ephemeral: true });
                }
                
                const lowerWord = word.toLowerCase();
                if (guildConfig.badwords.includes(lowerWord)) {
                    return interaction.reply({ content: 'This word is already filtered', ephemeral: true });
                }
                
                guildConfig.badwords.push(lowerWord);
                fs.writeFileSync(automodPath, JSON.stringify(automodConfig, null, 2));
                
                const embed = new EmbedBuilder()
                    .setColor('#6C5CE7')
                    .setTitle('Word Added')
                    .setDescription(`Added "${word}" to the filter list.`)
                    .addFields({
                        name: 'Total Filtered Words',
                        value: `${guildConfig.badwords.length}`
                    })
                    .setFooter({ text: 'Midnight Bot • Automod' })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
                
            } else if (action === 'remove') {
                if (!word) {
                    return interaction.reply({ content: 'Please provide a word to remove', ephemeral: true });
                }
                
                const lowerWord = word.toLowerCase();
                const index = guildConfig.badwords.indexOf(lowerWord);
                
                if (index === -1) {
                    return interaction.reply({ content: 'This word is not in the filter list', ephemeral: true });
                }
                
                guildConfig.badwords.splice(index, 1);
                fs.writeFileSync(automodPath, JSON.stringify(automodConfig, null, 2));
                
                const embed = new EmbedBuilder()
                    .setColor('#6C5CE7')
                    .setTitle('Word Removed')
                    .setDescription(`Removed "${word}" from the filter list.`)
                    .addFields({
                        name: 'Total Filtered Words',
                        value: `${guildConfig.badwords.length}`
                    })
                    .setFooter({ text: 'Midnight Bot • Automod' })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
            
        } else if (subcommand === 'status') {
            const statusEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Automod Configuration')
                .setDescription(guildConfig.enabled ? '**Status:** Active' : '**Status:** Disabled')
                .addFields(
                    { name: 'Bad Words Filter', value: guildConfig.filters.badwords ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Spam Filter', value: guildConfig.filters.spam ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Link Filter', value: guildConfig.filters.links ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Mention Spam', value: guildConfig.filters.mentions ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Filtered Words', value: `${guildConfig.badwords.length}`, inline: true },
                    { name: 'Spam Threshold', value: `${guildConfig.spamThreshold} messages/5s`, inline: true }
                )
                .setFooter({ text: 'Midnight Bot • Automod' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
        }
    },
};
