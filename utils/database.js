const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class AutomodDatabase {
    constructor() {
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        this.db = new Database(path.join(dataDir, 'automod.db'));
        this.initTables();
    }

    initTables() {
        // Automod rules table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS automod_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                rule_type TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                threshold INTEGER,
                threshold_seconds INTEGER,
                action TEXT NOT NULL,
                violation_count INTEGER DEFAULT 1,
                mute_duration INTEGER,
                custom_message TEXT,
                log_channel_id TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Rule filters (affected/ignored roles/channels)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS automod_filters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id INTEGER NOT NULL,
                filter_type TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                FOREIGN KEY (rule_id) REFERENCES automod_rules(id) ON DELETE CASCADE
            )
        `);

        // Bad words list
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS automod_badwords (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                word TEXT NOT NULL,
                match_type TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Allowed links
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS automod_allowed_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                domain TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Blocked links
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS automod_blocked_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                domain TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // User violations (expires after 5 minutes)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS automod_violations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                rule_type TEXT NOT NULL,
                timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Guild settings
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS automod_settings (
                guild_id TEXT PRIMARY KEY,
                default_log_channel TEXT,
                ignored_roles TEXT,
                ignored_channels TEXT,
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // User message tracking for spam detection
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS message_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                message_type TEXT NOT NULL,
                timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Create indexes for performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_rules_guild ON automod_rules(guild_id);
            CREATE INDEX IF NOT EXISTS idx_violations_guild_user ON automod_violations(guild_id, user_id);
            CREATE INDEX IF NOT EXISTS idx_badwords_guild ON automod_badwords(guild_id);
            CREATE INDEX IF NOT EXISTS idx_tracking_guild_user ON message_tracking(guild_id, user_id);
        `);
    }

    // Rule Management
    createRule(guildId, ruleType, config) {
        const stmt = this.db.prepare(`
            INSERT INTO automod_rules (
                guild_id, rule_type, enabled, threshold, threshold_seconds,
                action, violation_count, mute_duration, custom_message, log_channel_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        return stmt.run(
            guildId,
            ruleType,
            config.enabled ? 1 : 0,
            config.threshold || null,
            config.thresholdSeconds || null,
            config.action,
            config.violationCount || 1,
            config.muteDuration || null,
            config.customMessage || null,
            config.logChannelId || null
        );
    }

    getRules(guildId, ruleType = null) {
        if (ruleType) {
            const stmt = this.db.prepare('SELECT * FROM automod_rules WHERE guild_id = ? AND rule_type = ? AND enabled = 1');
            return stmt.all(guildId, ruleType);
        }
        const stmt = this.db.prepare('SELECT * FROM automod_rules WHERE guild_id = ?');
        return stmt.all(guildId);
    }

    updateRule(ruleId, config) {
        const fields = [];
        const values = [];
        
        if (config.enabled !== undefined) {
            fields.push('enabled = ?');
            values.push(config.enabled ? 1 : 0);
        }
        if (config.threshold !== undefined) {
            fields.push('threshold = ?');
            values.push(config.threshold);
        }
        if (config.action !== undefined) {
            fields.push('action = ?');
            values.push(config.action);
        }
        if (config.violationCount !== undefined) {
            fields.push('violation_count = ?');
            values.push(config.violationCount);
        }
        
        fields.push('updated_at = ?');
        values.push(Math.floor(Date.now() / 1000));
        values.push(ruleId);
        
        const stmt = this.db.prepare(`UPDATE automod_rules SET ${fields.join(', ')} WHERE id = ?`);
        return stmt.run(...values);
    }

    deleteRule(ruleId) {
        const stmt = this.db.prepare('DELETE FROM automod_rules WHERE id = ?');
        return stmt.run(ruleId);
    }

    // Filter Management
    addFilter(ruleId, filterType, targetType, targetId) {
        const stmt = this.db.prepare(`
            INSERT INTO automod_filters (rule_id, filter_type, target_type, target_id)
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(ruleId, filterType, targetType, targetId);
    }

    getFilters(ruleId) {
        const stmt = this.db.prepare('SELECT * FROM automod_filters WHERE rule_id = ?');
        return stmt.all(ruleId);
    }

    // Bad Words Management
    addBadWord(guildId, word, matchType = 'contains') {
        const stmt = this.db.prepare(`
            INSERT INTO automod_badwords (guild_id, word, match_type)
            VALUES (?, ?, ?)
        `);
        return stmt.run(guildId, word.toLowerCase(), matchType);
    }

    getBadWords(guildId) {
        const stmt = this.db.prepare('SELECT * FROM automod_badwords WHERE guild_id = ?');
        return stmt.all(guildId);
    }

    removeBadWord(guildId, word) {
        const stmt = this.db.prepare('DELETE FROM automod_badwords WHERE guild_id = ? AND word = ?');
        return stmt.run(guildId, word.toLowerCase());
    }

    // Allowed/Blocked Links
    addAllowedLink(guildId, domain) {
        const stmt = this.db.prepare('INSERT INTO automod_allowed_links (guild_id, domain) VALUES (?, ?)');
        return stmt.run(guildId, domain.toLowerCase());
    }

    getAllowedLinks(guildId) {
        const stmt = this.db.prepare('SELECT domain FROM automod_allowed_links WHERE guild_id = ?');
        return stmt.all(guildId).map(row => row.domain);
    }

    addBlockedLink(guildId, domain) {
        const stmt = this.db.prepare('INSERT INTO automod_blocked_links (guild_id, domain) VALUES (?, ?)');
        return stmt.run(guildId, domain.toLowerCase());
    }

    getBlockedLinks(guildId) {
        const stmt = this.db.prepare('SELECT domain FROM automod_blocked_links WHERE guild_id = ?');
        return stmt.all(guildId).map(row => row.domain);
    }

    // Violations
    addViolation(guildId, userId, ruleType) {
        const stmt = this.db.prepare(`
            INSERT INTO automod_violations (guild_id, user_id, rule_type)
            VALUES (?, ?, ?)
        `);
        return stmt.run(guildId, userId, ruleType);
    }

    getViolationCount(guildId, userId, ruleType) {
        const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
        const stmt = this.db.prepare(`
            SELECT COUNT(*) as count FROM automod_violations
            WHERE guild_id = ? AND user_id = ? AND rule_type = ? AND timestamp > ?
        `);
        return stmt.get(guildId, userId, ruleType, fiveMinutesAgo).count;
    }

    cleanExpiredViolations() {
        const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
        const stmt = this.db.prepare('DELETE FROM automod_violations WHERE timestamp < ?');
        return stmt.run(fiveMinutesAgo);
    }

    // Message Tracking
    trackMessage(guildId, userId, channelId, messageType) {
        const stmt = this.db.prepare(`
            INSERT INTO message_tracking (guild_id, user_id, channel_id, message_type)
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(guildId, userId, channelId, messageType);
    }

    getRecentMessages(guildId, userId, messageType, seconds) {
        const threshold = Math.floor(Date.now() / 1000) - seconds;
        const stmt = this.db.prepare(`
            SELECT * FROM message_tracking
            WHERE guild_id = ? AND user_id = ? AND message_type = ? AND timestamp > ?
        `);
        return stmt.all(guildId, userId, messageType, threshold);
    }

    cleanOldTracking() {
        const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
        const stmt = this.db.prepare('DELETE FROM message_tracking WHERE timestamp < ?');
        return stmt.run(oneHourAgo);
    }

    // Guild Settings
    getSettings(guildId) {
        const stmt = this.db.prepare('SELECT * FROM automod_settings WHERE guild_id = ?');
        const settings = stmt.get(guildId);
        if (settings) {
            settings.ignored_roles = settings.ignored_roles ? settings.ignored_roles.split(',') : [];
            settings.ignored_channels = settings.ignored_channels ? settings.ignored_channels.split(',') : [];
        }
        return settings;
    }

    updateSettings(guildId, settings) {
        const stmt = this.db.prepare(`
            INSERT INTO automod_settings (guild_id, default_log_channel, ignored_roles, ignored_channels, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                default_log_channel = excluded.default_log_channel,
                ignored_roles = excluded.ignored_roles,
                ignored_channels = excluded.ignored_channels,
                updated_at = excluded.updated_at
        `);
        return stmt.run(
            guildId,
            settings.defaultLogChannel || null,
            Array.isArray(settings.ignoredRoles) ? settings.ignoredRoles.join(',') : '',
            Array.isArray(settings.ignoredChannels) ? settings.ignoredChannels.join(',') : '',
            Math.floor(Date.now() / 1000)
        );
    }

    close() {
        this.db.close();
    }
}

module.exports = new AutomodDatabase();
