const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Set role for verified members')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to give verified members')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    
    async execute(interaction) {
        const dataDir = path.join(__dirname, '../../data');
        const dataPath = path.join(dataDir, 'autoroles.json');
        
        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Load existing data
        let autoRoles = {};
        if (fs.existsSync(dataPath)) {
            autoRoles = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        }
        
        const role = interaction.options.getRole('role');
        
        // Check if bot can assign this role
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
        const botHighestRole = botMember.roles.highest;
        
        if (role.position >= botHighestRole.position) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Role Hierarchy Error')
                .setDescription(`Cannot assign ${role} because it is higher than or equal to my highest role.`)
                .addFields({
                    name: 'Solution',
                    value: 'Move my role higher in **Server Settings → Roles**'
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
        
        autoRoles[interaction.guildId] = role.id;
        fs.writeFileSync(dataPath, JSON.stringify(autoRoles, null, 2));
        
        console.log(`Autorole set: ${role.name} for ${interaction.guild.name}`);
        
        const successEmbed = new EmbedBuilder()
            .setColor('#6C5CE7')
            .setTitle('Autorole Configured')
            .setDescription(`Verified members will now receive ${role}`)
            .addFields(
                { name: 'Next Steps', value: 'Use `/verify` to send a verification button to a channel' }
            )
            .setFooter({ text: 'Midnight Bot' })
            .setTimestamp();
        
        await interaction.reply({
            embeds: [successEmbed],
            ephemeral: true
        });
    },
};
