"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Per-command help definitions. Each entry becomes a page when the user
// passes the command name as the optional `command` argument.
const PAGES = {
  "automod-setup": {
    title: "/automod-setup",
    description: "Create a new automod rule.",
    fields: [
      {
        name: "Required Options",
        value:
          "`rule` — Type of rule to create\n`action` — What happens when the rule is triggered",
      },
      {
        name: "Optional Options",
        value:
          "`threshold` — Trigger value (meaning depends on the rule type)\n" +
          "`violations` — How many violations before an auto-action fires (default: 3 for mute, 5 for ban)\n" +
          "`mute-duration` — Timeout length in seconds (default: 300)\n" +
          "`log-channel` — Override the default log channel for this rule\n" +
          "`custom-message` — Custom text for warn messages",
      },
      {
        name: "Rule Types with Thresholds",
        value:
          "`all_caps` — % uppercase letters (default 70)\n" +
          "`newlines` — newline count (default 10)\n" +
          "`character_count` — max length (default 2000)\n" +
          "`emoji_spam` — emoji count (default 10)\n" +
          "`fast_message_spam` — messages in 5s (default 5)\n" +
          "`image_spam` — images in 10s (default 3)\n" +
          "`mass_mentions` — mentions per message (default 5)",
      },
      {
        name: "Examples",
        value:
          "`/automod-setup rule:all_caps action:warn_delete threshold:80`\n" +
          "`/automod-setup rule:fast_message_spam action:auto_mute violations:3`\n" +
          "`/automod-setup rule:phishing_links action:instant_ban`",
      },
    ],
  },
  "automod-filter": {
    title: "/automod-filter",
    description: "Scope a rule to specific roles or channels.",
    fields: [
      {
        name: "Subcommands",
        value: "`add` — Add a filter\n`list` — List filters for a rule",
      },
      {
        name: "Filter Types",
        value:
          "`affected` — Rule **only** applies to the specified role/channel\n" +
          "`ignored`  — Rule **never** applies to the specified role/channel",
      },
      {
        name: "Target Types",
        value: "`role` — Filter by role\n`channel` — Filter by channel",
      },
      {
        name: "Examples",
        value:
          "`/automod-filter add rule-id:1 filter-type:ignored target-type:role target-id:@Moderator`\n" +
          "`/automod-filter add rule-id:2 filter-type:affected target-type:channel target-id:#general`",
      },
      {
        name: "Tip",
        value:
          'Adding an "affected" filter restricts the rule to only that role/channel. ' +
          'Adding an "ignored" filter exempts that role/channel while the rule still applies everywhere else.',
      },
    ],
  },
  "automod-badwords": {
    title: "/automod-badwords",
    description: "Manage the list of filtered words and phrases.",
    fields: [
      {
        name: "Subcommands",
        value:
          "`add` — Add a word\n`remove` — Remove a word\n`list` — View all words",
      },
      {
        name: "Match Types",
        value:
          "`contains` — Triggers if the word appears anywhere in the message\n" +
          "`exact`    — Triggers only if the word is a standalone token\n" +
          "`wildcard` — Use `*` as a wildcard, e.g. `f*ck` matches `fck`, `f--k`, etc.",
      },
      {
        name: "Examples",
        value:
          "`/automod-badwords add word:spam match-type:contains`\n" +
          "`/automod-badwords add word:badword match-type:exact`\n" +
          "`/automod-badwords remove word:spam`",
      },
      {
        name: "Note",
        value:
          "A `bad_words` automod rule must be enabled for the word list to have any effect.",
      },
    ],
  },
  "automod-links": {
    title: "/automod-links",
    description: "Manage domain allowlists and blocklists.",
    fields: [
      {
        name: "Subcommands",
        value:
          "`allow` — Add a domain to the allowlist\n`block` — Add a domain to the blocklist\n`list` — View all configured domains",
      },
      {
        name: "How it Works",
        value:
          "**Blocklist** — Any URL whose hostname matches a blocked domain is flagged.\n" +
          "**Allowlist** — When the `links` rule is set to threshold 1 (allowlist mode), " +
          "any URL not on the allowlist is flagged.",
      },
      {
        name: "Examples",
        value:
          "`/automod-links allow domain:youtube.com`\n" +
          "`/automod-links block domain:scamsite.com`",
      },
    ],
  },
  "automod-settings": {
    title: "/automod-settings",
    description: "Configure global automod settings.",
    fields: [
      {
        name: "Subcommands",
        value:
          "`view` — Show current settings\n" +
          "`log-channel` — Set the default log channel for all rules\n" +
          "`ignore-role` — Add a globally ignored role\n" +
          "`ignore-channel` — Add a globally ignored channel",
      },
      {
        name: "Notes",
        value:
          "Per-rule log channels override the global setting.\n" +
          "Server owner and administrators are always exempt regardless of ignore settings.",
      },
    ],
  },
  "automod-list": {
    title: "/automod-list",
    description: "List all automod rules configured in this server.",
    fields: [
      {
        name: "Information Shown",
        value:
          "Rule ID (used in other commands)\n" +
          "Rule type and enabled/disabled status\n" +
          "Configured action\n" +
          "Threshold and violation count values",
      },
    ],
  },
  "automod-toggle": {
    title: "/automod-toggle",
    description: "Enable or disable an automod rule without deleting it.",
    fields: [
      {
        name: "Options",
        value:
          "`rule-id` — ID of the rule (from `/automod-list`)\n`enabled` — `true` to enable, `false` to disable",
      },
      {
        name: "Example",
        value: "`/automod-toggle rule-id:3 enabled:false`",
      },
    ],
  },
  "automod-remove": {
    title: "/automod-remove",
    description: "Permanently delete an automod rule.",
    fields: [
      {
        name: "Options",
        value: "`rule-id` — ID of the rule to delete (from `/automod-list`)",
      },
      {
        name: "Warning",
        value:
          "This is irreversible. All filters associated with the rule are also deleted.",
      },
    ],
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod-help")
    .setDescription("Get help with automod commands")
    .addStringOption((o) =>
      o
        .setName("command")
        .setDescription("Specific command to get help for")
        .addChoices(
          { name: "/automod-setup", value: "automod-setup" },
          { name: "/automod-filter", value: "automod-filter" },
          { name: "/automod-badwords", value: "automod-badwords" },
          { name: "/automod-links", value: "automod-links" },
          { name: "/automod-settings", value: "automod-settings" },
          { name: "/automod-list", value: "automod-list" },
          { name: "/automod-toggle", value: "automod-toggle" },
          { name: "/automod-remove", value: "automod-remove" },
        ),
    ),

  async execute(interaction) {
    const commandName = interaction.options.getString("command");

    if (commandName) {
      const page = PAGES[commandName];
      if (!page) {
        return interaction.reply({
          content: "Help page not found.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(page.title)
        .setDescription(page.description)
        .addFields(page.fields);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Overview
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Automod Help")
      .setDescription(
        "Use `/automod-help command:<name>` for detailed help on any command.",
      )
      .addFields(
        {
          name: "Setup & Management",
          value:
            "`/automod-setup` — Create a new rule\n" +
            "`/automod-list` — View all rules\n" +
            "`/automod-toggle` — Enable or disable a rule\n" +
            "`/automod-remove` — Delete a rule\n" +
            "`/automod-info` — System overview",
        },
        {
          name: "Configuration",
          value:
            "`/automod-filter` — Per-rule role and channel scoping\n" +
            "`/automod-settings` — Global settings\n" +
            "`/automod-badwords` — Manage the word filter list\n" +
            "`/automod-links` — Manage domain filters",
        },
        {
          name: "Quick Start",
          value:
            "`/automod-settings log-channel channel:#mod-logs`\n" +
            "`/automod-setup rule:all_caps action:warn_delete`\n" +
            "`/automod-setup rule:fast_message_spam action:auto_mute violations:3`",
        },
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
