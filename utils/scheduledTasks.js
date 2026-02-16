const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

class ScheduledTasks {
    constructor(client) {
        this.client = client;
        this.dataDir = path.join(__dirname, '../data');
        
        // Run daily at midnight
        this.startDailyCheck();
    }
    
    startDailyCheck() {
        // Check every hour for simplicity
        setInterval(() => {
            this.checkMonthlyReset();
            this.checkSuggestionCleanup();
        }, 60 * 60 * 1000); // Every hour
        
        // Run immediately on startup
        setTimeout(() => {
            this.checkMonthlyReset();
            this.checkSuggestionCleanup();
        }, 5000); // 5 seconds after startup
    }
    
    async checkMonthlyReset() {
        const now = new Date();
        
        // Check if it's the 1st of the month
        if (now.getDate() !== 1) return;
        
        // Check if we already ran today
        const resetPath = path.join(this.dataDir, 'last-reset.json');
        let lastReset = {};
        
        if (fs.existsSync(resetPath)) {
            lastReset = JSON.parse(fs.readFileSync(resetPath, 'utf8'));
        }
        
        const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
        
        if (lastReset.lastWarningReset === currentMonth) {
            return; // Already reset this month
        }
        
        console.log('[SCHEDULED] Running monthly warning reset...');
        
        // Load warnings
        const warnsPath = path.join(this.dataDir, 'warnings.json');
        
        if (!fs.existsSync(warnsPath)) return;
        
        let warnings = JSON.parse(fs.readFileSync(warnsPath, 'utf8'));
        
        // Track users who had warnings
        const usersWithWarnings = [];
        
        for (const guildId in warnings) {
            const guild = await this.client.guilds.fetch(guildId).catch(() => null);
            if (!guild) continue;
            
            for (const userId in warnings[guildId]) {
                const userWarnings = warnings[guildId][userId];
                
                if (userWarnings.length > 0) {
                    usersWithWarnings.push({
                        guildId: guildId,
                        guildName: guild.name,
                        userId: userId,
                        warningCount: userWarnings.length
                    });
                    
                    // Clear warnings
                    warnings[guildId][userId] = [];
                }
            }
        }
        
        // Save cleared warnings
        fs.writeFileSync(warnsPath, JSON.stringify(warnings, null, 2));
        
        // DM users who had warnings
        for (const userData of usersWithWarnings) {
            try {
                const user = await this.client.users.fetch(userData.userId);
                
                const resetEmbed = new EmbedBuilder()
                    .setColor('#6C5CE7')
                    .setTitle('Monthly Warning Reset')
                    .setDescription('Your warnings have been cleared for the new month.')
                    .addFields(
                        { name: 'Server', value: userData.guildName, inline: true },
                        { name: 'Warnings Cleared', value: `${userData.warningCount}`, inline: true },
                        { name: 'Fresh Start', value: 'You now have 0 warnings', inline: false }
                    )
                    .setFooter({ text: 'Midnight Bot • Monthly Reset' })
                    .setTimestamp();
                
                await user.send({ embeds: [resetEmbed] });
                console.log(`[RESET] Notified ${user.tag} - ${userData.warningCount} warnings cleared`);
            } catch (error) {
                console.log(`[RESET] Could not DM user ${userData.userId}`);
            }
        }
        
        // Mark as reset
        lastReset.lastWarningReset = currentMonth;
        fs.writeFileSync(resetPath, JSON.stringify(lastReset, null, 2));
        
        console.log(`[SCHEDULED] Monthly reset complete. ${usersWithWarnings.length} users notified.`);
    }
    
    async checkSuggestionCleanup() {
        const now = Date.now();
        const fourteenDays = 14 * 24 * 60 * 60 * 1000;
        
        // Check if we should run cleanup (once per day)
        const resetPath = path.join(this.dataDir, 'last-reset.json');
        let lastReset = {};
        
        if (fs.existsSync(resetPath)) {
            lastReset = JSON.parse(fs.readFileSync(resetPath, 'utf8'));
        }
        
        const today = new Date().toDateString();
        
        if (lastReset.lastSuggestionCleanup === today) {
            return; // Already cleaned up today
        }
        
        console.log('[SCHEDULED] Running suggestion cleanup...');
        
        // Load suggestions
        const suggestionsPath = path.join(this.dataDir, 'suggestions.json');
        
        if (!fs.existsSync(suggestionsPath)) return;
        
        let suggestionsConfig = JSON.parse(fs.readFileSync(suggestionsPath, 'utf8'));
        let totalDeleted = 0;
        
        for (const guildId in suggestionsConfig) {
            const guildConfig = suggestionsConfig[guildId];
            
            if (!guildConfig.suggestions) continue;
            
            const oldCount = guildConfig.suggestions.length;
            
            // Filter out suggestions older than 14 days with status pending
            guildConfig.suggestions = guildConfig.suggestions.filter(s => {
                const age = now - s.timestamp;
                
                // Only delete pending suggestions older than 14 days
                if (s.status === 'pending' && age > fourteenDays) {
                    totalDeleted++;
                    
                    // Try to delete the message
                    this.client.guilds.fetch(guildId).then(guild => {
                        guild.channels.fetch(s.channelId).then(channel => {
                            channel.messages.fetch(s.messageId).then(msg => {
                                msg.delete().catch(() => {});
                            }).catch(() => {});
                        }).catch(() => {});
                    }).catch(() => {});
                    
                    return false; // Remove from array
                }
                
                return true; // Keep
            });
            
            const deletedCount = oldCount - guildConfig.suggestions.length;
            
            if (deletedCount > 0) {
                console.log(`[CLEANUP] Deleted ${deletedCount} old suggestions from guild ${guildId}`);
            }
        }
        
        // Save updated suggestions
        fs.writeFileSync(suggestionsPath, JSON.stringify(suggestionsConfig, null, 2));
        
        // Mark as cleaned up
        lastReset.lastSuggestionCleanup = today;
        fs.writeFileSync(resetPath, JSON.stringify(lastReset, null, 2));
        
        if (totalDeleted > 0) {
            console.log(`[SCHEDULED] Suggestion cleanup complete. ${totalDeleted} pending suggestions deleted.`);
        }
    }
}

module.exports = ScheduledTasks;
