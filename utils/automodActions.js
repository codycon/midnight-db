const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('./database');

class AutomodActions {
    // Send warning message (auto-deletes after 5 seconds)
    async warn(message, rule) {
        try {
            const warningText = rule.custom_message || 
                `⚠️ ${message.author}, your message violated the ${this.formatRuleName(rule.rule_type)} rule.`;
            
            const warning = await message.channel.send(warningText);
            
            // Auto-delete after 5 seconds
            setTimeout(() => {
                warning.delete().catch(() => {});
            }, 5000);
        } catch (error) {
            console.error('[AUTOMOD] Error sending warning:', error);
        }
    }

    // Delete the message
    async deleteMessage(message) {
        try {
            if (message.deletable) {
                await message.delete();
                return true;
            }
        } catch (error) {
            console.error('[AUTOMOD] Error deleting message:', error);
        }
        return false;
    }

    // Mute user with timeout
    async muteUser(member, duration = 300) {
        try {
            if (!member.moderatable) return false;
            
            const durationMs = duration * 1000; // Convert to milliseconds
            await member.timeout(durationMs, 'Automod violation');
            return true;
        } catch (error) {
            console.error('[AUTOMOD] Error muting user:', error);
            return false;
        }
    }

    // Ban user
    async banUser(member, reason = 'Automod violation') {
        try {
            if (!member.bannable) return false;
            
            await member.ban({ reason, deleteMessageSeconds: 86400 }); // Delete 1 day of messages
            return true;
        } catch (error) {
            console.error('[AUTOMOD] Error banning user:', error);
            return false;
        }
    }

    // Log to channel
    async logViolation(message, rule, action, settings) {
        const logChannelId = rule.log_channel_id || settings?.default_log_channel;
        if (!logChannelId) return;

        try {
            const logChannel = await message.guild.channels.fetch(logChannelId);
            if (!logChannel || !logChannel.isTextBased()) return;

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🚨 Automod Violation')
                .setDescription(`**Rule:** ${this.formatRuleName(rule.rule_type)}\n**Action:** ${action}`)
                .addFields(
                    { name: 'User', value: `${message.author} (${message.author.tag})`, inline: true },
                    { name: 'Channel', value: `${message.channel}`, inline: true },
                    { name: 'Message', value: message.content ? message.content.substring(0, 1000) : '*[No content]*' }
                )
                .setTimestamp()
                .setFooter({ text: `User ID: ${message.author.id}` });

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[AUTOMOD] Error logging violation:', error);
        }
    }

    // Execute action based on rule configuration
    async executeAction(message, rule) {
        const settings = db.getSettings(message.guild.id);
        let actionTaken = 'None';

        try {
            switch (rule.action) {
                case 'warn':
                    await this.warn(message, rule);
                    actionTaken = 'Warned';
                    break;

                case 'delete':
                    const deleted = await this.deleteMessage(message);
                    actionTaken = deleted ? 'Deleted' : 'Delete Failed';
                    break;

                case 'warn_delete':
                    await this.warn(message, rule);
                    await this.deleteMessage(message);
                    actionTaken = 'Warned + Deleted';
                    break;

                case 'auto_mute':
                    // Add violation and check count
                    db.addViolation(message.guild.id, message.author.id, rule.rule_type);
                    const muteCount = db.getViolationCount(message.guild.id, message.author.id, rule.rule_type);
                    
                    await this.deleteMessage(message);
                    
                    if (muteCount >= (rule.violation_count || 3)) {
                        const muted = await this.muteUser(message.member, rule.mute_duration || 300);
                        actionTaken = muted ? `Deleted + Auto-Muted (${muteCount} violations)` : 'Deleted (Mute Failed)';
                    } else {
                        actionTaken = `Deleted (Violation ${muteCount}/${rule.violation_count || 3})`;
                    }
                    break;

                case 'auto_ban':
                    // Add violation and check count
                    db.addViolation(message.guild.id, message.author.id, rule.rule_type);
                    const banCount = db.getViolationCount(message.guild.id, message.author.id, rule.rule_type);
                    
                    await this.deleteMessage(message);
                    
                    if (banCount >= (rule.violation_count || 5)) {
                        const banned = await this.banUser(message.member, `Automod: ${this.formatRuleName(rule.rule_type)}`);
                        actionTaken = banned ? `Deleted + Auto-Banned (${banCount} violations)` : 'Deleted (Ban Failed)';
                    } else {
                        actionTaken = `Deleted (Violation ${banCount}/${rule.violation_count || 5})`;
                    }
                    break;

                case 'instant_mute':
                    await this.deleteMessage(message);
                    const instantMuted = await this.muteUser(message.member, rule.mute_duration || 300);
                    actionTaken = instantMuted ? 'Deleted + Muted' : 'Deleted (Mute Failed)';
                    break;

                case 'instant_ban':
                    await this.deleteMessage(message);
                    const instantBanned = await this.banUser(message.member, `Automod: ${this.formatRuleName(rule.rule_type)}`);
                    actionTaken = instantBanned ? 'Deleted + Banned' : 'Deleted (Ban Failed)';
                    break;
            }

            // Log the violation
            await this.logViolation(message, rule, actionTaken, settings);

            return actionTaken;
        } catch (error) {
            console.error('[AUTOMOD] Error executing action:', error);
            return 'Error';
        }
    }

    // Format rule name for display
    formatRuleName(ruleType) {
        return ruleType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}

module.exports = new AutomodActions();
