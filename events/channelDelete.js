const { Events } = require("discord.js");
const manager = require("../utils/ticketManager");

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!channel.guild) return;
    await manager.handleChannelDelete(channel);
  },
};
