"use strict";

const { PermissionFlagsBits } = require("discord.js");
const db = require("./database");

// Known phishing domains. Extend this list as new domains are identified.
const PHISHING_DOMAINS = [
  "discord-nitro.com",
  "discord-gift.com",
  "discordgift.site",
  "steamcommunity.ru",
  "steamcommunlty.com",
  "discordapp.ru",
];

// Default thresholds used when a rule has no threshold stored.
const DEFAULTS = {
  all_caps: 70, // % of uppercase letters
  newlines: 10, // number of newlines
  character_count: 2000, // total character count
  emoji_spam: 10, // emoji count
  fast_message_spam: 5, // messages per 5 seconds
  image_spam: 3, // images per 10 seconds
  mass_mentions: 5, // mentions in a single message
  mentions_cooldown: 5, // total mentions within 30 seconds
  links_cooldown: 3, // links within 30 seconds
  sticker_cooldown: 3, // stickers within 60 seconds
};

class AutomodChecker {
  /**
   * Checks a message against all enabled guild automod rules.
   * Returns the first violation found, or null if the message is clean.
   *
   * @param {import('discord.js').Message} message
   * @returns {Promise<{ rule: object } | null>}
   */
  async checkMessage(message) {
    // member can be null in rare edge cases (uncached, partial, etc.)
    if (!message.member) return null;

    const settings = db.getSettings(message.guild.id);

    if (this._shouldIgnore(message, settings)) return null;

    const rules = db.getRules(message.guild.id);

    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (!this._passesRuleFilters(rule, message)) continue;

      const triggered = await this._evaluateRule(rule, message);
      if (triggered) return { rule };
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Permission / filter checks
  // -------------------------------------------------------------------------

  _shouldIgnore(message, settings) {
    if (message.author.bot) return true;
    if (message.guild.ownerId === message.author.id) return true;
    if (message.member.permissions.has(PermissionFlagsBits.Administrator))
      return true;

    if (settings?.ignored_roles?.length) {
      const ignored = message.member.roles.cache.some((r) =>
        settings.ignored_roles.includes(r.id),
      );
      if (ignored) return true;
    }
    if (settings?.ignored_channels?.includes(message.channel.id)) return true;

    return false;
  }

  _passesRuleFilters(rule, message) {
    const filters = db.getFilters(rule.id);

    const affectedRoles = filters.filter(
      (f) => f.filter_type === "affected" && f.target_type === "role",
    );
    const affectedChannels = filters.filter(
      (f) => f.filter_type === "affected" && f.target_type === "channel",
    );
    const ignoredRoles = filters.filter(
      (f) => f.filter_type === "ignored" && f.target_type === "role",
    );
    const ignoredChannels = filters.filter(
      (f) => f.filter_type === "ignored" && f.target_type === "channel",
    );

    if (affectedRoles.length) {
      const hasRole = message.member.roles.cache.some((r) =>
        affectedRoles.some((f) => f.target_id === r.id),
      );
      if (!hasRole) return false;
    }
    if (affectedChannels.length) {
      if (!affectedChannels.some((f) => f.target_id === message.channel.id))
        return false;
    }
    if (ignoredRoles.length) {
      const hasIgnored = message.member.roles.cache.some((r) =>
        ignoredRoles.some((f) => f.target_id === r.id),
      );
      if (hasIgnored) return false;
    }
    if (ignoredChannels.length) {
      if (ignoredChannels.some((f) => f.target_id === message.channel.id))
        return false;
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // Rule evaluation dispatcher
  // -------------------------------------------------------------------------

  async _evaluateRule(rule, message) {
    const t = rule.threshold;

    switch (rule.rule_type) {
      case "all_caps":
        return this._checkAllCaps(message.content, t ?? DEFAULTS.all_caps);
      case "bad_words":
        return this._checkBadWords(message.content, message.guild.id);
      case "newlines":
        return this._checkNewlines(message.content, t ?? DEFAULTS.newlines);
      case "duplicate_text":
        return this._checkDuplicateText(message.content);
      case "character_count":
        return this._checkCharacterCount(
          message.content,
          t ?? DEFAULTS.character_count,
        );
      case "emoji_spam":
        return this._checkEmojiSpam(message.content, t ?? DEFAULTS.emoji_spam);
      case "fast_message_spam":
        return this._checkFastMessageSpam(
          message,
          t ?? DEFAULTS.fast_message_spam,
        );
      case "image_spam":
        return this._checkImageSpam(message, t ?? DEFAULTS.image_spam);
      case "invite_links":
        return this._checkInviteLinks(message.content);
      case "phishing_links":
        return this._checkPhishingLinks(message.content);
      case "links":
        return this._checkLinks(message.content, message.guild.id, t === 1);
      case "links_cooldown":
        return this._checkLinksCooldown(
          message,
          t ?? DEFAULTS.links_cooldown,
          rule.threshold_seconds ?? 30,
        );
      case "mass_mentions":
        return this._checkMassMentions(message, t ?? DEFAULTS.mass_mentions);
      case "mentions_cooldown":
        return this._checkMentionsCooldown(
          message,
          t ?? DEFAULTS.mentions_cooldown,
        );
      case "spoilers":
        return this._checkSpoilers(message);
      case "masked_links":
        return this._checkMaskedLinks(message.content);
      case "stickers":
        return this._checkStickers(message);
      case "sticker_cooldown":
        return this._checkStickerCooldown(
          message,
          t ?? DEFAULTS.sticker_cooldown,
        );
      case "zalgo":
        return this._checkZalgo(message.content);
      default:
        console.warn(`[AUTOMOD] Unknown rule type: ${rule.rule_type}`);
        return false;
    }
  }

  // -------------------------------------------------------------------------
  // Rule implementations
  // -------------------------------------------------------------------------

  _checkAllCaps(content, threshold) {
    if (content.length < 5) return false;
    const letters = content.replace(/[^a-zA-Z]/g, "");
    if (!letters.length) return false;
    const upperRatio =
      (content.replace(/[^A-Z]/g, "").length / letters.length) * 100;
    return upperRatio >= threshold;
  }

  _checkBadWords(content, guildId) {
    const words = db.getBadWords(guildId);
    const lower = content.toLowerCase();

    for (const entry of words) {
      if (entry.match_type === "exact") {
        if (lower.split(/\s+/).includes(entry.word)) return true;
      } else if (entry.match_type === "wildcard") {
        // Escape all regex special characters EXCEPT *, then replace * with .*
        const escaped = entry.word.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
        const pattern = escaped.replace(/\*/g, ".*");
        try {
          if (new RegExp(pattern, "i").test(content)) return true;
        } catch {
          // If the pattern is still somehow invalid, fall back to contains
          if (lower.includes(entry.word.replace(/\*/g, ""))) return true;
        }
      } else {
        if (lower.includes(entry.word)) return true;
      }
    }
    return false;
  }

  _checkNewlines(content, threshold) {
    return (content.match(/\n/g) ?? []).length >= threshold;
  }

  _checkDuplicateText(content) {
    // Repeated character runs (e.g. "aaaaaaaaa")
    if (/(.)\1{7,}/i.test(content)) return true;
    // Repeated words (e.g. "word word word word word")
    const words = content.split(/\s+/);
    for (let i = 0; i <= words.length - 5; i++) {
      if (words.slice(i, i + 5).every((w) => w === words[i])) return true;
    }
    return false;
  }

  _checkCharacterCount(content, max) {
    return content.length > max;
  }

  _checkEmojiSpam(content, threshold) {
    const unicode = (
      content.match(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu) ?? []
    ).length;
    const custom = (content.match(/<a?:\w+:\d+>/g) ?? []).length;
    return unicode + custom >= threshold;
  }

  async _checkFastMessageSpam(message, threshold) {
    db.trackMessage(
      message.guild.id,
      message.author.id,
      message.channel.id,
      "message",
    );
    const recent = db.getRecentMessages(
      message.guild.id,
      message.author.id,
      "message",
      5,
    );
    return (
      recent.filter((m) => m.channel_id === message.channel.id).length >=
      threshold
    );
  }

  async _checkImageSpam(message, threshold) {
    const images = [...message.attachments.values()].filter((a) =>
      a.contentType?.startsWith("image/"),
    );
    if (!images.length) return false;
    if (images.length >= threshold) return true;

    db.trackMessage(
      message.guild.id,
      message.author.id,
      message.channel.id,
      "image",
    );
    const recent = db.getRecentMessages(
      message.guild.id,
      message.author.id,
      "image",
      10,
    );
    return recent.length >= threshold;
  }

  _checkInviteLinks(content) {
    return /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9]+/i.test(
      content,
    );
  }

  _checkPhishingLinks(content) {
    const urls = content.match(/(https?:\/\/[^\s]+)/gi) ?? [];
    return urls.some((url) => {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return PHISHING_DOMAINS.some((domain) => host.includes(domain));
      } catch {
        return false;
      }
    });
  }

  _checkLinks(content, guildId, allowlistMode) {
    const urls = content.match(/(https?:\/\/[^\s]+)/gi) ?? [];
    if (!urls.length) return false;

    const blocked = db.getBlockedLinks(guildId);
    const allowed = allowlistMode ? db.getAllowedLinks(guildId) : [];

    for (const url of urls) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        if (blocked.some((d) => host.includes(d))) return true;
        if (
          allowlistMode &&
          allowed.length &&
          !allowed.some((d) => host.includes(d))
        )
          return true;
      } catch {
        // Skip malformed URLs
      }
    }
    return false;
  }

  async _checkLinksCooldown(message, threshold, seconds) {
    if (!/(https?:\/\/[^\s]+)/i.test(message.content)) return false;
    db.trackMessage(
      message.guild.id,
      message.author.id,
      message.channel.id,
      "link",
    );
    const recent = db.getRecentMessages(
      message.guild.id,
      message.author.id,
      "link",
      seconds,
    );
    return recent.length >= threshold;
  }

  _checkMassMentions(message, threshold) {
    return (
      message.mentions.users.size + message.mentions.roles.size >= threshold
    );
  }

  async _checkMentionsCooldown(message, threshold) {
    if (!message.mentions.users.size && !message.mentions.roles.size)
      return false;
    db.trackMessage(
      message.guild.id,
      message.author.id,
      message.channel.id,
      "mention",
    );
    const recent = db.getRecentMessages(
      message.guild.id,
      message.author.id,
      "mention",
      30,
    );
    return recent.length >= threshold;
  }

  _checkSpoilers(message) {
    if (message.content.includes("||")) return true;
    if (message.attachments.some((a) => a.spoiler)) return true;
    return false;
  }

  _checkMaskedLinks(content) {
    return /\[.+?\]\(https?:\/\/.+?\)/i.test(content);
  }

  _checkStickers(message) {
    return message.stickers.size > 0;
  }

  async _checkStickerCooldown(message, threshold) {
    if (!message.stickers.size) return false;
    db.trackMessage(
      message.guild.id,
      message.author.id,
      message.channel.id,
      "sticker",
    );
    const recent = db.getRecentMessages(
      message.guild.id,
      message.author.id,
      "sticker",
      60,
    );
    return recent.length >= threshold;
  }

  _checkZalgo(content) {
    const combining = content.match(
      /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g,
    );
    if (!combining) return false;
    return combining.length > 15 || combining.length / content.length > 0.2;
  }
}

module.exports = new AutomodChecker();
