const db = require('./database');
const { PermissionsBitField } = require('discord.js');

class AutomodChecker {
    constructor() {
        // Known phishing domains (expand as needed)
        this.phishingDomains = [
            'discord-nitro.com',
            'discord-gift.com',
            'discordgift.site',
            'steamcommunity.ru',
            'steamcommunlty.com',
            'discordapp.ru'
        ];
    }

    // Check if message should be ignored based on permissions and settings
    async shouldIgnore(message, settings) {
        // Ignore bots
        if (message.author.bot) return true;

        // Ignore server owner
        if (message.guild.ownerId === message.author.id) return true;

        // Ignore admins
        if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;

        // Check ignored roles
        if (settings && settings.ignored_roles) {
            const hasIgnoredRole = message.member.roles.cache.some(role => 
                settings.ignored_roles.includes(role.id)
            );
            if (hasIgnoredRole) return true;
        }

        // Check ignored channels
        if (settings && settings.ignored_channels) {
            if (settings.ignored_channels.includes(message.channel.id)) return true;
        }

        return false;
    }

    // Check if target passes rule-specific filters
    checkRuleFilters(rule, message) {
        const filters = db.getFilters(rule.id);
        
        let affectedRoles = filters.filter(f => f.filter_type === 'affected' && f.target_type === 'role');
        let affectedChannels = filters.filter(f => f.filter_type === 'affected' && f.target_type === 'channel');
        let ignoredRoles = filters.filter(f => f.filter_type === 'ignored' && f.target_type === 'role');
        let ignoredChannels = filters.filter(f => f.filter_type === 'ignored' && f.target_type === 'channel');

        // If affected roles are specified, user must have one
        if (affectedRoles.length > 0) {
            const hasAffectedRole = message.member.roles.cache.some(role =>
                affectedRoles.some(f => f.target_id === role.id)
            );
            if (!hasAffectedRole) return false;
        }

        // If affected channels are specified, must be in one
        if (affectedChannels.length > 0) {
            const inAffectedChannel = affectedChannels.some(f => f.target_id === message.channel.id);
            if (!inAffectedChannel) return false;
        }

        // Check ignored roles
        if (ignoredRoles.length > 0) {
            const hasIgnoredRole = message.member.roles.cache.some(role =>
                ignoredRoles.some(f => f.target_id === role.id)
            );
            if (hasIgnoredRole) return false;
        }

        // Check ignored channels
        if (ignoredChannels.length > 0) {
            const inIgnoredChannel = ignoredChannels.some(f => f.target_id === message.channel.id);
            if (inIgnoredChannel) return false;
        }

        return true;
    }

    // Rule: All Caps
    checkAllCaps(content, threshold = 70) {
        if (content.length < 5) return false;
        const letters = content.replace(/[^a-zA-Z]/g, '');
        if (letters.length === 0) return false;
        const upperCount = content.replace(/[^A-Z]/g, '').length;
        const percentage = (upperCount / letters.length) * 100;
        return percentage >= threshold;
    }

    // Rule: Bad Words
    checkBadWords(content, guildId) {
        const badWords = db.getBadWords(guildId);
        const lowerContent = content.toLowerCase();
        
        for (const entry of badWords) {
            if (entry.match_type === 'exact') {
                const words = lowerContent.split(/\s+/);
                if (words.includes(entry.word)) return true;
            } else if (entry.match_type === 'wildcard') {
                const pattern = entry.word.replace(/\*/g, '.*');
                const regex = new RegExp(pattern, 'i');
                if (regex.test(content)) return true;
            } else { // contains
                if (lowerContent.includes(entry.word)) return true;
            }
        }
        return false;
    }

    // Rule: Chat Clearing Newlines
    checkNewlines(content, threshold = 10) {
        const newlineCount = (content.match(/\n/g) || []).length;
        return newlineCount >= threshold;
    }

    // Rule: Duplicate Text
    checkDuplicateText(content) {
        // Check for repeated characters (aaaaaaa)
        const charRepeat = /(.)\1{7,}/i;
        if (charRepeat.test(content)) return true;

        // Check for repeated words (word word word)
        const words = content.split(/\s+/);
        if (words.length >= 5) {
            for (let i = 0; i < words.length - 4; i++) {
                if (words[i] === words[i+1] && words[i] === words[i+2] && 
                    words[i] === words[i+3] && words[i] === words[i+4]) {
                    return true;
                }
            }
        }

        return false;
    }

    // Rule: Character Count
    checkCharacterCount(content, maxLength = 2000) {
        return content.length > maxLength;
    }

    // Rule: Emoji Spam
    checkEmojiSpam(content, threshold = 10) {
        // Unicode emoji
        const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
        const unicodeEmojis = (content.match(emojiRegex) || []).length;
        
        // Custom Discord emojis
        const customEmojis = (content.match(/<a?:\w+:\d+>/g) || []).length;
        
        return (unicodeEmojis + customEmojis) >= threshold;
    }

    // Rule: Fast Message Spam
    async checkFastMessageSpam(message, threshold = 5) {
        db.trackMessage(message.guild.id, message.author.id, message.channel.id, 'message');
        const recentMessages = db.getRecentMessages(message.guild.id, message.author.id, 'message', 5);
        
        // Count messages in this specific channel
        const channelMessages = recentMessages.filter(m => m.channel_id === message.channel.id);
        return channelMessages.length >= threshold;
    }

    // Rule: Image Spam
    async checkImageSpam(message, threshold = 3) {
        if (message.attachments.size === 0) return false;
        
        const hasImage = message.attachments.some(att => 
            att.contentType && att.contentType.startsWith('image/')
        );
        
        if (!hasImage) return false;

        // Check multiple images at once
        const imageCount = Array.from(message.attachments.values()).filter(att =>
            att.contentType && att.contentType.startsWith('image/')
        ).length;
        
        if (imageCount >= threshold) return true;

        // Check images within 10 seconds
        db.trackMessage(message.guild.id, message.author.id, message.channel.id, 'image');
        const recentImages = db.getRecentMessages(message.guild.id, message.author.id, 'image', 10);
        return recentImages.length >= threshold;
    }

    // Rule: Invite Links
    checkInviteLinks(content) {
        const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9]+/gi;
        return inviteRegex.test(content);
    }

    // Rule: Known Phishing Links
    checkPhishingLinks(content) {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const urls = content.match(urlRegex) || [];
        
        for (const url of urls) {
            try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname.toLowerCase();
                
                if (this.phishingDomains.some(phish => domain.includes(phish))) {
                    return true;
                }
            } catch (e) {
                // Invalid URL, skip
            }
        }
        return false;
    }

    // Rule: Links
    checkLinks(content, guildId, checkAllowlist = false) {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const urls = content.match(urlRegex) || [];
        
        if (urls.length === 0) return false;

        const blockedLinks = db.getBlockedLinks(guildId);
        const allowedLinks = db.getAllowedLinks(guildId);

        for (const url of urls) {
            try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname.toLowerCase();

                // Check blocked list
                if (blockedLinks.some(blocked => domain.includes(blocked))) {
                    return true;
                }

                // Check allowlist if enabled
                if (checkAllowlist && allowedLinks.length > 0) {
                    const isAllowed = allowedLinks.some(allowed => domain.includes(allowed));
                    if (!isAllowed) return true;
                }
            } catch (e) {
                // Invalid URL
            }
        }

        return false;
    }

    // Rule: Links Cooldown
    async checkLinksCooldown(message, threshold = 3, seconds = 30) {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const hasLink = urlRegex.test(message.content);
        
        if (!hasLink) return false;

        db.trackMessage(message.guild.id, message.author.id, message.channel.id, 'link');
        const recentLinks = db.getRecentMessages(message.guild.id, message.author.id, 'link', seconds);
        return recentLinks.length >= threshold;
    }

    // Rule: Mass Mentions
    checkMassMentions(message, threshold = 5) {
        const mentionCount = message.mentions.users.size + message.mentions.roles.size;
        return mentionCount >= threshold;
    }

    // Rule: Mentions Cooldown
    async checkMentionsCooldown(message, threshold = 5) {
        if (message.mentions.users.size === 0 && message.mentions.roles.size === 0) return false;

        db.trackMessage(message.guild.id, message.author.id, message.channel.id, 'mention');
        const recentMentions = db.getRecentMessages(message.guild.id, message.author.id, 'mention', 30);
        return recentMentions.length >= threshold;
    }

    // Rule: Spoilers
    checkSpoilers(message) {
        // Text spoilers ||text||
        if (message.content.includes('||')) return true;
        
        // Image spoilers
        if (message.attachments.some(att => att.spoiler)) return true;
        
        return false;
    }

    // Rule: Masked Links
    checkMaskedLinks(content) {
        const maskedLinkRegex = /\[.+?\]\(https?:\/\/.+?\)/gi;
        return maskedLinkRegex.test(content);
    }

    // Rule: Stickers
    checkStickers(message) {
        return message.stickers.size > 0;
    }

    // Rule: Sticker Cooldown
    async checkStickerCooldown(message, threshold = 3) {
        if (message.stickers.size === 0) return false;

        db.trackMessage(message.guild.id, message.author.id, message.channel.id, 'sticker');
        const recentStickers = db.getRecentMessages(message.guild.id, message.author.id, 'sticker', 60);
        return recentStickers.length >= threshold;
    }

    // Rule: Zalgo Text
    checkZalgo(content) {
        // Count combining characters
        const combiningChars = content.match(/[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g);
        if (!combiningChars) return false;
        
        // If more than 20% of characters are combining marks, it's likely zalgo
        const ratio = combiningChars.length / content.length;
        return ratio > 0.2 || combiningChars.length > 15;
    }

    // Main check function
    async checkMessage(message) {
        const settings = db.getSettings(message.guild.id);
        
        // Check if message should be ignored
        if (await this.shouldIgnore(message, settings)) return null;

        const rules = db.getRules(message.guild.id);
        
        for (const rule of rules) {
            if (!rule.enabled) continue;
            
            // Check rule-specific filters
            if (!this.checkRuleFilters(rule, message)) continue;

            let violated = false;
            let violationData = {};

            switch (rule.rule_type) {
                case 'all_caps':
                    violated = this.checkAllCaps(message.content, rule.threshold || 70);
                    break;
                case 'bad_words':
                    violated = this.checkBadWords(message.content, message.guild.id);
                    break;
                case 'newlines':
                    violated = this.checkNewlines(message.content, rule.threshold || 10);
                    break;
                case 'duplicate_text':
                    violated = this.checkDuplicateText(message.content);
                    break;
                case 'character_count':
                    violated = this.checkCharacterCount(message.content, rule.threshold || 2000);
                    break;
                case 'emoji_spam':
                    violated = this.checkEmojiSpam(message.content, rule.threshold || 10);
                    break;
                case 'fast_message_spam':
                    violated = await this.checkFastMessageSpam(message, rule.threshold || 5);
                    break;
                case 'image_spam':
                    violated = await this.checkImageSpam(message, rule.threshold || 3);
                    break;
                case 'invite_links':
                    violated = this.checkInviteLinks(message.content);
                    break;
                case 'phishing_links':
                    violated = this.checkPhishingLinks(message.content);
                    break;
                case 'links':
                    violated = this.checkLinks(message.content, message.guild.id, rule.threshold === 1);
                    break;
                case 'links_cooldown':
                    violated = await this.checkLinksCooldown(message, rule.threshold || 3, rule.threshold_seconds || 30);
                    break;
                case 'mass_mentions':
                    violated = this.checkMassMentions(message, rule.threshold || 5);
                    break;
                case 'mentions_cooldown':
                    violated = await this.checkMentionsCooldown(message, rule.threshold || 5);
                    break;
                case 'spoilers':
                    violated = this.checkSpoilers(message);
                    break;
                case 'masked_links':
                    violated = this.checkMaskedLinks(message.content);
                    break;
                case 'stickers':
                    violated = this.checkStickers(message);
                    break;
                case 'sticker_cooldown':
                    violated = await this.checkStickerCooldown(message, rule.threshold || 3);
                    break;
                case 'zalgo':
                    violated = this.checkZalgo(message.content);
                    break;
            }

            if (violated) {
                return { rule, violationData };
            }
        }

        return null;
    }
}

module.exports = new AutomodChecker();
