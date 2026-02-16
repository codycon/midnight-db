const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Midnight Bot online: ${client.user.tag}`);

        // Set bot rich presence
        client.user.setPresence({
            activities: [{
                type: ActivityType.Watching,
                name: 'midnight.institute'
            }],
            status: 'online'
        });
    },
};
