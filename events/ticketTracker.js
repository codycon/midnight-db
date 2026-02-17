const { Events, ChannelType } = require("discord.js");
const tdb = require("../utils/ticketDatabase");

/**
 * Tracks every message sent in a ticket channel/thread to the DB.
 * This is the fallback data source if the channel is deleted before /ticket close.
 */
module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Only guild messages, not from this bot itself
    if (!message.guild || message.author.id === message.client.user.id) return;

    // Only track channels that are active tickets
    const ticket = tdb.getTicketByChannel(message.channel.id);
    if (!ticket || ticket.status !== "open") return;

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
  },
};
