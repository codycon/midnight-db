'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

class AutomodDatabase {
    constructor() {
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        this.db = new Database(path.join(dataDir, 'automod.db'));
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this._initTables();
    }

    _initTables() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS automod_rules (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id          TEXT    NOT NULL,
                rule_type         TEXT    NOT NULL,
                enabled           INTEGER NOT NULL DEFAULT 1,
                threshold         INTEGER,
                threshold_seconds INTEGER,
                action            TEXT    NOT NULL,
                violation_count   INTEGER NOT NULL DEFAULT 1,
                mute_duration     INTEGER,
                custom_message    TEXT,
                log_channel_id    TEXT,
                created_at        INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                updated_at        INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS automod_filters (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id     INTEGER NOT NULL REFERENCES automod_rules(id) ON DELETE CASCADE,
                filter_type TEXT    NOT NULL,
                target_type TEXT    NOT NULL,
                target_id   TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS automod_badwords (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id   TEXT NOT NULL,
                word       TEXT NOT NULL,
                match_type TEXT NOT NULL DEFAULT 'contains',
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                UNIQUE(guild_id, word)
            );

            CREATE TABLE IF NOT EXISTS automod_allowed_links (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id   TEXT NOT NULL,
                domain     TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                UNIQUE(guild_id, domain)
            );

            CREATE TABLE IF NOT EXISTS automod_blocked_links (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id   TEXT NOT NULL,
                domain     TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                UNIQUE(guild_id, domain)
            );

            CREATE TABLE IF NOT EXISTS automod_violations (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id   TEXT    NOT NULL,
                user_id    TEXT    NOT NULL,
                rule_type  TEXT    NOT NULL,
                timestamp  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS automod_settings (
                guild_id            TEXT PRIMARY KEY,
                default_log_channel TEXT,
                ignored_roles       TEXT NOT NULL DEFAULT '',
                ignored_channels    TEXT NOT NULL DEFAULT '',
                updated_at          INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS message_tracking (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id     TEXT    NOT NULL,
                user_id      TEXT    NOT NULL,
                channel_id   TEXT    NOT NULL,
                message_type TEXT    NOT NULL,
                timestamp    INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE INDEX IF NOT EXISTS idx_rules_guild          ON automod_rules(guild_id);
            CREATE INDEX IF NOT EXISTS idx_violations_guild_user ON automod_violations(guild_id, user_id);
            CREATE INDEX IF NOT EXISTS idx_badwords_guild        ON automod_badwords(guild_id);
            CREATE INDEX IF NOT EXISTS idx_tracking_guild_user   ON message_tracking(guild_id, user_id);
        `);
    }

    // -------------------------------------------------------------------------
    // Rules
    // -------------------------------------------------------------------------

    createRule(guildId, ruleType, config) {
        return this.db.prepare(`
            INSERT INTO automod_rules
                (guild_id, rule_type, enabled, threshold, threshold_seconds,
                 action, violation_count, mute_duration, custom_message, log_channel_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            guildId,
            ruleType,
            config.enabled ? 1 : 0,
            config.threshold         ?? null,
            config.thresholdSeconds  ?? null,
            config.action,
            config.violationCount    ?? 1,
            config.muteDuration      ?? null,
            config.customMessage     ?? null,
            config.logChannelId      ?? null
        );
    }

    getRules(guildId) {
        return this.db.prepare('SELECT * FROM automod_rules WHERE guild_id = ?').all(guildId);
    }

    getRuleById(ruleId) {
        return this.db.prepare('SELECT * FROM automod_rules WHERE id = ?').get(ruleId) ?? null;
    }

    updateRule(ruleId, config) {
        const sets   = [];
        const values = [];

        if (config.enabled !== undefined)        { sets.push('enabled = ?');         values.push(config.enabled ? 1 : 0); }
        if (config.threshold !== undefined)       { sets.push('threshold = ?');        values.push(config.threshold); }
        if (config.action !== undefined)          { sets.push('action = ?');           values.push(config.action); }
        if (config.violationCount !== undefined)  { sets.push('violation_count = ?');  values.push(config.violationCount); }
        if (config.muteDuration !== undefined)    { sets.push('mute_duration = ?');    values.push(config.muteDuration); }

        sets.push('updated_at = ?');
        values.push(Math.floor(Date.now() / 1000));
        values.push(ruleId);

        return this.db.prepare(`UPDATE automod_rules SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }

    deleteRule(ruleId) {
        return this.db.prepare('DELETE FROM automod_rules WHERE id = ?').run(ruleId);
    }

    // -------------------------------------------------------------------------
    // Filters
    // -------------------------------------------------------------------------

    addFilter(ruleId, filterType, targetType, targetId) {
        return this.db.prepare(`
            INSERT INTO automod_filters (rule_id, filter_type, target_type, target_id)
            VALUES (?, ?, ?, ?)
        `).run(ruleId, filterType, targetType, targetId);
    }

    getFilters(ruleId) {
        return this.db.prepare('SELECT * FROM automod_filters WHERE rule_id = ?').all(ruleId);
    }

    // -------------------------------------------------------------------------
    // Bad Words
    // -------------------------------------------------------------------------

    addBadWord(guildId, word, matchType = 'contains') {
        return this.db.prepare(`
            INSERT INTO automod_badwords (guild_id, word, match_type)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id, word) DO UPDATE SET match_type = excluded.match_type
        `).run(guildId, word.toLowerCase(), matchType);
    }

    getBadWords(guildId) {
        return this.db.prepare('SELECT * FROM automod_badwords WHERE guild_id = ?').all(guildId);
    }

    removeBadWord(guildId, word) {
        return this.db.prepare('DELETE FROM automod_badwords WHERE guild_id = ? AND word = ?').run(guildId, word.toLowerCase());
    }

    // -------------------------------------------------------------------------
    // Links
    // -------------------------------------------------------------------------

    addAllowedLink(guildId, domain) {
        return this.db.prepare(`
            INSERT OR IGNORE INTO automod_allowed_links (guild_id, domain) VALUES (?, ?)
        `).run(guildId, domain);
    }

    getAllowedLinks(guildId) {
        return this.db.prepare('SELECT domain FROM automod_allowed_links WHERE guild_id = ?').all(guildId).map(r => r.domain);
    }

    addBlockedLink(guildId, domain) {
        return this.db.prepare(`
            INSERT OR IGNORE INTO automod_blocked_links (guild_id, domain) VALUES (?, ?)
        `).run(guildId, domain);
    }

    getBlockedLinks(guildId) {
        return this.db.prepare('SELECT domain FROM automod_blocked_links WHERE guild_id = ?').all(guildId).map(r => r.domain);
    }

    // -------------------------------------------------------------------------
    // Violations
    // -------------------------------------------------------------------------

    addViolation(guildId, userId, ruleType) {
        return this.db.prepare(`
            INSERT INTO automod_violations (guild_id, user_id, rule_type) VALUES (?, ?, ?)
        `).run(guildId, userId, ruleType);
    }

    getViolationCount(guildId, userId, ruleType) {
        const since = Math.floor(Date.now() / 1000) - 300; // 5-minute window
        return this.db.prepare(`
            SELECT COUNT(*) AS count FROM automod_violations
            WHERE guild_id = ? AND user_id = ? AND rule_type = ? AND timestamp > ?
        `).get(guildId, userId, ruleType, since).count;
    }

    cleanExpiredViolations() {
        const since = Math.floor(Date.now() / 1000) - 300;
        return this.db.prepare('DELETE FROM automod_violations WHERE timestamp < ?').run(since);
    }

    // -------------------------------------------------------------------------
    // Message Tracking
    // -------------------------------------------------------------------------

    trackMessage(guildId, userId, channelId, messageType) {
        return this.db.prepare(`
            INSERT INTO message_tracking (guild_id, user_id, channel_id, message_type)
            VALUES (?, ?, ?, ?)
        `).run(guildId, userId, channelId, messageType);
    }

    getRecentMessages(guildId, userId, messageType, seconds) {
        const since = Math.floor(Date.now() / 1000) - seconds;
        return this.db.prepare(`
            SELECT * FROM message_tracking
            WHERE guild_id = ? AND user_id = ? AND message_type = ? AND timestamp > ?
        `).all(guildId, userId, messageType, since);
    }

    cleanOldTracking() {
        const since = Math.floor(Date.now() / 1000) - 3600; // 1-hour window
        return this.db.prepare('DELETE FROM message_tracking WHERE timestamp < ?').run(since);
    }

    // -------------------------------------------------------------------------
    // Settings
    // -------------------------------------------------------------------------

    /**
     * Returns settings for a guild.
     * ignored_roles and ignored_channels are returned as string arrays.
     */
    getSettings(guildId) {
        const row = this.db.prepare('SELECT * FROM automod_settings WHERE guild_id = ?').get(guildId);
        if (!row) return null;
        row.ignored_roles    = row.ignored_roles    ? row.ignored_roles.split(',')    : [];
        row.ignored_channels = row.ignored_channels ? row.ignored_channels.split(',') : [];
        return row;
    }

    /**
     * Upserts settings for a guild.
     * Expects: { defaultLogChannel?, ignoredRoles?, ignoredChannels? }
     */
    updateSettings(guildId, settings) {
        return this.db.prepare(`
            INSERT INTO automod_settings (guild_id, default_log_channel, ignored_roles, ignored_channels, updated_at)
            VALUES (?, ?, ?, ?, strftime('%s','now'))
            ON CONFLICT(guild_id) DO UPDATE SET
                default_log_channel = excluded.default_log_channel,
                ignored_roles       = excluded.ignored_roles,
                ignored_channels    = excluded.ignored_channels,
                updated_at          = excluded.updated_at
        `).run(
            guildId,
            settings.defaultLogChannel ?? null,
            Array.isArray(settings.ignoredRoles)    ? settings.ignoredRoles.join(',')    : '',
            Array.isArray(settings.ignoredChannels) ? settings.ignoredChannels.join(',') : ''
        );
    }
}

module.exports = new AutomodDatabase();
