const { Events, ActivityType } = require('discord.js');
const automodDb = require('../utils/database');
const ScheduledTasks = require('../utils/scheduledTasks');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`[READY] Logged in as ${client.user.tag}`);
        console.log(`[READY] Serving ${client.guilds.cache.size} guild(s)`);

        client.user.setActivity('for rule violations', { type: ActivityType.Watching });

        // Start scheduled tasks (automod cleanup, etc.)
        new ScheduledTasks(client, automodDb);

        // Clean expired automod data every 5 minutes
        setInterval(() => {
            try {
                automodDb.cleanExpiredViolations();
                automodDb.cleanOldTracking();
            } catch (err) {
                console.error('[CLEANUP] Failed to clean expired data:', err);
            }
        }, 5 * 60 * 1000);
    },
};
