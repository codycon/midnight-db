# Quick Setup Guide

## Step 1: Create a Discord Bot

1. Go to https://discord.com/developers/applications
2. Click "New Application" and give it a name
3. Go to the "Bot" tab and click "Add Bot"
4. Under "Privileged Gateway Intents", enable:
   - ✅ PRESENCE INTENT
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT
5. Click "Reset Token" and copy your bot token

## Step 2: Configure the Bot

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:

   ```env
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   ```

   - Get `DISCORD_TOKEN` from Step 1 (Bot tab)
   - Get `DISCORD_CLIENT_ID` from OAuth2 > General tab (Application ID)

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Deploy Commands

```bash
npm run deploy-commands
```

This will register all slash commands with Discord.

## Step 5: Invite the Bot

1. Go to OAuth2 > URL Generator in Discord Developer Portal
2. Select scopes:
   - ✅ bot
   - ✅ applications.commands

3. Select bot permissions:
   - ✅ Read Messages/View Channels
   - ✅ Send Messages
   - ✅ Manage Messages
   - ✅ Read Message History
   - ✅ Moderate Members (Timeout)
   - ✅ Ban Members

4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

## Step 6: Start the Bot

```bash
npm start
```

You should see:

```
[READY] YourBot#1234 is online!
[READY] Serving 1 guild(s)
```

## Step 7: Configure Automod

In your Discord server, use slash commands:

### Basic Setup

1. Set a log channel:

   ```
   /automod-settings log-channel channel:#mod-logs
   ```

2. Create your first rule:

   ```
   /automod-setup rule:all_caps action:warn_delete threshold:70
   ```

3. View your rules:
   ```
   /automod-list
   ```

### Example Configurations

**Anti-Spam:**

```
/automod-setup rule:fast_message_spam action:auto_mute threshold:5 violations:3
/automod-setup rule:duplicate_text action:delete
```

**Link Protection:**

```
/automod-setup rule:phishing_links action:instant_ban
/automod-setup rule:invite_links action:delete
```

**Content Moderation:**

```
/automod-badwords add word:spam match-type:contains
/automod-setup rule:bad_words action:warn_delete
```

## Troubleshooting

**Bot not responding to commands:**

- Check if bot is online (green status)
- Verify you ran `npm run deploy-commands`
- Wait a few minutes for commands to propagate
- Check bot permissions in server settings

**Rules not working:**

- Use `/automod-list` to verify rules are enabled
- Check bot role position (must be above users to moderate)
- Verify Message Content Intent is enabled
- Check console for error messages

**Permission errors:**

- Ensure bot has proper permissions (see Step 5)
- Bot role must be above the roles it needs to moderate
- Check channel-specific permissions

## Next Steps

- Read the full [README.md](README.md) for detailed command documentation
- Configure rule filters with `/automod-filter`
- Set up ignored roles/channels with `/automod-settings`
- Add custom bad words with `/automod-badwords`
- Configure link allowlists/blocklists with `/automod-links`

## Support

If you encounter issues:

1. Check the console output for error messages
2. Use `/automod-list` to verify your configuration
3. Review bot permissions in Server Settings > Roles
4. Make sure Message Content Intent is enabled in Discord Developer Portal
