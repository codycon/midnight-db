"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const db = require("../../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod-badwords")
    .setDescription("Manage the filtered word list")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Add a word or phrase to the filter list")
        .addStringOption((o) =>
          o
            .setName("word")
            .setDescription("Word or phrase to block")
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("match-type")
            .setDescription("How to match the word")
            .setRequired(true)
            .addChoices(
              {
                name: "Contains  — matches anywhere in the message",
                value: "contains",
              },
              { name: "Exact     — must be a standalone word", value: "exact" },
              {
                name: "Wildcard  — use * as a wildcard character",
                value: "wildcard",
              },
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove a word from the filter list")
        .addStringOption((o) =>
          o.setName("word").setDescription("Word to remove").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName("list").setDescription("List all filtered words"),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();

    try {
      switch (sub) {
        case "add":
          return await this._add(interaction);
        case "remove":
          return await this._remove(interaction);
        case "list":
          return await this._list(interaction);
      }
    } catch (err) {
      console.error("[AUTOMOD] Error in automod-badwords:", err);
      await interaction.editReply({
        content: "Failed to manage the word list. Please try again.",
      });
    }
  },

  async _add(interaction) {
    const word = interaction.options.getString("word");
    const matchType = interaction.options.getString("match-type");

    db.addBadWord(interaction.guild.id, word, matchType);

    const embed = new EmbedBuilder()
      .setColor(0x23a55a)
      .setTitle("Word Added")
      .addFields(
        { name: "Word", value: `||${word}||`, inline: true },
        { name: "Match Type", value: matchType, inline: true },
      )
      .setFooter({
        text: "Ensure a bad_words automod rule is enabled for this to take effect.",
      });

    return interaction.editReply({ embeds: [embed] });
  },

  async _remove(interaction) {
    const word = interaction.options.getString("word");
    const result = db.removeBadWord(interaction.guild.id, word);

    if (!result.changes) {
      return interaction.editReply({
        content: `"${word}" was not found in the filter list.`,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("Word Removed")
      .setDescription(`||${word}|| has been removed from the filter list.`);

    return interaction.editReply({ embeds: [embed] });
  },

  async _list(interaction) {
    const words = db.getBadWords(interaction.guild.id);

    if (!words.length) {
      return interaction.editReply({
        content:
          "No words in the filter list. Use `/automod-badwords add` to add some.",
      });
    }

    const byType = { contains: [], exact: [], wildcard: [] };
    for (const entry of words) {
      byType[entry.match_type]?.push(`||${entry.word}||`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Filtered Words")
      .setDescription(`${words.length} word(s) in the list`);

    const truncate = (arr) => {
      const shown = arr.slice(0, 10).join(", ");
      return arr.length > 10 ? `${shown} (+${arr.length - 10} more)` : shown;
    };

    if (byType.contains.length)
      embed.addFields({ name: "Contains", value: truncate(byType.contains) });
    if (byType.exact.length)
      embed.addFields({ name: "Exact", value: truncate(byType.exact) });
    if (byType.wildcard.length)
      embed.addFields({ name: "Wildcard", value: truncate(byType.wildcard) });

    return interaction.editReply({ embeds: [embed] });
  },
};
