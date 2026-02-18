"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  AttachmentBuilder,
} = require("discord.js");
const tdb = require("../../utils/ticketDatabase");
const manager = require("../../utils/ticketManager");
const transcript = require("../../utils/transcriptGenerator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage tickets")
    .addSubcommand((s) =>
      s.setName("close").setDescription("Close and lock the current ticket"),
    )
    .addSubcommand((s) =>
      s
        .setName("delete")
        .setDescription(
          "Close, generate a transcript, then delete the ticket channel",
        )
        .addStringOption((o) =>
          o.setName("reason").setDescription("Reason for deletion"),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Add a user to the current ticket")
        .addUserOption((o) =>
          o.setName("user").setDescription("User to add").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove a user from the current ticket")
        .addUserOption((o) =>
          o.setName("user").setDescription("User to remove").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("rename")
        .setDescription("Rename the current ticket channel")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("New channel name")
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("transcript")
        .setDescription(
          "Generate and download a transcript of the current ticket",
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("history")
        .setDescription("Search ticket history")
        .addStringOption((o) =>
          o
            .setName("query")
            .setDescription(
              "Search by ticket name, user ID, channel ID, or ticket number",
            ),
        )
        .addUserOption((o) =>
          o.setName("user").setDescription("Filter by user"),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // These two subcommands do not require the current channel to be a ticket
    if (sub === "history") return this._history(interaction);
    if (sub === "transcript") return this._transcript(interaction);

    const ticket = tdb.getTicketByChannel(interaction.channel.id);
    const isStaff = manager.isStaff(interaction.member);

    switch (sub) {
      case "close":
        return this._close(interaction, ticket, isStaff);
      case "delete":
        return this._delete(interaction, ticket, isStaff);
      case "add":
        return this._add(interaction, ticket, isStaff);
      case "remove":
        return this._remove(interaction, ticket, isStaff);
      case "rename":
        return this._rename(interaction, ticket, isStaff);
    }
  },

  // -------------------------------------------------------------------------

  async _close(interaction, ticket, isStaff) {
    if (!ticket) {
      return interaction.reply({
        content: "This channel is not a ticket.",
        ephemeral: true,
      });
    }
    if (ticket.status !== "open") {
      return interaction.reply({
        content: "This ticket is already closed.",
        ephemeral: true,
      });
    }
    if (!isStaff && interaction.user.id !== ticket.user_id) {
      return interaction.reply({
        content: "Only staff or the ticket owner can close this ticket.",
        ephemeral: true,
      });
    }

    return manager.closeTicket(interaction, ticket.id, true);
  },

  async _delete(interaction, ticket, isStaff) {
    if (!isStaff) {
      return interaction.reply({
        content: "Only staff can delete ticket channels.",
        ephemeral: true,
      });
    }
    if (!ticket) {
      return interaction.reply({
        content: "This channel is not a ticket.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.channel;
    const reason =
      interaction.options.getString("reason") ?? "Deleted by staff";

    let buf;
    try {
      buf = await transcript.fromChannel(channel, ticket, interaction.guild);
    } catch {
      buf = transcript.fromDatabase(ticket, interaction.guild);
    }

    tdb.closeTicket(ticket.id, interaction.user.id);
    tdb.updateTicket(ticket.id, { status: "deleted" });

    const settings = tdb.getSettings(interaction.guild.id);
    await manager.logClose(
      interaction.guild,
      { ...ticket, status: "deleted" },
      buf,
      interaction.user,
      settings,
    );

    await interaction.editReply({
      content: "Ticket closed. Deleting channel in a moment...",
    });

    // Short delay so the user sees the confirmation before the channel disappears
    setTimeout(() => channel.delete(reason).catch(() => {}), 2000);
  },

  async _add(interaction, ticket, isStaff) {
    if (!isStaff) {
      return interaction.reply({
        content: "Only staff can add users to tickets.",
        ephemeral: true,
      });
    }
    if (!ticket) {
      return interaction.reply({
        content: "This channel is not a ticket.",
        ephemeral: true,
      });
    }

    const target = interaction.options.getMember("user");
    if (!target) {
      return interaction.reply({
        content: "User not found in this server.",
        ephemeral: true,
      });
    }

    const channel = interaction.channel;

    try {
      if (channel.type === ChannelType.GuildText) {
        await channel.permissionOverwrites.edit(target, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
      } else if (channel.isThread()) {
        await channel.members.add(target.id);
      }

      await channel.send({
        content: `${target} has been added to the ticket.`,
      });
      return interaction.reply({
        content: `${target} added.`,
        ephemeral: true,
      });
    } catch (err) {
      return interaction.reply({
        content: `Failed to add user: ${err.message}`,
        ephemeral: true,
      });
    }
  },

  async _remove(interaction, ticket, isStaff) {
    if (!isStaff) {
      return interaction.reply({
        content: "Only staff can remove users from tickets.",
        ephemeral: true,
      });
    }
    if (!ticket) {
      return interaction.reply({
        content: "This channel is not a ticket.",
        ephemeral: true,
      });
    }

    const target = interaction.options.getMember("user");
    if (!target) {
      return interaction.reply({
        content: "User not found in this server.",
        ephemeral: true,
      });
    }

    if (target.id === ticket.user_id) {
      return interaction.reply({
        content: "The ticket owner cannot be removed.",
        ephemeral: true,
      });
    }

    const channel = interaction.channel;

    try {
      if (channel.type === ChannelType.GuildText) {
        await channel.permissionOverwrites.edit(target, { ViewChannel: false });
      } else if (channel.isThread()) {
        await channel.members.remove(target.id);
      }

      await channel.send({
        content: `${target} has been removed from the ticket.`,
      });
      return interaction.reply({
        content: `${target} removed.`,
        ephemeral: true,
      });
    } catch (err) {
      return interaction.reply({
        content: `Failed to remove user: ${err.message}`,
        ephemeral: true,
      });
    }
  },

  async _rename(interaction, ticket, isStaff) {
    if (!isStaff) {
      return interaction.reply({
        content: "Only staff can rename tickets.",
        ephemeral: true,
      });
    }
    if (!ticket) {
      return interaction.reply({
        content: "This channel is not a ticket.",
        ephemeral: true,
      });
    }

    const name = interaction.options
      .getString("name")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-{2,}/g, "-")
      .slice(0, 100);

    try {
      await interaction.channel.setName(name);
      tdb.updateTicket(ticket.id, { ticket_name: name });
      return interaction.reply({
        content: `Ticket renamed to \`${name}\`.`,
        ephemeral: true,
      });
    } catch (err) {
      return interaction.reply({
        content: `Rename failed: ${err.message}`,
        ephemeral: true,
      });
    }
  },

  async _transcript(interaction) {
    const isStaff = manager.isStaff(interaction.member);
    const ticket = tdb.getTicketByChannel(interaction.channel.id);

    if (!ticket) {
      return interaction.reply({
        content: "This channel is not a ticket.",
        ephemeral: true,
      });
    }
    if (!isStaff && interaction.user.id !== ticket.user_id) {
      return interaction.reply({
        content: "Only staff or the ticket owner can generate a transcript.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const buf = await transcript.fromChannel(
        interaction.channel,
        ticket,
        interaction.guild,
      );
      const file = new AttachmentBuilder(buf, {
        name: `transcript-${ticket.ticket_name}-${ticket.ticket_number}.html`,
      });
      return interaction.editReply({
        content: `Transcript for ticket #${ticket.ticket_number}`,
        files: [file],
      });
    } catch (err) {
      return interaction.editReply({
        content: `Failed to generate transcript: ${err.message}`,
      });
    }
  },

  async _history(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const isStaff = manager.isStaff(interaction.member);
    const query = interaction.options.getString("query");
    const user = interaction.options.getUser("user");

    let tickets;

    if (!isStaff) {
      tickets = tdb.getTicketsByUser(interaction.guild.id, interaction.user.id);
    } else if (user) {
      tickets = tdb.getTicketsByUser(interaction.guild.id, user.id, 25);
    } else if (query) {
      tickets = tdb.searchTickets(interaction.guild.id, query);
    } else {
      tickets = tdb.getTicketsByUser(interaction.guild.id, interaction.user.id);
    }

    if (!tickets.length) {
      return interaction.editReply({ content: "No tickets found." });
    }

    const STATUS_LABEL = { open: "Open", closed: "Closed", deleted: "Deleted" };

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Ticket History")
      .setDescription(
        `${tickets.length} result(s)${user ? ` for ${user.tag}` : ""}`,
      )
      .setTimestamp();

    for (const t of tickets.slice(0, 10)) {
      const ch = t.channel_id || t.thread_id;
      embed.addFields({
        name: `#${t.ticket_number} — ${t.ticket_name}`,
        value: [
          `User: <@${t.user_id}>`,
          `Opened: <t:${t.opened_at}:R>`,
          `Status: ${STATUS_LABEL[t.status] ?? t.status}`,
          ch ? `Channel: ${ch}` : null,
          t.closed_by ? `Closed by: <@${t.closed_by}>` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        inline: true,
      });
    }

    if (tickets.length > 10) {
      embed.setFooter({ text: `Showing 10 of ${tickets.length} results` });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
