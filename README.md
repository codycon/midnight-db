# Midnight DB

> A development build of the real Midnight Bot — a powerful Discord bot with automoderation and ticket management.

## Features

- **Automoderation** — Filter bad words, links, spam, and more
- **Ticket System** — Create, manage, and track support tickets
### 🛡️ Rule Types

1. **All Caps** — Deletes messages over a configurable % of caps (default 70%)
2. **Bad Words** — Detects banned words/phrases (supports wildcard and exact matching)
3. **Chat Clearing Newlines** — Detects messages with excessive newlines
4. **Duplicate Text** — Detects repeated text (e.g., "aaaaaaaa", "word word word…")
5. **Character Count** — Detects messages that are too long
6. **Emoji Spam** — Detects messages with too many emojis
7. **Fast Message Spam** — Detects multiple messages in 5 seconds in a single channel
8. **Image Spam** — Detects multiple images at once or within 10 seconds
9. **Invite Links** — Detects Discord invite links
10. **Known Phishing Links** — Detects known phishing domains
11. **Links** — Detects links; can delete specific links or all links (with allowlisting)
12. **Links Cooldown** — Detects multiple links within X seconds (works across channels)
13. **Mass Mentions** — Detects messages with excessive user mentions
14. **Mentions Cooldown** — Detects multiple mentions within 30 seconds
15. **Spoilers** — Detects text or image spoilers
16. **Masked Links** — Detects masked links (e.g., `[text](url)`)
17. **Stickers** — Detects sticker messages
18. **Sticker Cooldown** — Detects multiple stickers within 60 seconds
19. **Zalgo Text** — Detects zalgo/combining-character spam text

### ⚡ Actions

- **Warn** — Short, auto-deleting verbal warning in-channel
- **Delete** — Delete the triggering message
- **Warn + Delete** — Warn and delete
- **Auto Mute** — Mute after X violations (within 5-minute window)
- **Auto Ban** — Ban after X violations (within 5-minute window)
- **Instant Mute** — Mute immediately
- **Instant Ban** — Ban immediately

### 🎯 Rule Controls

- **Per-rule permissions scoping**: Affected Roles/Channels, Ignored Roles/Channels
- **Per-rule options**: Custom Log Channel and Custom Response
- **Global defaults**: Default log channel + global ignored roles/channels
- **Auto-ignores**: Server owner, administrators, and Dyno manager/mod roles
- **Violation window**: Violations expire after 5 minutes (for "X violations" actions)

## Setup

### Prerequisites

- Node.js v16.9.0 or higher
- A Discord bot token
- Discord bot with necessary permissions

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
```

3. Deploy slash commands:

```bash
npm run deploy-commands
```

4. Start the bot:

```bash
npm start
```

### Bot Permissions

Required permissions for your bot:

- Manage Messages (delete messages)
- Moderate Members (timeout users)
- Ban Members (ban users)
- View Channels
- Send Messages
- Read Message History

## Commands

### `/automod-setup`

Create a new automod rule.

**Options:**

- `rule` — Type of rule to create
- `action` — Action to take when violated
- `threshold` — Threshold value (varies by rule type)
- `violations` — Number of violations before action (for auto_mute/auto_ban)
- `mute-duration` — Mute duration in seconds (default: 300)
- `log-channel` — Channel to log violations
- `custom-message` — Custom warning message

**Example:**

```
/automod-setup rule:all_caps action:warn_delete threshold:80
```

### `/automod-list`

View all configured automod rules.

### `/automod-toggle`

Enable or disable a specific rule.

**Example:**

```
/automod-toggle rule-id:1 enabled:false
```

### `/automod-remove`

Delete an automod rule.

**Example:**

```
/automod-remove rule-id:1
```

### `/automod-filter`

Add filters to rules (affected/ignored roles/channels).

**Subcommands:**

- `add` — Add a filter
- `list` — List filters for a rule

**Example:**

```
/automod-filter add rule-id:1 filter-type:ignored target-type:role target-id:@Moderator
```

### `/automod-badwords`

Manage the bad words list.

**Subcommands:**

- `add` — Add a word/phrase
- `remove` — Remove a word
- `list` — List all bad words

**Match Types:**

- `contains` — Matches anywhere in message
- `exact` — Must be a separate word
- `wildcard` — Use * for any characters (e.g., `bad*word`)

**Example:**

```
/automod-badwords add word:spam match-type:contains
```

### `/automod-links`

Manage allowed and blocked link domains.

**Subcommands:**

- `allow` — Add domain to allowlist
- `block` — Add domain to blocklist
- `list` — View all configured domains

**Example:**

```
/automod-links block domain:scamsite.com
```

### `/automod-settings`

Configure global automod settings.

**Subcommands:**

- `log-channel` — Set default log channel
- `ignore-role` — Add globally ignored role
- `ignore-channel` — Add globally ignored channel
- `view` — View current settings

**Example:**

```
/automod-settings log-channel channel:#automod-logs
```

## Configuration Examples

### Basic Spam Protection

```
# Block all caps messages
/automod-setup rule:all_caps action:warn_delete threshold:70

# Block fast message spam
/automod-setup rule:fast_message_spam action:auto_mute threshold:5 violations:3

# Block emoji spam
/automod-setup rule:emoji_spam action:delete threshold:10
```

### Link Protection

```
# Block all Discord invites
/automod-setup rule:invite_links action:delete

# Block phishing links
/automod-setup rule:phishing_links action:instant_ban

# Allow only specific domains
/automod-links allow domain:youtube.com
/automod-links allow domain:twitter.com
/automod-setup rule:links action:delete threshold:1
```

### Content Moderation

```
# Add bad words
/automod-badwords add word:spam match-type:contains
/automod-badwords add word:badword match-type:exact
/automod-setup rule:bad_words action:warn_delete

# Block excessive mentions
/automod-setup rule:mass_mentions action:delete threshold:5

# Block zalgo text
/automod-setup rule:zalgo action:delete
```

### Advanced Configuration

```
# Set global log channel
/automod-settings log-channel channel:#mod-logs

# Ignore moderator role
/automod-settings ignore-role role:@Moderator

# Configure rule-specific filters
/automod-filter add rule-id:1 filter-type:affected target-type:channel target-id:#general
/automod-filter add rule-id:1 filter-type:ignored target-type:role target-id:@Trusted
```

## Database

The bot uses SQLite (better-sqlite3) to store:

- Automod rules and configurations
- Bad words lists
- Allowed/blocked domains
- Violation tracking (expires after 5 minutes)
- Message tracking for spam detection
- Global settings

Database file: `data/automod.db`

## Logging

All automod violations are logged to:

1. Console (with timestamp and user info)
2. Configured log channel (if set)

Log embeds include:

- Rule type that was violated
- Action taken
- User information
- Channel where it occurred
- Message content (truncated to 1000 chars)

## Violation Tracking

- Violations are tracked per user, per rule type
- Window: 5 minutes (configurable in code)
- After 5 minutes, violations expire
- Used for `auto_mute` and `auto_ban` actions

## Performance

The bot includes automatic cleanup:

- Expired violations cleaned every 5 minutes
- Old message tracking data cleaned every 5 minutes
- Database indexes for fast queries

## Customization

### Phishing Domains

Edit `utils/automodChecker.js` to add more phishing domains:

```javascript
this.phishingDomains = [
  "discord-nitro.com",
  "discord-gift.com",
  // Add more here
];
```

### Default Thresholds

Modify in `commands/admin/automod-setup.js`:

```javascript
const defaultThresholds = {
  all_caps: 70,
  newlines: 10,
  // Customize here
};
```

## Troubleshooting

**Rules not working:**

- Check bot permissions
- Verify rule is enabled (`/automod-list`)
- Check global ignored roles/channels
- Verify bot role is above the roles it needs to moderate

**Actions failing:**

- Ensure bot has proper permissions
- Check if target user has higher role than bot
- Review log channel messages for error details

**Database errors:**

- Ensure `data/` directory exists
- Check file permissions
- Verify SQLite is installed correctly

## Support

For issues or questions:

1. Check the console logs
2. Use `/automod-list` to verify configuration
3. Review the command examples above

## License

ISC License

## Credits

Built with Discord.js v14 and better-sqlite3.
