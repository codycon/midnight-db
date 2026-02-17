"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");
const tdb = require("../../utils/ticketDatabase");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-settings")
    .setDescription("Configure the ticket system")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s.setName("view").setDescription("Show current ticket settings"),
    )
    .addSubcommand((s) =>
      s
        .setName("log-open")
        .setDescription("Set the channel where opened tickets are logged")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Log channel").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("log-close")
        .setDescription(
          "Set the channel where closed tickets and transcripts are logged",
        )
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Log channel").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("category")
        .setDescription(
          "Set the default Discord category for new ticket channels",
        )
        .addChannelOption((o) =>
          o.setName("category").setDescription("Category").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("staff-role-add")
        .setDescription("Add a role that can manage all tickets")
        .addRoleOption((o) =>
          o.setName("role").setDescription("Role to add").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("staff-role-remove")
        .setDescription("Remove a staff role")
        .addRoleOption((o) =>
          o.setName("role").setDescription("Role to remove").setRequired(true),
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();

    try {
      switch (sub) {
        case "view":
          return await this._view(interaction);
        case "log-open":
          return await this._logOpen(interaction);
        case "log-close":
          return await this._logClose(interaction);
        case "category":
          return await this._setCategory(interaction);
        case "staff-role-add":
          return await this._addStaffRole(interaction);
        case "staff-role-remove":
          return await this._removeStaffRole(interaction);
      }
    } catch (err) {
      console.error("[TICKET-SETTINGS]", err);
      await interaction.editReply({
        content: `An error occurred: ${err.message}`,
      });
    }
  },

  async _view(interaction) {
    const settings = tdb.getSettings(interaction.guild.id);
    const staffRoles = tdb.getStaffRoles(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Ticket Settings")
      .addFields(
        {
          name: "Open Log",
          value: settings.log_open
            ? `<#${settings.log_open}>`
            : "Not configured",
          inline: true,
        },
        {
          name: "Close Log + Transcripts",
          value: settings.log_close
            ? `<#${settings.log_close}>`
            : "Not configured",
          inline: true,
        },
        {
          name: "Default Category",
          value: settings.default_cat
            ? `<#${settings.default_cat}>`
            : "None (channels created at root level)",
          inline: true,
        },
        {
          name: `Staff Roles (${staffRoles.length})`,
          value: staffRoles.length
            ? staffRoles.map((id) => `<@&${id}>`).join(", ")
            : "None — only Administrators have access",
          inline: false,
        },
        {
          name: "Total Tickets Opened",
          value: `${settings.ticket_counter ?? 0}`,
          inline: true,
        },
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },

  async _logOpen(interaction) {
    const channel = interaction.options.getChannel("channel");

    if (channel.type !== ChannelType.GuildText) {
      return interaction.editReply({
        content: "Please select a text channel.",
      });
    }

    tdb.upsertSettings(interaction.guild.id, { log_open: channel.id });
    return interaction.editReply({ content: `Open log set to ${channel}.` });
  },

  async _logClose(interaction) {
    const channel = interaction.options.getChannel("channel");

    if (channel.type !== ChannelType.GuildText) {
      return interaction.editReply({
        content: "Please select a text channel.",
      });
    }

    tdb.upsertSettings(interaction.guild.id, { log_close: channel.id });
    return interaction.editReply({
      content: `Close log (and transcripts) set to ${channel}.`,
    });
  },

  async _setCategory(interaction) {
    const category = interaction.options.getChannel("category");

    if (category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({
        content: "Please select a category channel.",
      });
    }

    tdb.upsertSettings(interaction.guild.id, { default_cat: category.id });
    return interaction.editReply({
      content: `Default category set to **${category.name}**.`,
    });
  },

  async _addStaffRole(interaction) {
    const role = interaction.options.getRole("role");
    tdb.addStaffRole(interaction.guild.id, role.id);
    return interaction.editReply({
      content: `${role} added as a staff role. Members with this role can manage all tickets.`,
    });
  },

  async _removeStaffRole(interaction) {
    const role = interaction.options.getRole("role");
    const result = tdb.removeStaffRole(interaction.guild.id, role.id);

    if (!result.changes) {
      return interaction.editReply({
        content: `${role} is not in the staff roles list.`,
      });
    }
    return interaction.editReply({
      content: `${role} removed from staff roles.`,
    });
  },
};
