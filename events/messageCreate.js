const { Events } = require("discord.js");
const automodChecker = require("../utils/automodChecker");
const automodActions = require("../utils/automodActions");
const tdb = require("../utils/ticketDatabase");

/**
 * Handles two responsibilities in a single MessageCreate listener:
 *   1. Run automod checks on every guild message.
 *   2. Track messages inside open ticket channels/threads for transcript generation.
 *
 * This is the ONLY MessageCreate listener — ticketTracker.js was removed to prevent
 * duplicate message tracking in the database.
 */
module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild) return;

    // --- Automod ---
    if (!message.author.bot) {
      try {
        const violation = await automodChecker.checkMessage(message);
        if (violation) {
          console.log(
            `[AUTOMOD] ${violation.rule.rule_type} triggered by ${message.author.tag} in ${message.guild.name}`,
          );
          await automodActions.executeAction(message, violation.rule);
        }
      } catch (err) {
        console.error("[AUTOMOD] Error checking message:", err);
      }
    }

    // --- Ticket message tracking (transcript fallback) ---
    // Skip the bot's own messages to avoid polluting transcripts with system embeds
    // that are already captured by the opener message and close message.
    if (message.author.id === message.client.user.id) return;

    const ticket = tdb.getTicketByChannel(message.channel.id);
    if (!ticket || ticket.status !== "open") return;

    try {
      tdb.trackMessage(ticket.id, {
        id: message.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        authorBot: message.author.bot,
        content: message.content,
        attachments: message.attachments.map((a) => ({
          url: a.url,
          name: a.name,
          contentType: a.contentType,
        })),
        embeds: message.embeds.length,
        createdAt: Math.floor(message.createdTimestamp / 1000),
      });
    } catch (err) {
      console.error("[TICKET] Failed to track message:", err);
    }
  },
};
