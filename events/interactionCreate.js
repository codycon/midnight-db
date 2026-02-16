const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}:`, error);
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ 
                        content: 'There was an error while executing this command!', 
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        content: 'There was an error while executing this command!', 
                        ephemeral: true 
                    });
                }
            }
        }
        
        // Handle button interactions
        else if (interaction.isButton()) {
            if (interaction.customId === 'verify_button') {
                try {
                    // Load autorole configuration
                    const dataDir = path.join(__dirname, '../data');
                    const autoRolesPath = path.join(dataDir, 'autoroles.json');
                    
                    if (!fs.existsSync(autoRolesPath)) {
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#2D1B69')
                            .setTitle('Configuration Error')
                            .setDescription('No autorole has been configured for this server.')
                            .addFields({
                                name: 'Contact',
                                value: 'Please contact a server administrator to set up verification.'
                            })
                            .setFooter({ text: 'Midnight Bot' })
                            .setTimestamp();
                        
                        return interaction.reply({
                            embeds: [errorEmbed],
                            ephemeral: true
                        });
                    }
                    
                    const autoRoles = JSON.parse(fs.readFileSync(autoRolesPath, 'utf8'));
                    const roleId = autoRoles[interaction.guildId];
                    
                    if (!roleId) {
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#2D1B69')
                            .setTitle('Configuration Error')
                            .setDescription('No autorole has been configured for this server.')
                            .addFields({
                                name: 'Contact',
                                value: 'Please contact a server administrator to set up verification.'
                            })
                            .setFooter({ text: 'Midnight Bot' })
                            .setTimestamp();
                        
                        return interaction.reply({
                            embeds: [errorEmbed],
                            ephemeral: true
                        });
                    }
                    
                    const role = await interaction.guild.roles.fetch(roleId);
                    
                    if (!role) {
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#2D1B69')
                            .setTitle('Configuration Error')
                            .setDescription('The verification role no longer exists.')
                            .addFields({
                                name: 'Contact',
                                value: 'Please contact a server administrator to reconfigure verification.'
                            })
                            .setFooter({ text: 'Midnight Bot' })
                            .setTimestamp();
                        
                        return interaction.reply({
                            embeds: [errorEmbed],
                            ephemeral: true
                        });
                    }
                    
                    // Check if user already has the role
                    if (interaction.member.roles.cache.has(roleId)) {
                        const alreadyVerifiedEmbed = new EmbedBuilder()
                            .setColor('#6C5CE7')
                            .setTitle('Already Verified')
                            .setDescription('You are already verified in this server.')
                            .addFields({
                                name: 'Your Role',
                                value: `${role}`
                            })
                            .setFooter({ text: 'Midnight Bot' })
                            .setTimestamp();
                        
                        return interaction.reply({
                            embeds: [alreadyVerifiedEmbed],
                            ephemeral: true
                        });
                    }
                    
                    // Check if bot can assign this role
                    const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
                    const botHighestRole = botMember.roles.highest;
                    
                    if (role.position >= botHighestRole.position) {
                        console.error(`Cannot assign role ${role.name} - bot's highest role is too low`);
                        
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#2D1B69')
                            .setTitle('Role Hierarchy Error')
                            .setDescription('Unable to assign the verification role due to role hierarchy.')
                            .addFields({
                                name: 'Contact',
                                value: 'Please contact a server administrator to fix the role hierarchy.'
                            })
                            .setFooter({ text: 'Midnight Bot' })
                            .setTimestamp();
                        
                        return interaction.reply({
                            embeds: [errorEmbed],
                            ephemeral: true
                        });
                    }
                    
                    // Assign the role
                    await interaction.member.roles.add(role);
                    
                    console.log(`Verified ${interaction.user.tag} and assigned role "${role.name}" in ${interaction.guild.name}`);
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor('#6C5CE7')
                        .setTitle('Verification Successful')
                        .setDescription(`Welcome to **${interaction.guild.name}**! You have been verified.`)
                        .addFields(
                            { name: 'Role Assigned', value: `${role}`, inline: true },
                            { name: 'Status', value: 'Verified', inline: true }
                        )
                        .setFooter({ text: 'Midnight Bot' })
                        .setTimestamp();
                    
                    await interaction.reply({
                        embeds: [successEmbed],
                        ephemeral: true
                    });
                    
                } catch (error) {
                    console.error('Error during verification:', error);
                    await interaction.reply({
                        content: 'There was an error during verification. Please contact a server administrator.',
                        ephemeral: true
                    });
                }
            }
            
            // Handle ticket creation button
            else if (interaction.customId === 'create_ticket') {
                try {
                    const { ChannelType, PermissionsBitField } = require('discord.js');
                    
                    // Load tickets configuration
                    const dataDir = path.join(__dirname, '../data');
                    const ticketsPath = path.join(dataDir, 'tickets.json');
                    
                    if (!fs.existsSync(ticketsPath)) {
                        return interaction.reply({
                            content: 'Tickets are not configured. Please contact an administrator.',
                            ephemeral: true
                        });
                    }
                    
                    const ticketsConfig = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
                    const guildConfig = ticketsConfig[interaction.guildId];
                    
                    if (!guildConfig || !guildConfig.categoryId) {
                        return interaction.reply({
                            content: 'Tickets are not configured. Please contact an administrator.',
                            ephemeral: true
                        });
                    }
                    
                    // Check if user already has an open ticket
                    const existingTicket = guildConfig.tickets.find(t => t.userId === interaction.user.id && t.open);
                    
                    if (existingTicket) {
                        const channel = await interaction.guild.channels.fetch(existingTicket.channelId).catch(() => null);
                        
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#2D1B69')
                            .setTitle('Ticket Already Open')
                            .setDescription('You already have an open ticket.')
                            .addFields({
                                name: 'Your Ticket',
                                value: channel ? `${channel}` : 'Channel not found'
                            })
                            .setFooter({ text: 'Midnight Bot' })
                            .setTimestamp();
                        
                        return interaction.reply({
                            embeds: [errorEmbed],
                            ephemeral: true
                        });
                    }
                    
                    // Increment ticket counter
                    guildConfig.counter++;
                    const ticketId = guildConfig.counter;
                    
                    // Create ticket channel
                    const ticketChannel = await interaction.guild.channels.create({
                        name: `ticket-${ticketId}`,
                        type: ChannelType.GuildText,
                        parent: guildConfig.categoryId,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: [PermissionsBitField.Flags.ViewChannel]
                            },
                            {
                                id: interaction.user.id,
                                allow: [
                                    PermissionsBitField.Flags.ViewChannel,
                                    PermissionsBitField.Flags.SendMessages,
                                    PermissionsBitField.Flags.ReadMessageHistory
                                ]
                            },
                            {
                                id: guildConfig.staffRoleId,
                                allow: [
                                    PermissionsBitField.Flags.ViewChannel,
                                    PermissionsBitField.Flags.SendMessages,
                                    PermissionsBitField.Flags.ReadMessageHistory
                                ]
                            },
                            {
                                id: interaction.client.user.id,
                                allow: [
                                    PermissionsBitField.Flags.ViewChannel,
                                    PermissionsBitField.Flags.SendMessages,
                                    PermissionsBitField.Flags.ReadMessageHistory
                                ]
                            }
                        ]
                    });
                    
                    // Save ticket data
                    guildConfig.tickets.push({
                        id: ticketId,
                        userId: interaction.user.id,
                        userTag: interaction.user.tag,
                        channelId: ticketChannel.id,
                        open: true,
                        createdAt: Date.now()
                    });
                    
                    fs.writeFileSync(ticketsPath, JSON.stringify(ticketsConfig, null, 2));
                    
                    // Send welcome message in ticket channel
                    const welcomeEmbed = new EmbedBuilder()
                        .setColor('#6C5CE7')
                        .setTitle(`Ticket #${ticketId}`)
                        .setDescription(`Welcome ${interaction.user}! Please describe your issue and our support team will assist you shortly.`)
                        .addFields(
                            { name: 'Created By', value: `${interaction.user}`, inline: true },
                            { name: 'Status', value: 'Open', inline: true }
                        )
                        .setFooter({ text: 'Midnight Bot • Support Ticket' })
                        .setTimestamp();
                    
                    await ticketChannel.send({ embeds: [welcomeEmbed] });
                    
                    // Confirm to user
                    const confirmEmbed = new EmbedBuilder()
                        .setColor('#6C5CE7')
                        .setTitle('Ticket Created')
                        .setDescription('Your support ticket has been created.')
                        .addFields({
                            name: 'Channel',
                            value: `${ticketChannel}`
                        })
                        .setFooter({ text: 'Midnight Bot' })
                        .setTimestamp();
                    
                    await interaction.reply({
                        embeds: [confirmEmbed],
                        ephemeral: true
                    });
                    
                    console.log(`[TICKET] ${interaction.user.tag} created ticket #${ticketId}`);
                    
                } catch (error) {
                    console.error('Error creating ticket:', error);
                    await interaction.reply({
                        content: 'There was an error creating your ticket. Please contact an administrator.',
                        ephemeral: true
                    });
                }
            }

        }
    },
};
