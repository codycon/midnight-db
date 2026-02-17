'use strict';

const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js');
const tdb           = require('./ticketDatabase');
const transcriptGen = require('./transcriptGenerator');
const { CUSTOM_IDS, LIMITS, DEFAULT_LABEL_FORMAT } = require('./constants');

// Colours used across embeds
const COLOR = {
    BRAND:   0x5865F2,
    GREEN:   0x23A55A,
    RED:     0xED4245,
    YELLOW:  0xFEE75C,
};

class TicketManager {

    // -------------------------------------------------------------------------
    // Ticket Creation
    // -------------------------------------------------------------------------

    /**
     * Creates a ticket channel or thread for the given panel option.
     *
     * @param {import('discord.js').Interaction} interaction
     * @param {object} panel    - Full panel row (with embeds and options populated).
     * @param {object|null} option - The panel option that was selected, or null.
     * @param {Record<string,string>} answers - Answers from the modal, keyed by question label.
     */
    async createTicket(interaction, panel, option, answers = {}) {
        const { guild, member } = interaction;

        // --- Required role check ---
        if (option?.required_roles?.length) {
            const hasRole = option.required_roles.some(id => member.roles.cache.has(id));
            if (!hasRole) {
                return interaction.reply({
                    content: 'You do not have the required role to open this ticket type.',
                    ephemeral: true,
                });
            }
        }

        // --- Deduplication check ---
        const existing = tdb.getOpenTicketByUser(guild.id, member.id, option?.id ?? null);
        if (existing) {
            const ref = existing.channel_id || existing.thread_id;
            return interaction.reply({
                content: `You already have an open ticket.${ref ? ` ${ref}` : ''}`,
                ephemeral: true,
            });
        }

        const ticketNumber = tdb.nextTicketNumber(guild.id);
        const ticketName   = this._formatLabel(
            option?.label_format ?? DEFAULT_LABEL_FORMAT,
            member,
            ticketNumber
        );

        const style = option?.ticket_style ?? panel.ticket_style ?? 'channel';
        const settings = tdb.getSettings(guild.id);

        const channel = style === 'thread'
            ? await this._createThread(guild, panel, option, member, ticketName)
            : await this._createChannel(guild, option, member, ticketName, ticketNumber, settings);

        if (!channel) {
            return interaction.reply({
                content: 'Failed to create a ticket channel. Please contact an administrator.',
                ephemeral: true,
            });
        }

        const ticketResult = tdb.createTicket({
            guildId:      guild.id,
            panelId:      panel.id,
            optionId:     option?.id ?? null,
            userId:       member.id,
            channelId:    style === 'channel' ? channel.id : null,
            threadId:     style === 'thread'  ? channel.id : null,
            ticketNumber,
            ticketName,
            answers,
        });
        const ticketId = ticketResult.lastInsertRowid;

        await this._sendOpenerMessage(channel, member, option, answers, ticketId, ticketNumber);
        await this._logOpen(guild, member, channel, ticketNumber, ticketName, option, settings);

        return interaction.reply({
            content: `Your ticket has been created: ${channel}`,
            ephemeral: true,
        });
    }

    async _createChannel(guild, option, member, ticketName, ticketNumber, settings) {
        const categoryId   = option?.category_id ?? settings.default_cat ?? null;
        const staffRoles   = tdb.getStaffRoles(guild.id);
        const supportRoles = option?.support_roles ?? [];

        const staffPermissions = [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
        ];

        const permissionOverwrites = [
            // Deny everyone by default
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            // Bot needs manage permissions
            {
                id:    guild.members.me.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                ],
            },
            // Ticket opener can view and send
            {
                id:    member.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                ],
            },
        ];

        // Staff and support roles get staff-level permissions
        const roleIds = [...new Set([...staffRoles, ...supportRoles])];
        for (const roleId of roleIds) {
            if (guild.roles.cache.has(roleId)) {
                permissionOverwrites.push({ id: roleId, allow: staffPermissions });
            }
        }

        try {
            return await guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                parent: categoryId ?? undefined,
                topic: `Ticket #${ticketNumber} | ${member.user.tag} (${member.id})`,
                permissionOverwrites,
            });
        } catch (err) {
            console.error('[TICKET] Failed to create channel:', err);
            return null;
        }
    }

    async _createThread(guild, panel, option, member, ticketName) {
        const staffRoles   = tdb.getStaffRoles(guild.id);
        const supportRoles = option?.support_roles ?? [];

        // Threads must be parented to a text channel. Prefer the channel the panel was posted in.
        const parentChannel = (panel.channel_id && guild.channels.cache.get(panel.channel_id))
            ?? guild.channels.cache.find(c => c.type === ChannelType.GuildText && !c.parentId)
            ?? null;

        if (!parentChannel) {
            console.error('[TICKET] No suitable parent channel found for thread ticket.');
            return null;
        }

        try {
            const thread = await parentChannel.threads.create({
                name:      ticketName,
                type:      ChannelType.PrivateThread,
                invitable: false,
                reason:    `Ticket opened by ${member.user.tag}`,
            });

            await thread.members.add(member.id);

            const roleIds = [...new Set([...staffRoles, ...supportRoles])];
            for (const roleId of roleIds) {
                // Only iterate cached members — fetching all members on every ticket open is too expensive.
                for (const [, m] of guild.members.cache.filter(m => m.roles.cache.has(roleId))) {
                    await thread.members.add(m.id).catch(() => {});
                }
            }

            return thread;
        } catch (err) {
            console.error('[TICKET] Failed to create thread:', err);
            return null;
        }
    }

    async _sendOpenerMessage(channel, member, option, answers, ticketId, ticketNumber) {
        const description = [
            `Welcome ${member}. A member of staff will be with you shortly.`,
            option ? `\n**Category:** ${option.label}` : '',
            '\nUse the button below to close this ticket when your issue is resolved.',
        ].join('');

        const embed = new EmbedBuilder()
            .setColor(COLOR.BRAND)
            .setTitle(`Ticket #${ticketNumber}`)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: `Ticket ID: ${ticketId}` });

        for (const [question, answer] of Object.entries(answers)) {
            embed.addFields({ name: question, value: answer || 'No answer provided', inline: false });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.TICKET_CLOSE}:${ticketId}`)
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.TICKET_STAFF_THREAD}:${ticketId}`)
                .setLabel('Staff Thread')
                .setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ content: `${member}`, embeds: [embed], components: [row] });
    }

    // -------------------------------------------------------------------------
    // Close Ticket
    // -------------------------------------------------------------------------

    /**
     * Closes a ticket. On first call (confirm=false) shows a confirmation prompt.
     * On second call (confirm=true) performs the actual close.
     */
    async closeTicket(interaction, ticketId, confirm = false) {
        const ticket = tdb.getTicket(ticketId);

        if (!ticket) {
            return interaction.reply({ content: 'Ticket not found.', ephemeral: true });
        }
        if (ticket.status !== 'open') {
            return interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });
        }

        if (!confirm) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.TICKET_CLOSE_CONFIRM}:${ticketId}`)
                    .setLabel('Close ticket')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(CUSTOM_IDS.TICKET_CLOSE_CANCEL)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({
                content: 'Are you sure you want to close this ticket?',
                components: [row],
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const { guild, channel } = interaction;
        const settings = tdb.getSettings(guild.id);

        // Generate transcript before mutating anything
        let transcriptBuf;
        try {
            transcriptBuf = await transcriptGen.fromChannel(channel, ticket, guild);
        } catch (err) {
            console.error('[TICKET] Live transcript failed, falling back to DB:', err);
            transcriptBuf = transcriptGen.fromDatabase(ticket, guild);
        }

        tdb.closeTicket(ticketId, interaction.user.id);

        const closeEmbed = new EmbedBuilder()
            .setColor(COLOR.RED)
            .setTitle('Ticket Closed')
            .setDescription(`Closed by ${interaction.user}. A transcript has been sent to the log channel.`)
            .setTimestamp();

        await channel.send({ embeds: [closeEmbed] });
        await this._logClose(guild, ticket, transcriptBuf, interaction.user, settings);

        // Lock channel so no further messages can be sent
        await channel.permissionOverwrites.edit(guild.id, { SendMessages: false }).catch(() => {});
        await this._disableTicketButtons(channel);

        await interaction.editReply({ content: 'Ticket closed. Transcript has been sent to the log channel.' });
    }

    /** Called when a ticket channel is manually deleted without /ticket close. */
    async handleChannelDelete(channel) {
        const ticket = tdb.getTicketByChannel(channel.id);
        if (!ticket || ticket.status !== 'open') return;

        const settings = tdb.getSettings(channel.guild.id);
        const buf      = transcriptGen.fromDatabase(ticket, channel.guild);

        tdb.closeTicket(ticket.id, 'channel_deleted');
        await this._logClose(channel.guild, ticket, buf, null, settings, true);
    }

    /**
     * Disables all ticket lifecycle buttons on the most recent bot messages.
     * We only scan the 20 most recent messages to avoid expensive fetches.
     */
    async _disableTicketButtons(channel) {
        try {
            const messages = await channel.messages.fetch({ limit: 20 });
            for (const msg of messages.values()) {
                if (msg.author.id !== channel.client.user.id || !msg.components.length) continue;

                const updatedRows = msg.components.map(row => {
                    const buttons = row.components.map(btn => {
                        const isTicketButton = btn.customId?.startsWith('ticket_close')
                            || btn.customId?.startsWith('ticket_staff');
                        return ButtonBuilder.from(btn).setDisabled(isTicketButton);
                    });
                    return new ActionRowBuilder().addComponents(buttons);
                });

                await msg.edit({ components: updatedRows }).catch(() => {});
            }
        } catch (err) {
            console.error('[TICKET] Failed to disable buttons:', err);
        }
    }

    // -------------------------------------------------------------------------
    // Logging
    // -------------------------------------------------------------------------

    async _logOpen(guild, member, channel, ticketNumber, ticketName, option, settings) {
        const logChannel = settings.log_open
            ? guild.channels.cache.get(settings.log_open)
            : null;
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor(COLOR.GREEN)
            .setTitle('Ticket Opened')
            .addFields(
                { name: 'Ticket',    value: `#${ticketNumber} — ${ticketName}`, inline: true },
                { name: 'Channel',   value: `${channel}`,                       inline: true },
                { name: 'Opened By', value: `${member} (${member.user.tag})`,   inline: false },
                { name: 'Category',  value: option?.label ?? 'General',         inline: true },
            )
            .setTimestamp()
            .setFooter({ text: `User ID: ${member.id}` });

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    /** Public alias so external callers (e.g. /ticket delete) do not access a private method. */
    async logClose(guild, ticket, transcriptBuf, closedBy, settings, wasDeleted = false) {
        return this._logClose(guild, ticket, transcriptBuf, closedBy, settings, wasDeleted);
    }

    async _logClose(guild, ticket, transcriptBuf, closedBy, settings, wasDeleted = false) {
        const logChannel = settings.log_close
            ? guild.channels.cache.get(settings.log_close)
            : null;
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor(wasDeleted ? COLOR.YELLOW : COLOR.RED)
            .setTitle(wasDeleted ? 'Ticket Deleted' : 'Ticket Closed')
            .addFields(
                { name: 'Ticket',    value: `#${ticket.ticket_number} — ${ticket.ticket_name}`, inline: true },
                { name: 'User',      value: `<@${ticket.user_id}> (${ticket.user_id})`,         inline: true },
                { name: 'Closed By', value: closedBy ? `${closedBy}` : 'Channel deleted',       inline: true },
                { name: 'Opened',    value: `<t:${ticket.opened_at}:R>`,                        inline: true },
                { name: 'Closed',    value: `<t:${Math.floor(Date.now() / 1000)}:R>`,           inline: true },
            )
            .setTimestamp();

        const file = new AttachmentBuilder(transcriptBuf, {
            name: `transcript-${ticket.ticket_name}-${ticket.ticket_number}.html`,
        });

        await logChannel.send({ embeds: [embed], files: [file] }).catch(() => {});
    }

    // -------------------------------------------------------------------------
    // Staff Thread
    // -------------------------------------------------------------------------

    async createStaffThread(interaction, ticketId) {
        const ticket = tdb.getTicket(ticketId);
        if (!ticket || ticket.status !== 'open') {
            return interaction.reply({ content: 'Ticket not found or already closed.', ephemeral: true });
        }
        if (interaction.channel.type !== ChannelType.GuildText) {
            return interaction.reply({
                content: 'Staff threads can only be created inside channel-style tickets.',
                ephemeral: true,
            });
        }

        try {
            const thread = await interaction.channel.threads.create({
                name:      `staff-${ticket.ticket_name}`.slice(0, 100),
                type:      ChannelType.PrivateThread,
                invitable: false,
                reason:    `Staff discussion for ticket #${ticket.ticket_number}`,
            });

            const staffRoles = tdb.getStaffRoles(interaction.guild.id);
            const added = new Set();
            for (const roleId of staffRoles) {
                for (const [id, m] of interaction.guild.members.cache.filter(m => m.roles.cache.has(roleId))) {
                    if (!added.has(id)) {
                        await thread.members.add(id).catch(() => {});
                        added.add(id);
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setColor(COLOR.BRAND)
                .setTitle('Staff Discussion Thread')
                .setDescription(
                    `Private thread for **Ticket #${ticket.ticket_number}** opened by <@${ticket.user_id}>.\n` +
                    'This thread is only visible to staff.'
                );

            await thread.send({ embeds: [embed] });
            await interaction.reply({ content: `Staff thread created: ${thread}`, ephemeral: true });
        } catch (err) {
            console.error('[TICKET] Failed to create staff thread:', err);
            await interaction.reply({ content: 'Failed to create staff thread.', ephemeral: true });
        }
    }

    // -------------------------------------------------------------------------
    // Panel Payload
    // -------------------------------------------------------------------------

    /**
     * Builds the Discord message payload (embeds + components) for posting a panel.
     */
    buildPanelPayload(panel) {
        const embeds = (panel.embeds ?? []).slice(0, LIMITS.PANEL_EMBEDS).map(e => {
            const eb = new EmbedBuilder().setColor(e.color || COLOR.BRAND);
            if (e.title)       eb.setTitle(e.title);
            if (e.description) eb.setDescription(e.description);
            if (e.image_url)   eb.setImage(e.image_url);
            if (e.thumbnail)   eb.setThumbnail(e.thumbnail);
            if (e.footer)      eb.setFooter({ text: e.footer });
            return eb;
        });

        if (!embeds.length) {
            embeds.push(
                new EmbedBuilder()
                    .setColor(COLOR.BRAND)
                    .setTitle('Support')
                    .setDescription('Select an option below to open a ticket.')
            );
        }

        const components = [];

        if (panel.input_type === 'select') {
            const select = new StringSelectMenuBuilder()
                .setCustomId(`${CUSTOM_IDS.TICKET_SELECT}:${panel.id}`)
                .setPlaceholder('Select a category...')
                .addOptions(
                    (panel.options ?? []).slice(0, 25).map(o =>
                        new StringSelectMenuOptionBuilder()
                            .setValue(String(o.id))
                            .setLabel(o.label)
                            .setDescription(o.description ?? `Open a ${o.label} ticket`)
                    )
                );
            components.push(new ActionRowBuilder().addComponents(select));
        } else {
            // Buttons: max 5 per row, max 5 rows = 25 total
            const options = (panel.options ?? []).slice(0, LIMITS.PANEL_OPTIONS);
            for (let i = 0; i < options.length; i += LIMITS.BUTTONS_PER_ROW) {
                const row = new ActionRowBuilder();
                for (const o of options.slice(i, i + LIMITS.BUTTONS_PER_ROW)) {
                    const btn = new ButtonBuilder()
                        .setCustomId(`${CUSTOM_IDS.TICKET_OPEN}:${panel.id}:${o.id}`)
                        .setLabel(o.label)
                        .setStyle(o.btn_style ?? ButtonStyle.Primary);
                    if (o.emoji) btn.setEmoji(o.emoji);
                    row.addComponents(btn);
                }
                components.push(row);
            }
        }

        return { embeds, components };
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** Formats a ticket channel name from a format string. */
    _formatLabel(format, member, number) {
        const username = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        return format
            .replace('{username}', username)
            .replace('{number}',   String(number).padStart(4, '0'))
            .replace('{tag}',      member.user.tag.replace(/[^a-z0-9]/gi, ''))
            .slice(0, 100);
    }

    /** Returns true if the member should be treated as support staff. */
    isStaff(member) {
        if (member.guild.ownerId === member.id) return true;
        if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
        const staffRoles = tdb.getStaffRoles(member.guild.id);
        return staffRoles.some(id => member.roles.cache.has(id));
    }
}

module.exports = new TicketManager();
