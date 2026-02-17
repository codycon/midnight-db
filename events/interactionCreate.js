const {
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const tdb = require("../utils/ticketDatabase");
const manager = require("../utils/ticketManager");
const { CUSTOM_IDS } = require("../utils/constants");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand())
      return handleSlashCommand(interaction);
    if (interaction.isButton()) return handleButton(interaction);
    if (interaction.isStringSelectMenu()) return handleSelectMenu(interaction);
    if (interaction.isModalSubmit()) return handleModalSubmit(interaction);
  },
};

// ---------------------------------------------------------------------------

async function handleSlashCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`[COMMANDS] Unknown command: ${interaction.commandName}`);
    return;
  }
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[COMMANDS] Error in /${interaction.commandName}:`, err);
    const payload = {
      content: "An error occurred while running that command.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
}

async function handleButton(interaction) {
  const { customId } = interaction;

  if (customId.startsWith(CUSTOM_IDS.TICKET_OPEN)) {
    const [, panelId, optionId] = customId.split(":");
    const panel = tdb.getPanel(Number(panelId));
    const option =
      panel?.options?.find((o) => o.id === Number(optionId)) ?? null;

    if (!panel) {
      return interaction.reply({
        content: "This panel no longer exists.",
        ephemeral: true,
      });
    }
    if (option?.questions?.length) {
      return showTicketModal(interaction, panel, option);
    }
    return manager.createTicket(interaction, panel, option, {});
  }

  if (customId.startsWith(CUSTOM_IDS.TICKET_CLOSE)) {
    const ticketId = Number(customId.split(":")[1]);
    return manager.closeTicket(interaction, ticketId, false);
  }

  if (customId.startsWith(CUSTOM_IDS.TICKET_CLOSE_CONFIRM)) {
    const ticketId = Number(customId.split(":")[1]);
    return manager.closeTicket(interaction, ticketId, true);
  }

  if (customId === CUSTOM_IDS.TICKET_CLOSE_CANCEL) {
    return interaction.update({ content: "Close cancelled.", components: [] });
  }

  if (customId.startsWith(CUSTOM_IDS.TICKET_STAFF_THREAD)) {
    const ticketId = Number(customId.split(":")[1]);
    return manager.createStaffThread(interaction, ticketId);
  }
}

async function handleSelectMenu(interaction) {
  if (!interaction.customId.startsWith(CUSTOM_IDS.TICKET_SELECT)) return;

  const panelId = Number(interaction.customId.split(":")[1]);
  const optionId = Number(interaction.values[0]);
  const panel = tdb.getPanel(panelId);
  const option = panel?.options?.find((o) => o.id === optionId) ?? null;

  if (!panel) {
    return interaction.reply({
      content: "This panel no longer exists.",
      ephemeral: true,
    });
  }
  if (option?.questions?.length) {
    return showTicketModal(interaction, panel, option);
  }
  return manager.createTicket(interaction, panel, option, {});
}

async function handleModalSubmit(interaction) {
  if (!interaction.customId.startsWith(CUSTOM_IDS.TICKET_MODAL)) return;

  const [, panelId, optionId] = interaction.customId.split(":");
  const panel = tdb.getPanel(Number(panelId));
  const option = panel?.options?.find((o) => o.id === Number(optionId)) ?? null;

  if (!panel) {
    return interaction.reply({
      content: "This panel no longer exists.",
      ephemeral: true,
    });
  }

  const answers = {};
  for (const q of option?.questions ?? []) {
    answers[q.label] = interaction.fields.getTextInputValue(`q_${q.id}`);
  }

  return manager.createTicket(interaction, panel, option, answers);
}

// ---------------------------------------------------------------------------

function showTicketModal(interaction, panel, option) {
  const modal = new ModalBuilder()
    .setCustomId(`${CUSTOM_IDS.TICKET_MODAL}:${panel.id}:${option.id}`)
    .setTitle(option.label.slice(0, 45));

  for (const q of option.questions.slice(0, 5)) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`q_${q.id}`)
          .setLabel(q.label.slice(0, 45))
          .setStyle(
            q.style === 2 ? TextInputStyle.Paragraph : TextInputStyle.Short,
          )
          .setRequired(q.required === 1)
          .setMinLength(q.min_length || 0)
          .setMaxLength(Math.min(q.max_length || 1000, 4000))
          .setPlaceholder(q.placeholder?.slice(0, 100) || ""),
      ),
    );
  }

  return interaction.showModal(modal);
}
