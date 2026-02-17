"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const tdb = require("../../utils/ticketDatabase");
const manager = require("../../utils/ticketManager");

/**
 * Parses a hex colour string (e.g. "5865F2" or "#5865F2") to an integer.
 * Returns blurple (0x5865F2) if the input is missing or not a valid hex value.
 */
function parseColour(str) {
  if (!str) return 0x5865f2;
  const n = parseInt(str.replace("#", "").trim(), 16);
  return isNaN(n) ? 0x5865f2 : n;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Manage ticket panels")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // -- Panel lifecycle --------------------------------------------------
    .addSubcommand((s) =>
      s
        .setName("create")
        .setDescription("Create a new ticket panel")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Internal name for this panel")
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("type")
            .setDescription("How users open tickets")
            .setRequired(true)
            .addChoices(
              { name: "Buttons", value: "buttons" },
              { name: "Select menu", value: "select" },
            ),
        )
        .addStringOption((o) =>
          o
            .setName("style")
            .setDescription(
              "Default ticket style (can be overridden per option)",
            )
            .addChoices(
              { name: "Channel (private text channel)", value: "channel" },
              { name: "Thread  (private thread)", value: "thread" },
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("post")
        .setDescription("Post a panel to a channel so members can open tickets")
        .addIntegerOption((o) =>
          o.setName("panel").setDescription("Panel ID").setRequired(true),
        )
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Channel to post in")
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName("list").setDescription("List all panels in this server"),
    )
    .addSubcommand((s) =>
      s
        .setName("delete")
        .setDescription("Delete a panel and its posted message")
        .addIntegerOption((o) =>
          o.setName("panel").setDescription("Panel ID").setRequired(true),
        ),
    )

    // -- Embeds -----------------------------------------------------------
    .addSubcommand((s) =>
      s
        .setName("embed-add")
        .setDescription("Add an embed to a panel (max 10)")
        .addIntegerOption((o) =>
          o.setName("panel").setDescription("Panel ID").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("title").setDescription("Embed title"),
        )
        .addStringOption((o) =>
          o
            .setName("description")
            .setDescription("Embed description (use \\n for line breaks)"),
        )
        .addStringOption((o) =>
          o.setName("color").setDescription("Hex colour, e.g. 5865F2"),
        )
        .addStringOption((o) =>
          o.setName("footer").setDescription("Footer text"),
        )
        .addStringOption((o) =>
          o.setName("image").setDescription("Full image URL"),
        )
        .addStringOption((o) =>
          o.setName("thumbnail").setDescription("Thumbnail URL"),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("embed-remove")
        .setDescription("Remove an embed from a panel")
        .addIntegerOption((o) =>
          o
            .setName("embed-id")
            .setDescription("Embed ID (from /panel list)")
            .setRequired(true),
        ),
    )

    // -- Options ----------------------------------------------------------
    .addSubcommand((s) =>
      s
        .setName("option-add")
        .setDescription("Add a button or select-menu option to a panel")
        .addIntegerOption((o) =>
          o.setName("panel").setDescription("Panel ID").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("label")
            .setDescription("Button or option label")
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("emoji")
            .setDescription("Emoji to display on the button or option"),
        )
        .addStringOption((o) =>
          o
            .setName("description")
            .setDescription("Short description shown in select menus"),
        )
        .addStringOption((o) =>
          o
            .setName("button-style")
            .setDescription(
              "Button colour (only applies to button-type panels)",
            )
            .addChoices(
              { name: "Primary  (blue)", value: "1" },
              { name: "Secondary (grey)", value: "2" },
              { name: "Success  (green)", value: "3" },
              { name: "Danger   (red)", value: "4" },
            ),
        )
        .addStringOption((o) =>
          o
            .setName("ticket-style")
            .setDescription(
              "Override the panel's default ticket style for this option only",
            )
            .addChoices(
              { name: "Channel", value: "channel" },
              { name: "Thread", value: "thread" },
            ),
        )
        .addStringOption((o) =>
          o
            .setName("label-format")
            .setDescription(
              "Channel name format. Tokens: {username} {number} {tag}",
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("option-config")
        .setDescription("Set roles and category for a panel option")
        .addIntegerOption((o) =>
          o
            .setName("option-id")
            .setDescription("Option ID (from /panel list)")
            .setRequired(true),
        )
        .addChannelOption((o) =>
          o
            .setName("category")
            .setDescription(
              "Discord category for tickets created by this option",
            ),
        )
        .addStringOption((o) =>
          o
            .setName("support-roles")
            .setDescription(
              "Comma-separated role IDs that can see these tickets",
            ),
        )
        .addStringOption((o) =>
          o
            .setName("required-roles")
            .setDescription(
              "Comma-separated role IDs required to open this ticket type",
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("option-remove")
        .setDescription("Remove an option from a panel")
        .addIntegerOption((o) =>
          o.setName("option-id").setDescription("Option ID").setRequired(true),
        ),
    )

    // -- Questions --------------------------------------------------------
    .addSubcommand((s) =>
      s
        .setName("question-add")
        .setDescription(
          "Add a modal question to a panel option (max 5 per option)",
        )
        .addIntegerOption((o) =>
          o.setName("option-id").setDescription("Option ID").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("label")
            .setDescription("Question text shown to the user")
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("style")
            .setDescription("Input type")
            .addChoices(
              { name: "Short     (single line)", value: "1" },
              { name: "Paragraph (multi-line)", value: "2" },
            ),
        )
        .addStringOption((o) =>
          o
            .setName("placeholder")
            .setDescription("Placeholder text inside the field"),
        )
        .addBooleanOption((o) =>
          o
            .setName("required")
            .setDescription("Whether the user must answer this question"),
        )
        .addIntegerOption((o) =>
          o.setName("min-length").setDescription("Minimum answer length"),
        )
        .addIntegerOption((o) =>
          o.setName("max-length").setDescription("Maximum answer length"),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("question-remove")
        .setDescription("Remove a question from an option")
        .addIntegerOption((o) =>
          o
            .setName("question-id")
            .setDescription("Question ID (from /panel list)")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();

    try {
      switch (sub) {
        case "create":
          return await this._create(interaction);
        case "post":
          return await this._post(interaction);
        case "list":
          return await this._list(interaction);
        case "delete":
          return await this._delete(interaction);
        case "embed-add":
          return await this._embedAdd(interaction);
        case "embed-remove":
          return await this._embedRemove(interaction);
        case "option-add":
          return await this._optionAdd(interaction);
        case "option-config":
          return await this._optionConfig(interaction);
        case "option-remove":
          return await this._optionRemove(interaction);
        case "question-add":
          return await this._questionAdd(interaction);
        case "question-remove":
          return await this._questionRemove(interaction);
      }
    } catch (err) {
      console.error("[PANEL]", err);
      await interaction.editReply({
        content: `An error occurred: ${err.message}`,
      });
    }
  },

  // -------------------------------------------------------------------------
  // Panel lifecycle
  // -------------------------------------------------------------------------

  async _create(interaction) {
    const name = interaction.options.getString("name");
    const type = interaction.options.getString("type");
    const style = interaction.options.getString("style") ?? "channel";

    const result = tdb.createPanel(interaction.guild.id, name, type, style);
    const panelId = result.lastInsertRowid;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Panel Created")
      .setDescription(`Panel **"${name}"** created (ID: \`${panelId}\`).`)
      .addFields({
        name: "Next Steps",
        value: [
          `\`/panel embed-add panel:${panelId}\` — add an embed`,
          `\`/panel option-add panel:${panelId} label:...\` — add a button or option`,
          `\`/panel post panel:${panelId} channel:#...\` — post the panel`,
        ].join("\n"),
      });

    return interaction.editReply({ embeds: [embed] });
  },

  async _post(interaction) {
    const panelId = interaction.options.getInteger("panel");
    const channel = interaction.options.getChannel("channel");
    const panel = tdb.getPanel(panelId);

    if (!panel || panel.guild_id !== interaction.guild.id) {
      return interaction.editReply({ content: "Panel not found." });
    }
    if (!panel.options?.length) {
      return interaction.editReply({
        content: "Add at least one option before posting the panel.",
      });
    }

    const payload = manager.buildPanelPayload(panel);
    const msg = await channel.send(payload);

    tdb.updatePanel(panelId, { message_id: msg.id, channel_id: channel.id });

    return interaction.editReply({ content: `Panel posted in ${channel}.` });
  },

  async _list(interaction) {
    const panels = tdb.getPanels(interaction.guild.id);

    if (!panels.length) {
      return interaction.editReply({
        content: "No panels yet. Use `/panel create` to get started.",
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Ticket Panels")
      .setDescription(`${panels.length} panel(s) configured`);

    for (const p of panels.slice(0, 10)) {
      const full = tdb.getPanel(p.id);
      const posted = p.channel_id ? `<#${p.channel_id}>` : "Not posted";

      const embedLines = full.embeds.map(
        (e) => `  [${e.id}] ${e.title ?? "(no title)"}`,
      );
      const optionLines = full.options.map(
        (o) =>
          `  [${o.id}] ${o.label}` +
          (o.questions.length ? ` (${o.questions.length} question(s))` : ""),
      );

      embed.addFields({
        name: `[${p.id}] ${p.name} — ${p.input_type} / ${p.ticket_style}`,
        value: [
          `Posted in: ${posted}`,
          embedLines.length ? `Embeds:\n${embedLines.join("\n")}` : "",
          optionLines.length
            ? `Options:\n${optionLines.join("\n")}`
            : "No options yet.",
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }

    return interaction.editReply({ embeds: [embed] });
  },

  async _delete(interaction) {
    const panelId = interaction.options.getInteger("panel");
    const panel = tdb.getPanel(panelId);

    if (!panel || panel.guild_id !== interaction.guild.id) {
      return interaction.editReply({ content: "Panel not found." });
    }

    if (panel.message_id && panel.channel_id) {
      const ch = interaction.guild.channels.cache.get(panel.channel_id);
      if (ch) {
        const msg = await ch.messages.fetch(panel.message_id).catch(() => null);
        await msg?.delete().catch(() => {});
      }
    }

    tdb.deletePanel(panelId);
    return interaction.editReply({
      content: `Panel **"${panel.name}"** deleted.`,
    });
  },

  // -------------------------------------------------------------------------
  // Embeds
  // -------------------------------------------------------------------------

  async _embedAdd(interaction) {
    const panelId = interaction.options.getInteger("panel");
    const panel = tdb.getPanel(panelId);

    if (!panel || panel.guild_id !== interaction.guild.id) {
      return interaction.editReply({ content: "Panel not found." });
    }
    if (panel.embeds.length >= 10) {
      return interaction.editReply({
        content: "Panels can have at most 10 embeds (Discord limit).",
      });
    }

    const desc = (interaction.options.getString("description") ?? "").replace(
      /\\n/g,
      "\n",
    );
    const result = tdb.addEmbed(panelId, {
      title: interaction.options.getString("title"),
      description: desc || null,
      color: parseColour(interaction.options.getString("color")),
      footer: interaction.options.getString("footer"),
      image_url: interaction.options.getString("image"),
      thumbnail: interaction.options.getString("thumbnail"),
    });

    return interaction.editReply({
      content: `Embed #${result.lastInsertRowid} added to panel **"${panel.name}"**.`,
    });
  },

  async _embedRemove(interaction) {
    const embedId = interaction.options.getInteger("embed-id");
    const result = tdb.deleteEmbed(embedId);

    if (!result.changes) {
      return interaction.editReply({ content: "Embed not found." });
    }
    return interaction.editReply({ content: `Embed #${embedId} removed.` });
  },

  // -------------------------------------------------------------------------
  // Options
  // -------------------------------------------------------------------------

  async _optionAdd(interaction) {
    const panelId = interaction.options.getInteger("panel");
    const panel = tdb.getPanel(panelId);

    if (!panel || panel.guild_id !== interaction.guild.id) {
      return interaction.editReply({ content: "Panel not found." });
    }
    if (panel.options.length >= 25) {
      return interaction.editReply({
        content: "Panels can have at most 25 options.",
      });
    }

    const result = tdb.addOption(panelId, {
      label: interaction.options.getString("label"),
      emoji: interaction.options.getString("emoji"),
      description: interaction.options.getString("description"),
      btn_style: Number(interaction.options.getString("button-style") ?? "1"),
      ticket_style: interaction.options.getString("ticket-style"),
      label_format: interaction.options.getString("label-format"),
    });
    const optionId = result.lastInsertRowid;

    return interaction.editReply({
      content: [
        `Option #${optionId} **"${interaction.options.getString("label")}"** added.`,
        `Use \`/panel option-config option-id:${optionId}\` to set roles and category.`,
        `Use \`/panel question-add option-id:${optionId}\` to add intake questions.`,
      ].join("\n"),
    });
  },

  async _optionConfig(interaction) {
    const optionId = interaction.options.getInteger("option-id");
    const category = interaction.options.getChannel("category");
    const supportRaw = interaction.options.getString("support-roles");
    const requiredRaw = interaction.options.getString("required-roles");

    const option = tdb.getOption(optionId);
    if (!option) {
      return interaction.editReply({ content: "Option not found." });
    }

    const updates = {};
    if (category) updates.category_id = category.id;
    if (supportRaw)
      updates.support_roles = supportRaw
        .split(/[\s,]+/)
        .filter(Boolean)
        .join(",");
    if (requiredRaw)
      updates.required_roles = requiredRaw
        .split(/[\s,]+/)
        .filter(Boolean)
        .join(",");

    if (!Object.keys(updates).length) {
      return interaction.editReply({
        content: "Nothing to update. Provide at least one option.",
      });
    }

    tdb.updateOption(optionId, updates);

    const lines = [];
    if (category) lines.push(`Category: ${category}`);
    if (supportRaw) lines.push(`Support roles updated.`);
    if (requiredRaw) lines.push(`Required roles updated.`);

    return interaction.editReply({
      content: `Option **"${option.label}"** updated.\n${lines.join("\n")}`,
    });
  },

  async _optionRemove(interaction) {
    const optionId = interaction.options.getInteger("option-id");
    const option = tdb.getOption(optionId);

    if (!option) {
      return interaction.editReply({ content: "Option not found." });
    }

    tdb.deleteOption(optionId);
    return interaction.editReply({
      content: `Option **"${option.label}"** removed.`,
    });
  },

  // -------------------------------------------------------------------------
  // Questions
  // -------------------------------------------------------------------------

  async _questionAdd(interaction) {
    const optionId = interaction.options.getInteger("option-id");
    const option = tdb.getOption(optionId);

    if (!option) {
      return interaction.editReply({ content: "Option not found." });
    }
    if (option.questions.length >= 5) {
      return interaction.editReply({
        content: "Options can have at most 5 questions (Discord modal limit).",
      });
    }

    const result = tdb.addQuestion(optionId, {
      label: interaction.options.getString("label"),
      placeholder: interaction.options.getString("placeholder"),
      required: interaction.options.getBoolean("required") ?? true,
      style: Number(interaction.options.getString("style") ?? "1"),
      min_length: interaction.options.getInteger("min-length") ?? 0,
      max_length: interaction.options.getInteger("max-length") ?? 1000,
    });

    return interaction.editReply({
      content: [
        `Question #${result.lastInsertRowid} added to option **"${option.label}"**.`,
        "Users will see a modal form when they open this ticket type.",
      ].join("\n"),
    });
  },

  async _questionRemove(interaction) {
    const questionId = interaction.options.getInteger("question-id");
    const result = tdb.deleteQuestion(questionId);

    if (!result.changes) {
      return interaction.editReply({ content: "Question not found." });
    }
    return interaction.editReply({
      content: `Question #${questionId} removed.`,
    });
  },
};
