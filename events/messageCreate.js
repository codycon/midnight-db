const { Events } = require("discord.js");
const automodChecker = require("../utils/automodChecker");
const automodActions = require("../utils/automodActions");
const tdb = require("../utils/ticketDatabase");

/**
 * Handles two responsibilities in a single MessageCreate listener:
 *   1. Run automod checks on every guild message.
 *   2. Track messages inside open ticket channels/threads for transcript generation.
 *
 * Keeping both here avoids registering two separate listeners for the same event,
 * which makes the execution order explicit and easier to reason about.
 */
module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild) return;

    // Automod
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

    // Ticket message tracking (transcript fallback)
    // Skip bot messages; we still track even if automod deleted the content
    // because the DB write happens before any deletion.
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
