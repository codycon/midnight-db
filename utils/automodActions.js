'use strict';

const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { formatRuleName } = require('./constants');

class AutomodActions {

    async executeAction(message, rule) {
        const settings    = db.getSettings(message.guild.id);
        let   actionTaken = 'None';

        try {
            switch (rule.action) {
                case 'warn': {
                    await this._warn(message, rule);
                    actionTaken = 'Warned';
                    break;
                }
                case 'delete': {
                    const deleted = await this._deleteMessage(message);
                    actionTaken = deleted ? 'Deleted' : 'Delete failed';
                    break;
                }
                case 'warn_delete': {
                    await this._warn(message, rule);
                    await this._deleteMessage(message);
                    actionTaken = 'Warned + Deleted';
                    break;
                }
                case 'auto_mute': {
                    db.addViolation(message.guild.id, message.author.id, rule.rule_type);
                    const muteCount  = db.getViolationCount(message.guild.id, message.author.id, rule.rule_type);
                    const muteTarget = rule.violation_count ?? 3;
                    await this._deleteMessage(message);
                    if (muteCount >= muteTarget) {
                        const ok = await this._muteUser(message.member, rule.mute_duration ?? 300);
                        actionTaken = ok ? `Auto-muted (${muteCount} violations)` : 'Mute failed';
                    } else {
                        actionTaken = `Violation ${muteCount}/${muteTarget}`;
                    }
                    break;
                }
                case 'auto_ban': {
                    db.addViolation(message.guild.id, message.author.id, rule.rule_type);
                    const banCount  = db.getViolationCount(message.guild.id, message.author.id, rule.rule_type);
                    const banTarget = rule.violation_count ?? 5;
                    await this._deleteMessage(message);
                    if (banCount >= banTarget) {
                        const ok = await this._banUser(message.member, `Automod: ${formatRuleName(rule.rule_type)}`);
                        actionTaken = ok ? `Auto-banned (${banCount} violations)` : 'Ban failed';
                    } else {
                        actionTaken = `Violation ${banCount}/${banTarget}`;
                    }
                    break;
                }
                case 'instant_mute': {
                    await this._deleteMessage(message);
                    const ok = await this._muteUser(message.member, rule.mute_duration ?? 300);
                    actionTaken = ok ? 'Deleted + Muted' : 'Deleted (mute failed)';
                    break;
                }
                case 'instant_ban': {
                    await this._deleteMessage(message);
                    const ok = await this._banUser(message.member, `Automod: ${formatRuleName(rule.rule_type)}`);
                    actionTaken = ok ? 'Deleted + Banned' : 'Deleted (ban failed)';
                    break;
                }
                default:
                    console.warn(`[AUTOMOD] Unknown action: ${rule.action}`);
            }

            await this._logViolation(message, rule, actionTaken, settings);
        } catch (err) {
            console.error('[AUTOMOD] Error executing action:', err);
        }

        return actionTaken;
    }

    // -------------------------------------------------------------------------

    /** Sends a warning message that auto-deletes after 5 seconds. */
    async _warn(message, rule) {
        try {
            const text = rule.custom_message
                ?? `${message.author}, your message violated the ${formatRuleName(rule.rule_type)} rule.`;
            const warning = await message.channel.send(text);
            setTimeout(() => warning.delete().catch(() => {}), 5000);
        } catch (err) {
            console.error('[AUTOMOD] Failed to send warning:', err);
        }
    }

    async _deleteMessage(message) {
        try {
            if (message.deletable) {
                await message.delete();
                return true;
            }
        } catch (err) {
            console.error('[AUTOMOD] Failed to delete message:', err);
        }
        return false;
    }

    async _muteUser(member, durationSeconds = 300) {
        try {
            if (!member.moderatable) return false;
            await member.timeout(durationSeconds * 1000, 'Automod violation');
            return true;
        } catch (err) {
            console.error('[AUTOMOD] Failed to mute user:', err);
            return false;
        }
    }

    async _banUser(member, reason = 'Automod violation') {
        try {
            if (!member.bannable) return false;
            await member.ban({ reason, deleteMessageSeconds: 86400 });
            return true;
        } catch (err) {
            console.error('[AUTOMOD] Failed to ban user:', err);
            return false;
        }
    }

    async _logViolation(message, rule, actionTaken, settings) {
        const logChannelId = rule.log_channel_id ?? settings?.default_log_channel;
        if (!logChannelId) return;

        try {
            const logChannel = await message.guild.channels.fetch(logChannelId);
            if (!logChannel?.isTextBased()) return;

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('Automod Violation')
                .setDescription(`**Rule:** ${formatRuleName(rule.rule_type)}\n**Action:** ${actionTaken}`)
                .addFields(
                    { name: 'User',    value: `${message.author} (${message.author.tag})`,              inline: true },
                    { name: 'Channel', value: `${message.channel}`,                                     inline: true },
                    { name: 'Message', value: message.content?.slice(0, 1000) || '*(no text content)*' }
                )
                .setTimestamp()
                .setFooter({ text: `User ID: ${message.author.id}` });

            await logChannel.send({ embeds: [embed] });
        } catch (err) {
            console.error('[AUTOMOD] Failed to log violation:', err);
        }
    }
}

module.exports = new AutomodActions();
