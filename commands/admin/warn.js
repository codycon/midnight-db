const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Manage member warnings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Warn a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The member to warn')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for warning')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View warnings for a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The member to check')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear all warnings for a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The member to clear warnings for')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const dataDir = path.join(__dirname, '../../data');
        const warnsPath = path.join(dataDir, 'warnings.json');
        
        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Load warnings
        let warnings = {};
        if (fs.existsSync(warnsPath)) {
            warnings = JSON.parse(fs.readFileSync(warnsPath, 'utf8'));
        }
        
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');
        
        // Initialize guild warnings if doesn't exist
        if (!warnings[interaction.guildId]) {
            warnings[interaction.guildId] = {};
        }
        
        // Initialize user warnings if doesn't exist
        if (!warnings[interaction.guildId][targetUser.id]) {
            warnings[interaction.guildId][targetUser.id] = [];
        }
        
        if (subcommand === 'add') {
            const reason = interaction.options.getString('reason');
            
            // Add warning
            const warning = {
                reason: reason,
                moderator: interaction.user.tag,
                moderatorId: interaction.user.id,
                timestamp: Date.now()
            };
            
            warnings[interaction.guildId][targetUser.id].push(warning);
            fs.writeFileSync(warnsPath, JSON.stringify(warnings, null, 2));
            
            const warnCount = warnings[interaction.guildId][targetUser.id].length;
            
            // Try to DM the user
            const dmEmbed = new EmbedBuilder()
                .setColor('#5F4B8B')
                .setTitle('Warning Issued')
                .setDescription(`You have received a warning in **${interaction.guild.name}**`)
                .addFields(
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Total Warnings', value: `${warnCount}`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true }
                )
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            try {
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log(`Could not DM ${targetUser.tag}`);
            }
            
            const successEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Warning Issued')
                .setDescription(`${targetUser} has been warned`)
                .addFields(
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Total Warnings', value: `${warnCount}`, inline: true },
                    { name: 'Moderator', value: `${interaction.user}`, inline: true }
                )
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [successEmbed]
            });
            
            console.log(`[WARN] ${targetUser.tag} warned by ${interaction.user.tag} - Total: ${warnCount}`);
            
        } else if (subcommand === 'list') {
            const userWarnings = warnings[interaction.guildId][targetUser.id];
            
            if (!userWarnings || userWarnings.length === 0) {
                const noWarningsEmbed = new EmbedBuilder()
                    .setColor('#6C5CE7')
                    .setTitle('Warning History')
                    .setDescription(`${targetUser} has no warnings on record.`)
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                return interaction.reply({
                    embeds: [noWarningsEmbed],
                    ephemeral: true
                });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#5F4B8B')
                .setTitle(`Warning History for ${targetUser.tag}`)
                .setDescription(`This member has **${userWarnings.length}** warning(s) on record.`)
                .setFooter({ text: 'Midnight Bot • Warning System' })
                .setTimestamp();
            
            userWarnings.forEach((warn, index) => {
                const date = new Date(warn.timestamp);
                embed.addFields({
                    name: `Warning #${index + 1}`,
                    value: `**Reason:** ${warn.reason}\n**Moderator:** ${warn.moderator}\n**Date:** ${date.toLocaleDateString()}`,
                    inline: false
                });
            });
            
            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
            
        } else if (subcommand === 'clear') {
            const warnCount = warnings[interaction.guildId][targetUser.id].length;
            
            if (warnCount === 0) {
                const noWarningsEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setTitle('No Warnings Found')
                    .setDescription(`${targetUser} has no warnings to clear.`)
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                return interaction.reply({
                    embeds: [noWarningsEmbed],
                    ephemeral: true
                });
            }
            
            warnings[interaction.guildId][targetUser.id] = [];
            fs.writeFileSync(warnsPath, JSON.stringify(warnings, null, 2));
            
            const successEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('Warnings Cleared')
                .setDescription(`Removed all warnings for ${targetUser}`)
                .addFields(
                    { name: 'Warnings Removed', value: `${warnCount}`, inline: true },
                    { name: 'Moderator', value: `${interaction.user}`, inline: true }
                )
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [successEmbed]
            });
            
            console.log(`[WARN] Cleared ${warnCount} warnings from ${targetUser.tag} by ${interaction.user.tag}`);
        }
    },
};
