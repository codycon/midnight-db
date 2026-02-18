"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const db = require("../../utils/database");
const { formatRuleName } = require("../../utils/constants");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod-filter")
    .setDescription("Manage per-rule affected/ignored role and channel filters")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Add a filter to a rule")
        .addIntegerOption((o) =>
          o
            .setName("rule-id")
            .setDescription("Rule ID (from /automod-list)")
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("filter-type")
            .setDescription(
              "Whether the filter is an allowlist or blocklist for this rule",
            )
            .setRequired(true)
            .addChoices(
              {
                name: "Affected — rule only applies to these",
                value: "affected",
              },
              {
                name: "Ignored  — rule never applies to these",
                value: "ignored",
              },
            ),
        )
        .addStringOption((o) =>
          o
            .setName("target-type")
            .setDescription("What you are filtering")
            .setRequired(true)
            .addChoices(
              { name: "Role", value: "role" },
              { name: "Channel", value: "channel" },
            ),
        )
        .addStringOption((o) =>
          o
            .setName("target-id")
            .setDescription("Role or channel ID (or mention)")
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("list")
        .setDescription("List all filters for a rule")
        .addIntegerOption((o) =>
          o
            .setName("rule-id")
            .setDescription("Rule ID (from /automod-list)")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();

    try {
      switch (sub) {
        case "add":
          return await this._add(interaction);
        case "list":
          return await this._list(interaction);
      }
    } catch (err) {
      console.error("[AUTOMOD] Error in automod-filter:", err);
      await interaction.editReply({
        content: "Failed to manage filters. Please try again.",
      });
    }
  },

  async _add(interaction) {
    const ruleId = interaction.options.getInteger("rule-id");
    const filterType = interaction.options.getString("filter-type");
    const targetType = interaction.options.getString("target-type");

    // Strip mention syntax so raw IDs and @mentions both work
    const targetId = interaction.options
      .getString("target-id")
      .replace(/[<@&#>]/g, "")
      .trim();

    const rule = db.getRuleById(ruleId);
    if (!rule || rule.guild_id !== interaction.guild.id) {
      return interaction.editReply({
        content: "Rule not found. Use `/automod-list` to see valid rule IDs.",
      });
    }

    // Check for duplicate before inserting
    const existing = db.db
      .prepare(
        `SELECT id FROM automod_filters
         WHERE rule_id = ? AND filter_type = ? AND target_type = ? AND target_id = ?`,
      )
      .get(ruleId, filterType, targetType, targetId);

    if (existing) {
      return interaction.editReply({
        content: "That filter already exists on this rule.",
      });
    }

    db.addFilter(ruleId, filterType, targetType, targetId);

    const embed = new EmbedBuilder()
      .setColor(0x23a55a)
      .setTitle("Filter Added")
      .addFields(
        {
          name: "Rule",
          value: `[${rule.id}] ${formatRuleName(rule.rule_type)}`,
        },
        {
          name: "Filter Type",
          value: filterType.charAt(0).toUpperCase() + filterType.slice(1),
          inline: true,
        },
        {
          name: "Target",
          value: targetType === "role" ? `<@&${targetId}>` : `<#${targetId}>`,
          inline: true,
        },
      );

    return interaction.editReply({ embeds: [embed] });
  },

  async _list(interaction) {
    const ruleId = interaction.options.getInteger("rule-id");

    const rule = db.getRuleById(ruleId);
    if (!rule || rule.guild_id !== interaction.guild.id) {
      return interaction.editReply({
        content: "Rule not found. Use `/automod-list` to see valid rule IDs.",
      });
    }

    const filters = db.getFilters(ruleId);

    if (!filters.length) {
      return interaction.editReply({
        content: `No filters configured for rule [${ruleId}] ${formatRuleName(rule.rule_type)}.`,
      });
    }

    const affectedRoles = filters.filter(
      (f) => f.filter_type === "affected" && f.target_type === "role",
    );
    const affectedChannels = filters.filter(
      (f) => f.filter_type === "affected" && f.target_type === "channel",
    );
    const ignoredRoles = filters.filter(
      (f) => f.filter_type === "ignored" && f.target_type === "role",
    );
    const ignoredChannels = filters.filter(
      (f) => f.filter_type === "ignored" && f.target_type === "channel",
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Filters for Rule #${ruleId}`)
      .setDescription(
        `**${formatRuleName(rule.rule_type)}** — ${filters.length} filter(s)`,
      );

    if (affectedRoles.length)
      embed.addFields({
        name: "Affected Roles",
        value: affectedRoles.map((f) => `<@&${f.target_id}>`).join(", "),
      });
    if (affectedChannels.length)
      embed.addFields({
        name: "Affected Channels",
        value: affectedChannels.map((f) => `<#${f.target_id}>`).join(", "),
      });
    if (ignoredRoles.length)
      embed.addFields({
        name: "Ignored Roles",
        value: ignoredRoles.map((f) => `<@&${f.target_id}>`).join(", "),
      });
    if (ignoredChannels.length)
      embed.addFields({
        name: "Ignored Channels",
        value: ignoredChannels.map((f) => `<#${f.target_id}>`).join(", "),
      });

    return interaction.editReply({ embeds: [embed] });
  },
};
