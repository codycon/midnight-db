const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Manage the ticket system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up the ticket system')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel where members can create tickets')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('category')
                        .setDescription('Category for ticket channels')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('staff')
                        .setDescription('Staff role who can view tickets')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Close the current ticket')
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for closing')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a user to the current ticket')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to add')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a user from the current ticket')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable the ticket system'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        const dataDir = path.join(__dirname, '../../data');
        const ticketsPath = path.join(dataDir, 'tickets.json');
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        let ticketsConfig = {};
        if (fs.existsSync(ticketsPath)) {
            ticketsConfig = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
        }
        
        if (!ticketsConfig[interaction.guildId]) {
            ticketsConfig[interaction.guildId] = {
                panelChannelId: null,
                categoryId: null,
                staffRoleId: null,
                tickets: [],
                counter: 0
            };
        }
        
        const subcommand = interaction.options.getSubcommand();
        const guildConfig = ticketsConfig[interaction.guildId];
        
        if (subcommand === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const category = interaction.options.getChannel('category');
            const staffRole = interaction.options.getRole('staff');
            
            if (category.type !== ChannelType.GuildCategory) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setTitle('Invalid Category')
                    .setDescription('The category option must be a category channel.')
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
            
            guildConfig.panelChannelId = channel.id;
            guildConfig.categoryId = category.id;
            guildConfig.staffRoleId = staffRole.id;
            
            // Create ticket panel
            const panelEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('🎫 Support Tickets')
                .setDescription('Need help? Create a support ticket and our staff will assist you.')
                .addFields(
                    { name: 'How It Works', value: '1. Click the button below\n2. A private channel will be created\n3. Explain your issue\n4. Staff will respond', inline: false },
                    { name: 'What to Include', value: '• Detailed description of your issue\n• Screenshots if applicable\n• Any error messages', inline: false }
                )
                .setFooter({ text: 'Midnight Bot • Support System' })
                .setTimestamp();
            
            const button = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Create Ticket')
                .setEmoji('🎫')
                .setStyle(ButtonStyle.Primary);
            
            const row = new ActionRowBuilder().addComponents(button);
            
            try {
                await channel.send({ embeds: [panelEmbed], components: [row] });
                
                fs.writeFileSync(ticketsPath, JSON.stringify(ticketsConfig, null, 2));
                
                const successEmbed = new EmbedBuilder()
                    .setColor('#6C5CE7')
                    .setTitle('Tickets Configured')
                    .setDescription('The ticket system has been set up successfully.')
                    .addFields(
                        { name: 'Panel Channel', value: `${channel}`, inline: true },
                        { name: 'Ticket Category', value: `${category.name}`, inline: true },
                        { name: 'Staff Role', value: `${staffRole}`, inline: true }
                    )
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [successEmbed], ephemeral: true });
                
            } catch (error) {
                console.error('Error setting up tickets:', error);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setTitle('Setup Failed')
                    .setDescription('An error occurred while setting up the ticket system.')
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
            
        } else if (subcommand === 'close') {
            const reason = interaction.options.getString('reason') || 'No reason provided';
            
            // Check if this is a ticket channel
            const ticket = guildConfig.tickets.find(t => t.channelId === interaction.channelId && t.open);
            
            if (!ticket) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setTitle('Not a Ticket')
                    .setDescription('This command can only be used in ticket channels.')
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
            
            // Create transcript
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            const transcript = messages.reverse().map(m => {
                const time = m.createdAt.toLocaleString();
                return `[${time}] ${m.author.tag}: ${m.content}`;
            }).join('\n');
            
            // Save transcript
            const transcriptsDir = path.join(dataDir, 'transcripts');
            if (!fs.existsSync(transcriptsDir)) {
                fs.mkdirSync(transcriptsDir, { recursive: true });
            }
            
            const transcriptPath = path.join(transcriptsDir, `ticket-${ticket.id}.txt`);
            fs.writeFileSync(transcriptPath, transcript);
            
            // Update ticket status
            ticket.open = false;
            ticket.closedBy = interaction.user.tag;
            ticket.closedAt = Date.now();
            ticket.closeReason = reason;
            
            fs.writeFileSync(ticketsPath, JSON.stringify(ticketsConfig, null, 2));
            
            // Send closing message
            const closeEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Ticket Closing')
                .setDescription('This ticket will be deleted in 10 seconds.')
                .addFields(
                    { name: 'Closed By', value: `${interaction.user}`, inline: true },
                    { name: 'Reason', value: reason, inline: true }
                )
                .setFooter({ text: 'Midnight Bot • Transcript saved' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [closeEmbed] });
            
            // DM the ticket creator
            try {
                const user = await interaction.client.users.fetch(ticket.userId);
                const dmEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setTitle('Ticket Closed')
                    .setDescription(`Your ticket in **${interaction.guild.name}** has been closed.`)
                    .addFields(
                        { name: 'Ticket', value: `#${ticket.id} - ${interaction.channel.name}`, inline: false },
                        { name: 'Closed By', value: interaction.user.tag, inline: true },
                        { name: 'Reason', value: reason, inline: true }
                    )
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                await user.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log(`Could not DM user ${ticket.userId}`);
            }
            
            // Delete channel after 10 seconds
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (error) {
                    console.error('Error deleting ticket channel:', error);
                }
            }, 10000);
            
        } else if (subcommand === 'add') {
            const user = interaction.options.getUser('user');
            
            const ticket = guildConfig.tickets.find(t => t.channelId === interaction.channelId && t.open);
            
            if (!ticket) {
                return interaction.reply({ content: 'This is not a ticket channel', ephemeral: true });
            }
            
            try {
                await interaction.channel.permissionOverwrites.create(user, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                
                const addEmbed = new EmbedBuilder()
                    .setColor('#6C5CE7')
                    .setTitle('User Added')
                    .setDescription(`${user} has been added to this ticket.`)
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [addEmbed] });
                
            } catch (error) {
                console.error('Error adding user to ticket:', error);
                await interaction.reply({ content: 'Failed to add user', ephemeral: true });
            }
            
        } else if (subcommand === 'remove') {
            const user = interaction.options.getUser('user');
            
            const ticket = guildConfig.tickets.find(t => t.channelId === interaction.channelId && t.open);
            
            if (!ticket) {
                return interaction.reply({ content: 'This is not a ticket channel', ephemeral: true });
            }
            
            if (user.id === ticket.userId) {
                return interaction.reply({ content: 'Cannot remove the ticket creator', ephemeral: true });
            }
            
            try {
                await interaction.channel.permissionOverwrites.delete(user);
                
                const removeEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setTitle('User Removed')
                    .setDescription(`${user} has been removed from this ticket.`)
                    .setFooter({ text: 'Midnight Bot' })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [removeEmbed] });
                
            } catch (error) {
                console.error('Error removing user from ticket:', error);
                await interaction.reply({ content: 'Failed to remove user', ephemeral: true });
            }
            
        } else if (subcommand === 'disable') {
            guildConfig.panelChannelId = null;
            guildConfig.categoryId = null;
            guildConfig.staffRoleId = null;
            
            fs.writeFileSync(ticketsPath, JSON.stringify(ticketsConfig, null, 2));
            
            const disableEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('Tickets Disabled')
                .setDescription('The ticket system has been disabled.')
                .addFields({
                    name: 'Re-enable',
                    value: 'Use `/tickets setup` to turn it back on'
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [disableEmbed], ephemeral: true });
        }
    },
};
