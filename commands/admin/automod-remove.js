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
    .setName("automod-remove")
    .setDescription("Delete an automod rule permanently")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((o) =>
      o
        .setName("rule-id")
        .setDescription("Rule ID to delete (from /automod-list)")
        .setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const ruleId = interaction.options.getInteger("rule-id");

    try {
      const rule = db.getRuleById(ruleId);
      if (!rule || rule.guild_id !== interaction.guild.id) {
        return interaction.editReply({
          content: "Rule not found. Use `/automod-list` to see valid rule IDs.",
        });
      }

      db.deleteRule(ruleId);

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("Rule Deleted")
        .addFields({
          name: "Deleted Rule",
          value: `[${ruleId}] ${formatRuleName(rule.rule_type)}`,
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[AUTOMOD] Failed to delete rule:", err);
      await interaction.editReply({
        content: "Failed to delete the rule. Please try again.",
      });
    }
  },
};
