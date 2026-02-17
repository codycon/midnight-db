const { Events, ActivityType } = require('discord.js');
const db = require('../utils/database');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`[READY] ${client.user.tag} is online!`);
        
        // Set bot status
        client.user.setActivity('for rule violations', { type: ActivityType.Watching });

        // Clean up expired data every 5 minutes
        setInterval(() => {
            try {
                db.cleanExpiredViolations();
                db.cleanOldTracking();
                console.log('[CLEANUP] Expired data cleaned');
            } catch (error) {
                console.error('[CLEANUP] Error cleaning data:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes
    }
};
