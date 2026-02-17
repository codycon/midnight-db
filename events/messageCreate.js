const { Events } = require('discord.js');
const automodChecker = require('../utils/automodChecker');
const automodActions = require('../utils/automodActions');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore DMs
        if (!message.guild) return;

        try {
            // Check message against automod rules
            const violation = await automodChecker.checkMessage(message);
            
            if (violation) {
                const { rule } = violation;
                console.log(`[AUTOMOD] Violation detected: ${rule.rule_type} by ${message.author.tag}`);
                
                // Execute the configured action
                await automodActions.executeAction(message, rule);
            }
        } catch (error) {
            console.error('[AUTOMOD] Error checking message:', error);
        }
    }
};
