'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');
const { DEFAULT_LABEL_FORMAT } = require('./constants');

class TicketDatabase {
    constructor() {
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        this.db = new Database(path.join(dataDir, 'tickets.db'));
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this._initTables();
    }

    _initTables() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS ticket_settings (
                guild_id       TEXT PRIMARY KEY,
                log_open       TEXT,
                log_close      TEXT,
                default_cat    TEXT,
                ticket_counter INTEGER NOT NULL DEFAULT 0,
                updated_at     INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS ticket_staff_roles (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                role_id  TEXT NOT NULL,
                UNIQUE(guild_id, role_id)
            );

            CREATE TABLE IF NOT EXISTS ticket_panels (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id     TEXT NOT NULL,
                name         TEXT NOT NULL,
                input_type   TEXT NOT NULL DEFAULT 'buttons',
                ticket_style TEXT NOT NULL DEFAULT 'channel',
                message_id   TEXT,
                channel_id   TEXT,
                created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            );

            -- Up to 10 embeds per panel (Discord limit)
            CREATE TABLE IF NOT EXISTS ticket_panel_embeds (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                panel_id    INTEGER NOT NULL REFERENCES ticket_panels(id) ON DELETE CASCADE,
                title       TEXT,
                description TEXT,
                color       INTEGER NOT NULL DEFAULT 5793266,
                image_url   TEXT,
                thumbnail   TEXT,
                footer      TEXT,
                position    INTEGER NOT NULL DEFAULT 0
            );

            -- Buttons or select-menu options on a panel
            CREATE TABLE IF NOT EXISTS ticket_panel_options (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                panel_id       INTEGER NOT NULL REFERENCES ticket_panels(id) ON DELETE CASCADE,
                label          TEXT NOT NULL,
                emoji          TEXT,
                description    TEXT,
                btn_style      INTEGER NOT NULL DEFAULT 1,
                ticket_style   TEXT,
                category_id    TEXT,
                support_roles  TEXT NOT NULL DEFAULT '',
                required_roles TEXT NOT NULL DEFAULT '',
                label_format   TEXT NOT NULL DEFAULT 'ticket-{username}-{number}',
                position       INTEGER NOT NULL DEFAULT 0
            );

            -- Modal questions per option (max 5, Discord limit)
            CREATE TABLE IF NOT EXISTS ticket_option_questions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                option_id   INTEGER NOT NULL REFERENCES ticket_panel_options(id) ON DELETE CASCADE,
                label       TEXT NOT NULL,
                placeholder TEXT,
                required    INTEGER NOT NULL DEFAULT 1,
                style       INTEGER NOT NULL DEFAULT 1,
                min_length  INTEGER NOT NULL DEFAULT 0,
                max_length  INTEGER NOT NULL DEFAULT 1000,
                position    INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS tickets (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id      TEXT NOT NULL,
                panel_id      INTEGER REFERENCES ticket_panels(id),
                option_id     INTEGER REFERENCES ticket_panel_options(id),
                user_id       TEXT NOT NULL,
                channel_id    TEXT,
                thread_id     TEXT,
                status        TEXT NOT NULL DEFAULT 'open',
                ticket_number INTEGER NOT NULL,
                ticket_name   TEXT NOT NULL,
                answers       TEXT NOT NULL DEFAULT '{}',
                opened_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                closed_at     INTEGER,
                closed_by     TEXT
            );

            -- Per-message records used when channel is deleted without /ticket close
            CREATE TABLE IF NOT EXISTS ticket_messages (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
                message_id  TEXT NOT NULL UNIQUE,
                author_id   TEXT NOT NULL,
                author_tag  TEXT NOT NULL,
                author_bot  INTEGER NOT NULL DEFAULT 0,
                content     TEXT NOT NULL DEFAULT '',
                attachments TEXT NOT NULL DEFAULT '[]',
                embeds      INTEGER NOT NULL DEFAULT 0,
                created_at  INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tickets_guild   ON tickets(guild_id);
            CREATE INDEX IF NOT EXISTS idx_tickets_user    ON tickets(guild_id, user_id);
            CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets(channel_id);
            CREATE INDEX IF NOT EXISTS idx_tickets_thread  ON tickets(thread_id);
            CREATE INDEX IF NOT EXISTS idx_tmsg_ticket     ON ticket_messages(ticket_id);
            CREATE INDEX IF NOT EXISTS idx_panels_guild    ON ticket_panels(guild_id);
        `);
    }

    // -------------------------------------------------------------------------
    // Settings
    // -------------------------------------------------------------------------

    getSettings(guildId) {
        return this.db.prepare(
            'SELECT * FROM ticket_settings WHERE guild_id = ?'
        ).get(guildId) ?? {};
    }

    /**
     * Merges provided fields into the guild's settings row.
     * Only updates recognised columns; unknown keys are ignored.
     */
    upsertSettings(guildId, fields) {
        const allowed = ['log_open', 'log_close', 'default_cat'];
        const current = this.getSettings(guildId);

        const merged = { ...current };
        for (const key of allowed) {
            if (key in fields) merged[key] = fields[key] ?? null;
        }

        this.db.prepare(`
            INSERT INTO ticket_settings (guild_id, log_open, log_close, default_cat, ticket_counter)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                log_open   = excluded.log_open,
                log_close  = excluded.log_close,
                default_cat = excluded.default_cat,
                updated_at = strftime('%s','now')
        `).run(
            guildId,
            merged.log_open  ?? null,
            merged.log_close ?? null,
            merged.default_cat ?? null,
            merged.ticket_counter ?? 0
        );
    }

    /** Atomically increments and returns the next ticket number for the guild. */
    nextTicketNumber(guildId) {
        const row  = this.db.prepare('SELECT ticket_counter FROM ticket_settings WHERE guild_id = ?').get(guildId);
        const next = (row?.ticket_counter ?? 0) + 1;
        this.db.prepare(`
            INSERT INTO ticket_settings (guild_id, ticket_counter) VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET ticket_counter = excluded.ticket_counter
        `).run(guildId, next);
        return next;
    }

    // -------------------------------------------------------------------------
    // Staff Roles
    // -------------------------------------------------------------------------

    addStaffRole(guildId, roleId) {
        this.db.prepare(
            'INSERT OR IGNORE INTO ticket_staff_roles (guild_id, role_id) VALUES (?, ?)'
        ).run(guildId, roleId);
    }

    removeStaffRole(guildId, roleId) {
        return this.db.prepare(
            'DELETE FROM ticket_staff_roles WHERE guild_id = ? AND role_id = ?'
        ).run(guildId, roleId);
    }

    getStaffRoles(guildId) {
        return this.db
            .prepare('SELECT role_id FROM ticket_staff_roles WHERE guild_id = ?')
            .all(guildId)
            .map(r => r.role_id);
    }

    // -------------------------------------------------------------------------
    // Panels
    // -------------------------------------------------------------------------

    createPanel(guildId, name, inputType, ticketStyle) {
        return this.db.prepare(`
            INSERT INTO ticket_panels (guild_id, name, input_type, ticket_style)
            VALUES (?, ?, ?, ?)
        `).run(guildId, name, inputType, ticketStyle);
    }

    /**
     * Returns a panel with its embeds, options, and each option's questions.
     * Role arrays are parsed from comma-separated strings into proper arrays.
     */
    getPanel(panelId) {
        const panel = this.db.prepare('SELECT * FROM ticket_panels WHERE id = ?').get(panelId);
        if (!panel) return null;

        panel.embeds  = this.db.prepare('SELECT * FROM ticket_panel_embeds   WHERE panel_id  = ? ORDER BY position').all(panelId);
        panel.options = this.db.prepare('SELECT * FROM ticket_panel_options  WHERE panel_id  = ? ORDER BY position').all(panelId);

        for (const option of panel.options) {
            option.questions      = this.db.prepare('SELECT * FROM ticket_option_questions WHERE option_id = ? ORDER BY position').all(option.id);
            option.support_roles  = splitRoles(option.support_roles);
            option.required_roles = splitRoles(option.required_roles);
        }

        return panel;
    }

    getPanels(guildId) {
        return this.db.prepare('SELECT * FROM ticket_panels WHERE guild_id = ? ORDER BY id').all(guildId);
    }

    updatePanel(panelId, fields) {
        const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        this.db.prepare(`UPDATE ticket_panels SET ${sets} WHERE id = ?`).run(...Object.values(fields), panelId);
    }

    deletePanel(panelId) {
        return this.db.prepare('DELETE FROM ticket_panels WHERE id = ?').run(panelId);
    }

    // -------------------------------------------------------------------------
    // Embeds
    // -------------------------------------------------------------------------

    addEmbed(panelId, data) {
        const pos = this.db.prepare('SELECT COUNT(*) AS c FROM ticket_panel_embeds WHERE panel_id = ?').get(panelId).c;
        return this.db.prepare(`
            INSERT INTO ticket_panel_embeds (panel_id, title, description, color, image_url, thumbnail, footer, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(panelId, data.title ?? null, data.description ?? null, data.color ?? 5793266,
               data.image_url ?? null, data.thumbnail ?? null, data.footer ?? null, pos);
    }

    deleteEmbed(embedId) {
        return this.db.prepare('DELETE FROM ticket_panel_embeds WHERE id = ?').run(embedId);
    }

    // -------------------------------------------------------------------------
    // Options
    // -------------------------------------------------------------------------

    addOption(panelId, data) {
        const pos = this.db.prepare('SELECT COUNT(*) AS c FROM ticket_panel_options WHERE panel_id = ?').get(panelId).c;
        return this.db.prepare(`
            INSERT INTO ticket_panel_options
                (panel_id, label, emoji, description, btn_style, ticket_style,
                 category_id, support_roles, required_roles, label_format, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            panelId,
            data.label,
            data.emoji        ?? null,
            data.description  ?? null,
            data.btn_style    ?? 1,
            data.ticket_style ?? null,
            data.category_id  ?? null,
            (data.support_roles  ?? []).join(','),
            (data.required_roles ?? []).join(','),
            data.label_format ?? DEFAULT_LABEL_FORMAT,
            pos
        );
    }

    getOption(optionId) {
        const option = this.db.prepare('SELECT * FROM ticket_panel_options WHERE id = ?').get(optionId);
        if (!option) return null;
        option.questions      = this.db.prepare('SELECT * FROM ticket_option_questions WHERE option_id = ? ORDER BY position').all(option.id);
        option.support_roles  = splitRoles(option.support_roles);
        option.required_roles = splitRoles(option.required_roles);
        return option;
    }

    updateOption(optionId, data) {
        const ALLOWED_COLUMNS = ['label', 'emoji', 'description', 'btn_style', 'ticket_style',
                                 'category_id', 'support_roles', 'required_roles', 'label_format'];
        const fields = {};
        for (const col of ALLOWED_COLUMNS) {
            if (!(col in data)) continue;
            fields[col] = (col === 'support_roles' || col === 'required_roles')
                ? (Array.isArray(data[col]) ? data[col].join(',') : data[col])
                : data[col];
        }
        if (!Object.keys(fields).length) return;
        const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        this.db.prepare(`UPDATE ticket_panel_options SET ${sets} WHERE id = ?`).run(...Object.values(fields), optionId);
    }

    deleteOption(optionId) {
        return this.db.prepare('DELETE FROM ticket_panel_options WHERE id = ?').run(optionId);
    }

    // -------------------------------------------------------------------------
    // Questions
    // -------------------------------------------------------------------------

    addQuestion(optionId, data) {
        const pos = this.db.prepare('SELECT COUNT(*) AS c FROM ticket_option_questions WHERE option_id = ?').get(optionId).c;
        return this.db.prepare(`
            INSERT INTO ticket_option_questions (option_id, label, placeholder, required, style, min_length, max_length, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            optionId,
            data.label,
            data.placeholder ?? null,
            data.required ? 1 : 0,
            data.style      ?? 1,
            data.min_length ?? 0,
            data.max_length ?? 1000,
            pos
        );
    }

    deleteQuestion(questionId) {
        return this.db.prepare('DELETE FROM ticket_option_questions WHERE id = ?').run(questionId);
    }

    // -------------------------------------------------------------------------
    // Tickets
    // -------------------------------------------------------------------------

    createTicket(data) {
        return this.db.prepare(`
            INSERT INTO tickets (guild_id, panel_id, option_id, user_id, channel_id, thread_id, ticket_number, ticket_name, answers)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            data.guildId,
            data.panelId      ?? null,
            data.optionId     ?? null,
            data.userId,
            data.channelId    ?? null,
            data.threadId     ?? null,
            data.ticketNumber,
            data.ticketName,
            JSON.stringify(data.answers ?? {})
        );
    }

    getTicket(ticketId) {
        const row = this.db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
        if (row) row.answers = JSON.parse(row.answers);
        return row ?? null;
    }

    getTicketByChannel(channelId) {
        const row = this.db.prepare('SELECT * FROM tickets WHERE channel_id = ? OR thread_id = ?').get(channelId, channelId);
        if (row) row.answers = JSON.parse(row.answers);
        return row ?? null;
    }

    /**
     * Bug fix: the original query used `option_id = ?` with a null value, which in SQLite
     * always evaluates to false (NULL comparisons require IS NULL / IS NOT NULL).
     * We now branch on whether optionId is null so deduplication works for both cases.
     */
    getOpenTicketByUser(guildId, userId, optionId) {
        if (optionId == null) {
            return this.db.prepare(`
                SELECT * FROM tickets
                WHERE guild_id = ? AND user_id = ? AND option_id IS NULL AND status = 'open'
            `).get(guildId, userId);
        }
        return this.db.prepare(`
            SELECT * FROM tickets
            WHERE guild_id = ? AND user_id = ? AND option_id = ? AND status = 'open'
        `).get(guildId, userId, optionId);
    }

    updateTicket(ticketId, fields) {
        const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        this.db.prepare(`UPDATE tickets SET ${sets} WHERE id = ?`).run(...Object.values(fields), ticketId);
    }

    closeTicket(ticketId, closedBy) {
        this.db.prepare(`
            UPDATE tickets
            SET status = 'closed', closed_at = strftime('%s','now'), closed_by = ?
            WHERE id = ?
        `).run(closedBy, ticketId);
    }

    searchTickets(guildId, query) {
        return this.db.prepare(`
            SELECT * FROM tickets
            WHERE guild_id = ? AND (
                ticket_name LIKE ?
                OR user_id = ?
                OR channel_id = ?
                OR thread_id = ?
                OR CAST(ticket_number AS TEXT) = ?
            )
            ORDER BY opened_at DESC
            LIMIT 25
        `).all(guildId, `%${query}%`, query, query, query, query);
    }

    getTicketsByUser(guildId, userId, limit = 10) {
        return this.db.prepare(`
            SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? ORDER BY opened_at DESC LIMIT ?
        `).all(guildId, userId, limit);
    }

    // -------------------------------------------------------------------------
    // Message Tracking
    // -------------------------------------------------------------------------

    trackMessage(ticketId, msg) {
        this.db.prepare(`
            INSERT OR IGNORE INTO ticket_messages
                (ticket_id, message_id, author_id, author_tag, author_bot, content, attachments, embeds, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            ticketId,
            msg.id,
            msg.authorId,
            msg.authorTag,
            msg.authorBot ? 1 : 0,
            msg.content,
            JSON.stringify(msg.attachments ?? []),
            msg.embeds ?? 0,
            msg.createdAt
        );
    }

    getTicketMessages(ticketId) {
        return this.db.prepare(
            'SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at'
        ).all(ticketId);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitRoles(str) {
    return str ? str.split(',').filter(Boolean) : [];
}

module.exports = new TicketDatabase();
