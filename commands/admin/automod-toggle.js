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
    .setName("automod-toggle")
    .setDescription("Enable or disable an automod rule")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((o) =>
      o
        .setName("rule-id")
        .setDescription("Rule ID (from /automod-list)")
        .setRequired(true),
    )
    .addBooleanOption((o) =>
      o
        .setName("enabled")
        .setDescription("Enable or disable the rule")
        .setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const ruleId = interaction.options.getInteger("rule-id");
    const enabled = interaction.options.getBoolean("enabled");

    try {
      // Query by ID directly rather than fetching all rules
      const rule = db.getRuleById(ruleId);
      if (!rule || rule.guild_id !== interaction.guild.id) {
        return interaction.editReply({
          content: "Rule not found. Use `/automod-list` to see valid rule IDs.",
        });
      }

      db.updateRule(ruleId, { enabled });

      const embed = new EmbedBuilder()
        .setColor(enabled ? 0x23a55a : 0xed4245)
        .setTitle(enabled ? "Rule Enabled" : "Rule Disabled")
        .addFields(
          { name: "Rule", value: formatRuleName(rule.rule_type), inline: true },
          {
            name: "Status",
            value: enabled ? "Active" : "Inactive",
            inline: true,
          },
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[AUTOMOD] Failed to toggle rule:", err);
      await interaction.editReply({
        content: "Failed to update the rule. Please try again.",
      });
    }
  },
};
