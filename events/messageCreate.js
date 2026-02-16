const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Track message history for spam detection
const messageHistory = new Map();

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore bots and DMs
        if (message.author.bot || !message.guild) return;
        
        // Ignore members with manage messages permission
        if (message.member.permissions.has('ManageMessages')) return;
        
        // Load automod config
        const dataDir = path.join(__dirname, '../data');
        const automodPath = path.join(dataDir, 'automod.json');
        
        if (!fs.existsSync(automodPath)) return;
        
        const automodConfig = JSON.parse(fs.readFileSync(automodPath, 'utf8'));
        const guildConfig = automodConfig[message.guild.id];
        
        if (!guildConfig || !guildConfig.enabled) return;
        
        let violation = null;
        let reason = '';
        
        // Bad words filter
        if (guildConfig.filters.badwords) {
            const content = message.content.toLowerCase();
            const foundWords = guildConfig.badwords.filter(word => {
                const regex = new RegExp(`\\b${word}\\b`, 'i');
                return regex.test(content);
            });
            
            if (foundWords.length > 0) {
                violation = 'badwords';
                reason = `Inappropriate language detected`;
            }
        }
        
        // Spam filter
        if (!violation && guildConfig.filters.spam) {
            const userId = message.author.id;
            const now = Date.now();
            
            if (!messageHistory.has(userId)) {
                messageHistory.set(userId, []);
            }
            
            const userMessages = messageHistory.get(userId);
            userMessages.push(now);
            
            // Remove messages older than 5 seconds
            const recentMessages = userMessages.filter(timestamp => now - timestamp < 5000);
            messageHistory.set(userId, recentMessages);
            
            if (recentMessages.length >= guildConfig.spamThreshold) {
                violation = 'spam';
                reason = `Spam detected: ${recentMessages.length} messages in 5 seconds`;
            }
        }
        
        // Link filter
        if (!violation && guildConfig.filters.links) {
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            if (urlRegex.test(message.content)) {
                violation = 'links';
                reason = 'Unauthorized link detected';
            }
        }
        
        // Mention spam filter
        if (!violation && guildConfig.filters.mentions) {
            const mentionCount = message.mentions.users.size + message.mentions.roles.size;
            if (mentionCount > guildConfig.mentionLimit) {
                violation = 'mentions';
                reason = `Excessive mentions: ${mentionCount} mentions`;
            }
        }
        
        // Take action if violation found
        if (violation) {
            try {
                // Delete the message
                await message.delete();
                
                // Load warnings data
                const warnsPath = path.join(dataDir, 'warnings.json');
                let warnings = {};
                if (fs.existsSync(warnsPath)) {
                    warnings = JSON.parse(fs.readFileSync(warnsPath, 'utf8'));
                }
                
                // Initialize guild and user warnings
                if (!warnings[message.guild.id]) {
                    warnings[message.guild.id] = {};
                }
                if (!warnings[message.guild.id][message.author.id]) {
                    warnings[message.guild.id][message.author.id] = [];
                }
                
                // Add automod warning
                const warning = {
                    reason: `Automod: ${reason}`,
                    moderator: 'Midnight Bot (Automod)',
                    moderatorId: message.client.user.id,
                    timestamp: Date.now()
                };
                
                warnings[message.guild.id][message.author.id].push(warning);
                fs.writeFileSync(warnsPath, JSON.stringify(warnings, null, 2));
                
                const warnCount = warnings[message.guild.id][message.author.id].length;
                
                // Progressive punishment - timeout at 3 warnings and reset
                let punishmentAction = null;
                
                if (warnCount >= 3) {
                    // 3 warnings = 1 day timeout + clear warnings
                    try {
                        const oneDayMs = 24 * 60 * 60 * 1000;
                        await message.member.timeout(oneDayMs, `Automod: 3 violations - ${reason}`);
                        
                        // Clear warnings after timeout
                        warnings[message.guild.id][message.author.id] = [];
                        fs.writeFileSync(warnsPath, JSON.stringify(warnings, null, 2));
                        
                        punishmentAction = 'timed out for 1 day (warnings cleared)';
                        
                        console.log(`[AUTOMOD] ${message.author.tag} timed out for 1 day, warnings reset`);
                    } catch (error) {
                        console.error(`[AUTOMOD] Failed to timeout ${message.author.tag}:`, error);
                    }
                }
                
                // Send warning to user
                const warningEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setTitle('Automod Warning')
                    .setDescription('Your message violated server automod rules and has been removed.')
                    .addFields(
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Total Warnings', value: `${warnCount}`, inline: true },
                        { name: 'Server', value: message.guild.name, inline: true }
                    )
                    .setFooter({ text: 'Midnight Bot • Automod' })
                    .setTimestamp();
                
                if (punishmentAction) {
                    warningEmbed.addFields({
                        name: 'Punishment',
                        value: `You have been ${punishmentAction}`,
                        inline: false
                    });
                } else if (warnCount === 2) {
                    warningEmbed.addFields({
                        name: 'Warning',
                        value: 'Next violation will result in a 1-day timeout',
                        inline: false
                    });
                }
                
                try {
                    await message.author.send({ embeds: [warningEmbed] });
                } catch (error) {
                    console.log(`Could not DM ${message.author.tag}`);
                }
                
                // Send notification in channel (auto-delete after 5 seconds)
                let notificationText = `${message.author}, your message was removed by automod. Warning ${warnCount}`;
                if (punishmentAction) {
                    notificationText = `${message.author} has been ${punishmentAction} for repeated automod violations.`;
                }
                
                const channelEmbed = new EmbedBuilder()
                    .setColor('#2D1B69')
                    .setDescription(notificationText)
                    .setFooter({ text: 'This message will be deleted in 5 seconds' });
                
                const notification = await message.channel.send({ embeds: [channelEmbed] });
                setTimeout(() => notification.delete().catch(() => {}), 5000);
                
                // Log the action
                console.log(`[AUTOMOD] ${violation} - ${message.author.tag}: ${reason} (Warning ${warnCount})`);
                
                // Log to logging channel if enabled
                const logsPath = path.join(dataDir, 'logs.json');
                if (fs.existsSync(logsPath)) {
                    const logsConfig = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
                    const logGuildConfig = logsConfig[message.guild.id];
                    
                    if (logGuildConfig && logGuildConfig.enabled && logGuildConfig.channelId) {
                        const logChannel = await message.guild.channels.fetch(logGuildConfig.channelId).catch(() => null);
                        
                        if (logChannel) {
                            const logFields = [
                                { name: 'User', value: `${message.author} (${message.author.tag})`, inline: true },
                                { name: 'Channel', value: `${message.channel}`, inline: true },
                                { name: 'Violation', value: violation, inline: true },
                                { name: 'Reason', value: reason, inline: false },
                                { name: 'Total Warnings', value: `${warnCount}`, inline: true }
                            ];
                            
                            if (punishmentAction) {
                                logFields.push({
                                    name: 'Action Taken',
                                    value: punishmentAction,
                                    inline: true
                                });
                            }
                            
                            logFields.push({
                                name: 'Content',
                                value: message.content.substring(0, 1000) || '*No text content*',
                                inline: false
                            });
                            
                            const logEmbed = new EmbedBuilder()
                                .setColor('#2D1B69')
                                .setTitle('Automod Action')
                                .setDescription('Message automatically removed')
                                .addFields(logFields)
                                .setFooter({ text: 'Midnight Bot • Automod' })
                                .setTimestamp();
                            
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    }
                }
                
            } catch (error) {
                console.error('[AUTOMOD] Error taking action:', error);
            }
        }
    },
};
