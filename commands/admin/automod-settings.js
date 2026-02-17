"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");
const db = require("../../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod-settings")
    .setDescription("Configure global automod settings")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s.setName("view").setDescription("View current automod settings"),
    )
    .addSubcommand((s) =>
      s
        .setName("log-channel")
        .setDescription("Set the default log channel for all rules")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Channel to log violations in")
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("ignore-role")
        .setDescription("Add a role that bypasses all automod rules")
        .addRoleOption((o) =>
          o.setName("role").setDescription("Role to ignore").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("ignore-channel")
        .setDescription("Add a channel that bypasses all automod rules")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Channel to ignore")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();

    try {
      switch (sub) {
        case "view":
          return await this._view(interaction);
        case "log-channel":
          return await this._setLogChannel(interaction);
        case "ignore-role":
          return await this._addIgnoredRole(interaction);
        case "ignore-channel":
          return await this._addIgnoredChannel(interaction);
      }
    } catch (err) {
      console.error("[AUTOMOD] Error in automod-settings:", err);
      await interaction.editReply({
        content: "Failed to update settings. Please try again.",
      });
    }
  },

  async _view(interaction) {
    const settings = db.getSettings(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Automod Settings");

    if (!settings) {
      embed.setDescription(
        "No settings configured. Use the other subcommands to get started.",
      );
    } else {
      if (settings.default_log_channel) {
        embed.addFields({
          name: "Default Log Channel",
          value: `<#${settings.default_log_channel}>`,
        });
      }
      if (settings.ignored_roles.length) {
        embed.addFields({
          name: `Ignored Roles (${settings.ignored_roles.length})`,
          value: settings.ignored_roles.map((id) => `<@&${id}>`).join(", "),
        });
      }
      if (settings.ignored_channels.length) {
        embed.addFields({
          name: `Ignored Channels (${settings.ignored_channels.length})`,
          value: settings.ignored_channels.map((id) => `<#${id}>`).join(", "),
        });
      }
      embed.addFields({
        name: "Always Ignored",
        value:
          "Server owner and all administrators are always exempt from automod.",
      });
    }

    return interaction.editReply({ embeds: [embed] });
  },

  async _setLogChannel(interaction) {
    const channel = interaction.options.getChannel("channel");

    if (!channel.isTextBased()) {
      return interaction.editReply({
        content: "Please select a text channel.",
      });
    }

    // Read existing settings so ignored roles/channels are preserved
    const current = db.getSettings(interaction.guild.id);
    db.updateSettings(interaction.guild.id, {
      defaultLogChannel: channel.id,
      ignoredRoles: current?.ignored_roles ?? [],
      ignoredChannels: current?.ignored_channels ?? [],
    });

    const embed = new EmbedBuilder()
      .setColor(0x23a55a)
      .setTitle("Log Channel Updated")
      .setDescription(`Violations will now be logged in ${channel}.`)
      .addFields({
        name: "Note",
        value: "Individual rules can override this with their own log channel.",
      });

    return interaction.editReply({ embeds: [embed] });
  },

  async _addIgnoredRole(interaction) {
    const role = interaction.options.getRole("role");
    const current = db.getSettings(interaction.guild.id);

    const ignoredRoles = current?.ignored_roles ?? [];

    if (ignoredRoles.includes(role.id)) {
      return interaction.editReply({
        content: `${role} is already in the ignore list.`,
      });
    }

    db.updateSettings(interaction.guild.id, {
      defaultLogChannel: current?.default_log_channel ?? null,
      ignoredRoles: [...ignoredRoles, role.id],
      ignoredChannels: current?.ignored_channels ?? [],
    });

    const embed = new EmbedBuilder()
      .setColor(0x23a55a)
      .setTitle("Role Added to Ignore List")
      .setDescription(`Members with ${role} will bypass all automod rules.`)
      .addFields({
        name: "Note",
        value:
          "Server owner and administrators are always exempt regardless of this setting.",
      });

    return interaction.editReply({ embeds: [embed] });
  },

  async _addIgnoredChannel(interaction) {
    const channel = interaction.options.getChannel("channel");
    const current = db.getSettings(interaction.guild.id);

    const ignoredChannels = current?.ignored_channels ?? [];

    if (ignoredChannels.includes(channel.id)) {
      return interaction.editReply({
        content: `${channel} is already in the ignore list.`,
      });
    }

    db.updateSettings(interaction.guild.id, {
      defaultLogChannel: current?.default_log_channel ?? null,
      ignoredRoles: current?.ignored_roles ?? [],
      ignoredChannels: [...ignoredChannels, channel.id],
    });

    const embed = new EmbedBuilder()
      .setColor(0x23a55a)
      .setTitle("Channel Added to Ignore List")
      .setDescription(`Messages in ${channel} will bypass all automod rules.`);

    return interaction.editReply({ embeds: [embed] });
  },
};
