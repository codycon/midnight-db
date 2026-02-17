"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");
const tdb = require("../../utils/ticketDatabase");
const manager = require("../../utils/ticketManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("thread")
    .setDescription(
      "Create a private staff-only discussion thread inside the current ticket",
    )
    .addStringOption((o) =>
      o
        .setName("topic")
        .setDescription("Optional topic or note for the thread"),
    ),

  async execute(interaction) {
    if (!manager.isStaff(interaction.member)) {
      return interaction.reply({
        content: "Only staff members can create staff threads.",
        ephemeral: true,
      });
    }

    const ticket = tdb.getTicketByChannel(interaction.channel.id);
    if (!ticket || ticket.status !== "open") {
      return interaction.reply({
        content: "This command can only be used inside an open ticket channel.",
        ephemeral: true,
      });
    }

    if (interaction.channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content:
          "Staff threads can only be created inside channel-style tickets.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const topic = interaction.options.getString("topic");

    try {
      const thread = await interaction.channel.threads.create({
        name: `staff-${ticket.ticket_name}`.slice(0, 100),
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Staff thread for ticket #${ticket.ticket_number} by ${interaction.user.tag}`,
      });

      // Add all cached members that hold a staff role
      const staffRoles = tdb.getStaffRoles(interaction.guild.id);
      const added = new Set([interaction.user.id]);

      for (const roleId of staffRoles) {
        for (const [memberId, member] of interaction.guild.members.cache) {
          if (member.roles.cache.has(roleId) && !added.has(memberId)) {
            await thread.members.add(memberId).catch(() => {});
            added.add(memberId);
          }
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Staff Discussion Thread")
        .setDescription(
          `Private coordination thread for **Ticket #${ticket.ticket_number}**.\n` +
            `Ticket owner: <@${ticket.user_id}>\n` +
            `Created by: ${interaction.user}\n` +
            "This thread is only visible to staff." +
            (topic ? `\n\nTopic: ${topic}` : ""),
        )
        .setTimestamp();

      await thread.send({ embeds: [embed] });

      return interaction.editReply({
        content: `Staff thread created: ${thread}`,
      });
    } catch (err) {
      console.error("[THREAD]", err);
      return interaction.editReply({
        content: `Failed to create staff thread: ${err.message}`,
      });
    }
  },
};
