'use strict';

/**
 * Centralised custom ID prefixes for all button, select menu, and modal interactions.
 * Using constants prevents typo-driven bugs where a button's customId doesn't match
 * the handler's string check.
 */
const CUSTOM_IDS = {
    // Ticket panel interactions
    TICKET_OPEN:         'ticket_open',
    TICKET_SELECT:       'ticket_select',
    TICKET_MODAL:        'ticket_modal',

    // Ticket lifecycle buttons (embedded in opener message)
    TICKET_CLOSE:        'ticket_close',
    TICKET_CLOSE_CONFIRM:'ticket_close_confirm',
    TICKET_CLOSE_CANCEL: 'ticket_close_cancel',
    TICKET_STAFF_THREAD: 'ticket_staff_thread',
};

/**
 * Discord limits referenced in multiple places.
 */
const LIMITS = {
    PANEL_EMBEDS:   10,
    PANEL_OPTIONS:  25,
    OPTION_QUESTIONS: 5,
    BUTTONS_PER_ROW:  5,
    MODAL_COMPONENTS: 5,
};

/**
 * Default ticket channel name format tokens: {username}, {number}, {tag}
 */
const DEFAULT_LABEL_FORMAT = 'ticket-{username}-{number}';


// ---------------------------------------------------------------------------
// Shared formatting helpers
// Centralised here so command files don't each copy-paste their own versions.
// ---------------------------------------------------------------------------

/** "fast_message_spam" -> "Fast Message Spam" */
function formatRuleName(ruleType) {
    return ruleType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** "warn_delete" -> "Warn + Delete" */
function formatAction(action) {
    const LABELS = {
        warn:         'Warn',
        delete:       'Delete',
        warn_delete:  'Warn + Delete',
        auto_mute:    'Auto Mute',
        auto_ban:     'Auto Ban',
        instant_mute: 'Instant Mute',
        instant_ban:  'Instant Ban',
    };
    return LABELS[action] ?? action;
}

/** 90 -> "1m", 3661 -> "1h", 90000 -> "1d" */
function formatDuration(seconds) {
    if (seconds < 60)    return `${seconds}s`;
    if (seconds < 3600)  return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Strips protocol and path from a domain/URL input so that
 * "https://youtube.com/watch?v=x" and "youtube.com" both store as "youtube.com".
 */
function normaliseDomain(input) {
    return input.toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
}

module.exports = { CUSTOM_IDS, LIMITS, DEFAULT_LABEL_FORMAT, formatRuleName, formatAction, formatDuration, normaliseDomain };
